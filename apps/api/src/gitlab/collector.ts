import { rawActivitySchema } from '@git-wrapped/contracts';
import type {
  Member,
  RawActivity,
  RawApprovalGiven,
  RawCommit,
  RawDeployment,
  RawEmojiGiven,
  RawEmojiReceived,
  RawIssueEvent,
  RawMergeRequest,
  RawNote,
  RawPipeline,
  RawProject,
  RawPushEvent,
} from '@git-wrapped/contracts';
import { SourceError } from '../source';
import type { ActivitySource, GitLabSourceConfig } from '../source';
import { GitLabClient, HttpStatusError, isMissing, mapLimit } from './http';
import type { ClientOptions } from './http';
import { marginWindow, toIso, yearInZone } from './time';

/**
 * Collettore GitLab. Costruisce `RawActivity` per un membro e un anno.
 *
 * Privacy: del testo di note e descrizioni si legge solo la lunghezza; i diff si contano e si
 * scartano subito. Nessun log, nessuna scrittura su disco. Le cache sono in RAM con scadenza breve.
 */

export interface GitLabSourceOptions extends ClientOptions {
  /** Fuso per decidere l'anno di un istante (default `process.env.TZ` o `Europe/Rome`). */
  timeZone?: string;
  /**
   * Durata delle cache interne (membri, progetti, commit del progetto). Default 5 minuti;
   * `src/index.ts` la allinea a `CACHE_TTL_MINUTES`.
   */
  cacheTtlMs?: number;
  /** Progetti elaborati in parallelo (default 4). */
  projectConcurrency?: number;
}

// --- forme (parziali) delle risposte GitLab ---------------------------------------------------

interface ApiMember {
  id: number;
  username: string;
  name?: string;
  state?: string;
  bot?: boolean;
}
interface ApiGroup {
  id: number;
  full_path: string;
}
interface ApiProject {
  id: number;
  path_with_namespace: string;
  default_branch?: string | null;
  last_activity_at?: string | null;
}
interface ApiCommit {
  id: string;
  message?: string;
  author_name?: string;
  author_email?: string;
  authored_date?: string;
  parent_ids?: string[];
  stats?: { additions?: number; deletions?: number };
}
interface ApiDiffEntry {
  new_path?: string;
  old_path?: string;
  diff?: string;
  too_large?: boolean;
  collapsed?: boolean;
}
interface ApiUserRef {
  username?: string;
}
interface ApiMr {
  iid: number;
  project_id: number;
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  closed_at?: string | null;
  state: string;
  draft?: boolean;
  work_in_progress?: boolean;
  target_branch: string;
  description?: string | null;
  reviewers?: ApiUserRef[];
  user_notes_count?: number;
  author?: ApiUserRef;
}
interface ApiIssue {
  iid: number;
  project_id: number;
  created_at: string;
  author?: ApiUserRef;
}
interface ApiEvent {
  action_name?: string;
  target_type?: string | null;
  target_iid?: number | null;
  project_id?: number | null;
  created_at: string;
  push_data?: { action?: string; ref_type?: string; ref?: string; commit_count?: number } | null;
  note?: { body?: string; noteable_type?: string; noteable_iid?: number | null } | null;
}
interface ApiNote {
  system?: boolean;
  body?: string;
  created_at: string;
}
interface ApiAward {
  name: string;
  created_at: string;
  user?: ApiUserRef;
}
interface ApiPipeline {
  id: number;
  status: string;
  ref: string;
  created_at: string;
}
interface ApiDeployment {
  status: string;
  created_at: string;
  user?: ApiUserRef;
  environment?: { name?: string };
}

interface MemberInfo {
  id: number;
  username: string;
  displayName: string;
}
interface ItemInfo {
  author: string | null;
  createdAt: string | null;
}
interface SlimCommit {
  sha: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  message: string;
  isMerge: boolean;
  additions: number;
  deletions: number;
}

const TODO_RE = /\b(TODO|FIXME|XXX)\b/;
/** Oltre queste pagine di diff (per MR) `changedLines` diventa `null`. */
const MR_DIFF_MAX_PAGES = 17;
/** `/merge_requests/:iid/diffs` risponde 500 con `per_page` oltre 30 (visto su GitLab 17.7). */
const MR_DIFF_PER_PAGE = 30;
/** Tentativi per pagina di diff MR: un 5xx qui è quasi sempre permanente. */
const MR_DIFF_MAX_ATTEMPTS = 2;
const COMMIT_DIFF_MAX_PAGES = 10;

/** Username di bot: `*_bot*` e token di progetto/gruppo (`project_123_bot`, `group_4_bot_...`). */
export function isBotUsername(username: string): boolean {
  return /_bot(_|$)/i.test(username) || /(^|_)bot_/i.test(username);
}

class TtlCache<V> {
  private readonly map = new Map<string, { at: number; value: Promise<V> }>();
  constructor(private readonly ttlMs: number) {}
  get(key: string, load: () => Promise<V>): Promise<V> {
    const now = Date.now();
    for (const [k, e] of this.map) if (now - e.at > this.ttlMs) this.map.delete(k);
    const hit = this.map.get(key);
    if (hit) return hit.value;
    const value = load();
    this.map.set(key, { at: now, value });
    // in caso di errore non si memorizza
    value.catch(() => this.map.delete(key));
    return value;
  }
}

export function createCollector(
  config: GitLabSourceConfig,
  options: GitLabSourceOptions = {},
): ActivitySource & { client: GitLabClient } {
  const client = new GitLabClient(config, options);
  const timeZone = options.timeZone ?? process.env['TZ'] ?? 'Europe/Rome';
  const ttl = options.cacheTtlMs ?? 5 * 60_000;
  const projectConcurrency = options.projectConcurrency ?? 4;
  const groupsCache = new TtlCache<{ all: string[]; roots: string[] }>(ttl);
  const membersCache = new TtlCache<MemberInfo[]>(ttl);
  const projectsCache = new TtlCache<ApiProject[]>(ttl);
  const languagesCache = new TtlCache<Record<string, number>>(ttl);
  const priorActivityCache = new TtlCache<string | null>(ttl);
  const commitsCache = new TtlCache<SlimCommit[]>(ttl);

  const inYear = (iso: string | null, year: number): iso is string =>
    iso !== null && yearInZone(iso, timeZone) === year;

  // --- gruppi -------------------------------------------------------------------------------

  /**
   * Gruppi da leggere, già codificati per l'URL. Con `group` impostato è solo quello; altrimenti
   * tutti i gruppi in cui il token è almeno Guest. `roots` esclude i sottogruppi di gruppi già
   * in elenco: progetti, MR e issue si leggono con i sottogruppi inclusi.
   */
  const loadGroups = () =>
    groupsCache.get('groups', async () => {
      if (config.group) {
        const g = encodeURIComponent(config.group);
        return { all: [g], roots: [g] };
      }
      const raw = await client.getAll<ApiGroup>('/groups', {
        min_access_level: 10,
        order_by: 'id',
        sort: 'asc',
      });
      const paths = [...new Set(raw.map((g) => g.full_path))];
      const roots = paths.filter((p) => !paths.some((o) => p.startsWith(`${o}/`)));
      return { all: paths.map(encodeURIComponent), roots: roots.map(encodeURIComponent) };
    });

  /**
   * Unisce le liste lette da più gruppi togliendo i duplicati per chiave. Senza `group` impostato
   * un gruppo che risponde 403/404 (membri nascosti, accesso solo Guest) si salta: non deve
   * impedire di leggere gli altri.
   */
  const fromGroups = async <T>(
    groups: string[],
    key: (item: T) => string | number,
    load: (group: string) => Promise<T[]>,
  ): Promise<T[]> => {
    const lists = await mapLimit(groups, projectConcurrency, async (g) => {
      try {
        return await load(g);
      } catch (e) {
        if (!config.group && isMissing(e)) {
          return [];
        }
        throw e;
      }
    });
    const seen = new Map<string | number, T>();
    for (const item of lists.flat()) if (!seen.has(key(item))) seen.set(key(item), item);
    return [...seen.values()];
  };

  // --- membri -------------------------------------------------------------------------------

  /**
   * Membri dei gruppi più il proprietario del token, che compare sempre (anche se i gruppi
   * non espongono i membri), così le sue statistiche sono sempre scaricabili.
   */
  const loadMembers = (): Promise<MemberInfo[]> =>
    membersCache.get('members', async () => {
      const { all } = await loadGroups();
      const [fromAll, self] = await Promise.all([
        fromGroups<ApiMember>(
          all,
          (m) => m.id,
          (g) => client.getAll<ApiMember>(`/groups/${g}/members/all`),
        ),
        client.getOrNull<ApiMember>('/user'),
      ]);
      const raw = self ? [...fromAll, self] : fromAll;
      const seen = new Map<string, MemberInfo>();
      for (const m of raw) {
        if (m.bot || (m.state && m.state !== 'active') || isBotUsername(m.username)) continue;
        // un membro può comparire due volte (diretto ed ereditato): si tiene la prima occorrenza
        if (!seen.has(m.username)) {
          seen.set(m.username, {
            id: m.id,
            username: m.username,
            displayName: m.name || m.username,
          });
        }
      }
      return [...seen.values()];
    });

  const loadProjects = (): Promise<ApiProject[]> =>
    projectsCache.get('projects', async () =>
      fromGroups(
        (await loadGroups()).roots,
        (p) => p.id,
        (g) =>
          client.getAll<ApiProject>(`/groups/${g}/projects`, {
            include_subgroups: true,
            simple: true,
            order_by: 'id',
            sort: 'asc',
            pagination: 'keyset',
          }),
      ),
    );

  // --- per progetto -------------------------------------------------------------------------

  const loadLanguages = (p: ApiProject) =>
    languagesCache.get(String(p.id), async () => {
      const data = await client.getOrNull<Record<string, number>>(`/projects/${p.id}/languages`);
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(data ?? {})) {
        if (typeof v === 'number' && v >= 0) out[k] = Math.min(100, v);
      }
      return out;
    });

  /**
   * Ultima attività prima dell'anno. Se il progetto è fermo da prima, basta il suo
   * `last_activity_at`; altrimenti si cerca l'ultimo commit (qualsiasi branch) prima del 1° gennaio.
   * `null` se il repository è vuoto o la richiesta non è possibile.
   */
  const loadPriorActivity = (p: ApiProject, year: number) =>
    priorActivityCache.get(`${p.id}:${year}`, async () => {
      const last = toIso(p.last_activity_at);
      if (last && yearInZone(last, timeZone) < year) return last;
      const list = await client.getOrNull<ApiCommit[]>(`/projects/${p.id}/repository/commits`, {
        until: `${year}-01-01T00:00:00Z`,
        all: true,
        per_page: 1,
      });
      const c = list?.[0];
      return toIso(c?.authored_date);
    });

  const loadCommits = (p: ApiProject, year: number) =>
    commitsCache.get(`${p.id}:${year}`, async () => {
      const w = marginWindow(year);
      const raw = await client.getAllOrEmpty<ApiCommit>(`/projects/${p.id}/repository/commits`, {
        since: w.from,
        until: w.to,
        all: true,
        with_stats: true,
      });
      const out: SlimCommit[] = [];
      for (const c of raw) {
        const at = toIso(c.authored_date);
        if (!at) continue;
        out.push({
          sha: c.id,
          authorName: c.author_name ?? '',
          authorEmail: c.author_email ?? '',
          authoredAt: at,
          message: c.message ?? '',
          isMerge: (c.parent_ids?.length ?? 0) > 1,
          additions: c.stats?.additions ?? 0,
          deletions: c.stats?.deletions ?? 0,
        });
      }
      return out;
    });

  /** File toccati e conteggio TODO/FIXME/XXX; il testo del diff non viene conservato. */
  const scanCommitDiff = async (
    projectId: number,
    sha: string,
  ): Promise<{ files: string[]; todosAdded: number; todosRemoved: number }> => {
    const entries = await client.getAllOrEmpty<ApiDiffEntry>(
      `/projects/${projectId}/repository/commits/${sha}/diff`,
      {},
      COMMIT_DIFF_MAX_PAGES,
    );
    const files: string[] = [];
    let todosAdded = 0;
    let todosRemoved = 0;
    for (const e of entries) {
      const path = e.new_path ?? e.old_path;
      if (path) files.push(path);
      for (const line of (e.diff ?? '').split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++') && TODO_RE.test(line)) todosAdded++;
        else if (line.startsWith('-') && !line.startsWith('---') && TODO_RE.test(line))
          todosRemoved++;
      }
    }
    return { files, todosAdded, todosRemoved };
  };

  /**
   * Righe aggiunte + rimosse di una MR, o `null` se il diff è troppo grande/non disponibile.
   * Se GitLab risponde comunque 5xx a `/diffs` si rinuncia al dato, non al wrapped.
   */
  const mrChangedLines = async (projectId: number, iid: number): Promise<number | null> => {
    let entries: ApiDiffEntry[];
    try {
      entries = await client.getAll<ApiDiffEntry>(
        `/projects/${projectId}/merge_requests/${iid}/diffs`,
        { per_page: MR_DIFF_PER_PAGE },
        MR_DIFF_MAX_PAGES,
        MR_DIFF_MAX_ATTEMPTS,
      );
    } catch (e) {
      if (e instanceof HttpStatusError) return null;
      if (e instanceof SourceError && e.code === 'upstream_error') return null;
      throw e;
    }
    if (entries.length >= MR_DIFF_MAX_PAGES * MR_DIFF_PER_PAGE) return null;
    let total = 0;
    for (const e of entries) {
      if (e.too_large || e.collapsed) return null;
      for (const line of (e.diff ?? '').split('\n')) {
        if (
          (line.startsWith('+') && !line.startsWith('+++')) ||
          (line.startsWith('-') && !line.startsWith('---'))
        ) {
          total++;
        }
      }
    }
    return total;
  };

  // --- API pubblica -------------------------------------------------------------------------

  const listMembers = async (): Promise<Member[]> => {
    const members = await loadMembers();
    return members.map((m) => ({ username: m.username, displayName: m.displayName }));
  };

  const getActivity = async (username: string, year: number): Promise<RawActivity | null> => {
    const members = await loadMembers();
    const me = members.find((m) => m.username === username);
    if (!me) return null;

    const win = marginWindow(year);
    const { roots } = await loadGroups();
    const projects = await loadProjects();
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const pathOf = (id: number | null | undefined): string | null =>
      id == null ? null : (projectById.get(id)?.path_with_namespace ?? null);
    const isDefaultRef = (projectId: number, ref: string) =>
      projectById.get(projectId)?.default_branch === ref;

    // progetti che possono avere attività nell'anno (o dopo): gli altri si saltano
    const activeProjects = projects.filter((p) => {
      const last = toIso(p.last_activity_at);
      return !last || yearInZone(last, timeZone) >= year;
    });

    // cache locale di MR/issue incontrate (autore e data di creazione)
    const items = new Map<string, Promise<ItemInfo | null>>();
    const itemKey = (kind: 'mr' | 'issue', pid: number, iid: number) => `${kind}:${pid}:${iid}`;
    const putItem = (kind: 'mr' | 'issue', pid: number, iid: number, info: ItemInfo) =>
      items.set(itemKey(kind, pid, iid), Promise.resolve(info));
    const getItem = (kind: 'mr' | 'issue', pid: number, iid: number): Promise<ItemInfo | null> => {
      const key = itemKey(kind, pid, iid);
      let p = items.get(key);
      if (!p) {
        p = client
          .getOrNull<ApiMr | ApiIssue>(
            `/projects/${pid}/${kind === 'mr' ? 'merge_requests' : 'issues'}/${iid}`,
          )
          .then((d) =>
            d ? { author: d.author?.username ?? null, createdAt: toIso(d.created_at) } : null,
          );
        items.set(key, p);
      }
      return p;
    };

    // 1) tutto ciò che non dipende da altro, in parallelo
    const [commitLists, mrsRaw, issuesRaw, events, pipelineLists, deploymentLists, userInfo] =
      await Promise.all([
        mapLimit(activeProjects, projectConcurrency, (p) => loadCommits(p, year)),
        fromGroups<ApiMr>(
          roots,
          (m) => `${m.project_id}:${m.iid}`,
          (g) =>
            client.getAll<ApiMr>(`/groups/${g}/merge_requests`, {
              author_username: username,
              scope: 'all',
              state: 'all',
              created_after: win.from,
              created_before: win.to,
            }),
        ),
        fromGroups<ApiIssue>(
          roots,
          (i) => `${i.project_id}:${i.iid}`,
          (g) =>
            client.getAll<ApiIssue>(`/groups/${g}/issues`, {
              author_username: username,
              scope: 'all',
              state: 'all',
              created_after: win.from,
              created_before: win.to,
            }),
        ),
        client.getAll<ApiEvent>(`/users/${me.id}/events`, {
          after: win.afterDate,
          before: win.beforeDate,
        }),
        mapLimit(activeProjects, projectConcurrency, (p) =>
          client.getAllOrEmpty<ApiPipeline>(`/projects/${p.id}/pipelines`, {
            username,
            updated_after: win.from,
            updated_before: win.to,
            order_by: 'id',
            sort: 'asc',
          }),
        ),
        mapLimit(activeProjects, projectConcurrency, (p) =>
          // GitLab risponde 400 se il filtro `updated_*` non è accoppiato a `order_by=updated_at`
          client.getAllOrEmpty<ApiDeployment>(`/projects/${p.id}/deployments`, {
            updated_after: win.from,
            updated_before: win.to,
            order_by: 'updated_at',
            sort: 'asc',
          }),
        ),
        client.getOrNull<{ public_email?: string; commit_email?: string }>(`/users/${me.id}`),
      ]);

    // --- progetti
    const rawProjects: RawProject[] = await mapLimit(projects, projectConcurrency, async (p) => ({
      id: p.id,
      path: p.path_with_namespace,
      defaultBranch: p.default_branch ?? null,
      languages: await loadLanguages(p),
      lastActivityBeforeYearAt: await loadPriorActivity(p, year),
    }));

    // --- commit dell'utente
    // Euristica: un commit è dell'utente se l'email dell'autore coincide con l'email pubblica/di
    // commit del profilo o con l'indirizzo noreply di GitLab (`<id>-<username>@users.noreply.<host>`),
    // oppure se il nome autore coincide (senza maiuscole) con username o nome visualizzato,
    // oppure se la parte locale dell'email è lo username (`mario.rossi@azienda.test`): con un
    // token di gruppo `commit_email` non è visibile e le email aziendali seguono spesso lo username.
    // Può sbagliare con nomi omonimi o email non collegate al profilo; le email servono solo al
    // confronto e non escono dal collettore.
    const emails = new Set(
      [userInfo?.public_email, userInfo?.commit_email]
        .filter((e): e is string => !!e)
        .map((e) => e.toLowerCase()),
    );
    const names = new Set([me.username.toLowerCase(), me.displayName.toLowerCase()]);
    const noreply = (email: string) => {
      const m = /^(?:(\d+)-)?([^@]+)@users\.noreply\./i.exec(email);
      return (
        !!m &&
        m[2]?.toLowerCase() === me.username.toLowerCase() &&
        (!m[1] || Number(m[1]) === me.id)
      );
    };
    const localPart = (email: string) => email.toLowerCase().split('@')[0] ?? '';
    const isMine = (c: SlimCommit) =>
      emails.has(c.authorEmail.toLowerCase()) ||
      noreply(c.authorEmail) ||
      (c.authorEmail.includes('@') && localPart(c.authorEmail) === me.username.toLowerCase()) ||
      names.has(c.authorName.trim().toLowerCase());

    const mineByProject: Array<{ project: ApiProject; commits: SlimCommit[] }> = [];
    activeProjects.forEach((p, i) => {
      const mine = (commitLists[i] ?? []).filter((c) => isMine(c) && inYear(c.authoredAt, year));
      if (mine.length) mineByProject.push({ project: p, commits: mine });
    });
    const flatCommits = mineByProject.flatMap(({ project, commits }) =>
      commits.map((c) => ({ project, c })),
    );
    const commits: RawCommit[] = await mapLimit(flatCommits, 6, async ({ project, c }) => {
      const scan = c.isMerge
        ? { files: [], todosAdded: 0, todosRemoved: 0 }
        : await scanCommitDiff(project.id, c.sha);
      return {
        sha: c.sha,
        authoredAt: c.authoredAt,
        projectPath: project.path_with_namespace,
        files: scan.files,
        additions: c.additions,
        deletions: c.deletions,
        message: c.message,
        isMerge: c.isMerge,
        todosAdded: scan.todosAdded,
        todosRemoved: scan.todosRemoved,
      };
    });

    // --- merge request dell'utente
    const mrsInYear = mrsRaw.filter(
      (m) => inYear(toIso(m.created_at), year) && pathOf(m.project_id),
    );
    for (const m of mrsInYear) {
      putItem('mr', m.project_id, m.iid, { author: username, createdAt: toIso(m.created_at) });
    }
    const mergeRequests: RawMergeRequest[] = await mapLimit(mrsInYear, 6, async (m) => {
      const approvals = await client.getOrNull<{ approved_by?: Array<{ user?: ApiUserRef }> }>(
        `/projects/${m.project_id}/merge_requests/${m.iid}/approvals`,
      );
      const approvedBy = (approvals?.approved_by ?? [])
        .map((a) => a.user?.username)
        .filter((u): u is string => !!u);
      let firstApprovedAt: string | null = null;
      if (approvedBy.length) {
        // la data dell'approvazione c'è solo nelle note di sistema; se ne legge solo la data
        const notes = await client.getAllOrEmpty<ApiNote>(
          `/projects/${m.project_id}/merge_requests/${m.iid}/notes`,
          { sort: 'asc', order_by: 'created_at' },
        );
        for (const n of notes) {
          if (n.system && /^approved this merge request/i.test(n.body ?? '')) {
            firstApprovedAt = toIso(n.created_at);
            break;
          }
        }
      }
      return {
        iid: m.iid,
        projectPath: pathOf(m.project_id) as string,
        createdAt: toIso(m.created_at) as string,
        updatedAt: toIso(m.updated_at) ?? (toIso(m.created_at) as string),
        mergedAt: toIso(m.merged_at),
        closedAt: toIso(m.closed_at),
        firstApprovedAt,
        state: (['opened', 'merged', 'closed', 'locked'].includes(m.state)
          ? m.state
          : 'closed') as RawMergeRequest['state'],
        isDraft: m.draft ?? m.work_in_progress ?? false,
        targetBranch: m.target_branch,
        changedLines: await mrChangedLines(m.project_id, m.iid),
        descriptionLength: (m.description ?? '').length,
        reviewers: (m.reviewers ?? []).map((r) => r.username).filter((u): u is string => !!u),
        approvedBy,
        notesCount: m.user_notes_count ?? 0,
      };
    });

    // --- eventi dell'utente
    const yearEvents = events.filter((e) => inYear(toIso(e.created_at), year));

    // push
    const pushEvents: RawPushEvent[] = [];
    for (const e of yearEvents) {
      if (!e.push_data || e.project_id == null) continue;
      const path = pathOf(e.project_id);
      const at = toIso(e.created_at);
      const ref = e.push_data.ref;
      if (!path || !at || !ref) continue;
      const kind = e.push_data.action;
      pushEvents.push({
        at,
        projectPath: path,
        action: kind === 'created' ? 'created' : kind === 'removed' ? 'deleted' : 'pushed',
        refType: e.push_data.ref_type === 'tag' ? 'tag' : 'branch',
        ref,
        isDefaultBranch: isDefaultRef(e.project_id, ref),
        commitCount: e.push_data.commit_count ?? 0,
      });
    }

    // approvazioni date: eventi `approved` + dettagli della MR (autore, creazione, righe)
    const approvedEvents = yearEvents.filter(
      (e) =>
        e.action_name === 'approved' &&
        e.target_type === 'MergeRequest' &&
        e.target_iid != null &&
        pathOf(e.project_id),
    );
    const approvalsGiven: RawApprovalGiven[] = (
      await mapLimit(approvedEvents, 6, async (e): Promise<RawApprovalGiven | null> => {
        const pid = e.project_id as number;
        const iid = e.target_iid as number;
        const info = await getItem('mr', pid, iid);
        const approvedAt = toIso(e.created_at);
        if (!info?.author || !info.createdAt || !approvedAt) return null;
        return {
          projectPath: pathOf(pid) as string,
          mrIid: iid,
          mrAuthor: info.author,
          mrCreatedAt: info.createdAt,
          approvedAt,
          mrChangedLines: await mrChangedLines(pid, iid),
        };
      })
    ).filter((a): a is RawApprovalGiven => a !== null);

    // note scritte: dagli eventi si prende solo la lunghezza del testo
    const noteEvents = yearEvents.filter((e) => e.note && e.action_name === 'commented on');
    const notes: RawNote[] = await mapLimit(noteEvents, 6, async (e): Promise<RawNote> => {
      const type = e.note?.noteable_type;
      const noteableType: RawNote['noteableType'] =
        type === 'MergeRequest' || type === 'Issue' || type === 'Commit' || type === 'Epic'
          ? type
          : 'Other';
      const iid = e.note?.noteable_iid ?? null;
      let counterpart: string | null = null;
      if (e.project_id != null && iid != null && (type === 'MergeRequest' || type === 'Issue')) {
        counterpart =
          (await getItem(type === 'MergeRequest' ? 'mr' : 'issue', e.project_id, iid))?.author ??
          null;
      }
      return {
        createdAt: toIso(e.created_at) as string,
        noteableType,
        bodyLength: (e.note?.body ?? '').length,
        projectPath: pathOf(e.project_id),
        counterpart,
      };
    });

    // eventi issue
    const issueTargets = yearEvents.filter(
      (e) =>
        e.target_type === 'Issue' &&
        e.target_iid != null &&
        pathOf(e.project_id) &&
        ['opened', 'closed', 'reopened'].includes(e.action_name ?? ''),
    );
    const issueEvents: RawIssueEvent[] = (
      await mapLimit(issueTargets, 6, async (e): Promise<RawIssueEvent | null> => {
        const pid = e.project_id as number;
        const iid = e.target_iid as number;
        const action = e.action_name as RawIssueEvent['action'];
        const at = toIso(e.created_at);
        if (!at) return null;
        let issueCreatedAt: string | null = action === 'opened' ? at : null;
        if (!issueCreatedAt) issueCreatedAt = (await getItem('issue', pid, iid))?.createdAt ?? null;
        if (!issueCreatedAt) return null;
        let previouslyClosedAt: string | null = null;
        if (action === 'reopened') {
          const states = await client.getAllOrEmpty<{ state?: string; created_at: string }>(
            `/projects/${pid}/issues/${iid}/resource_state_events`,
          );
          for (const s of states) {
            const t = toIso(s.created_at);
            if (s.state === 'closed' && t && Date.parse(t) < Date.parse(at)) previouslyClosedAt = t;
          }
        }
        return {
          action,
          at,
          projectPath: pathOf(pid) as string,
          issueIid: iid,
          issueCreatedAt,
          previouslyClosedAt,
        };
      })
    ).filter((x): x is RawIssueEvent => x !== null);

    // --- pipeline e deployment
    const pipelines: RawPipeline[] = [];
    activeProjects.forEach((p, i) => {
      for (const pl of pipelineLists[i] ?? []) {
        const at = toIso(pl.created_at);
        if (!inYear(at, year)) continue;
        pipelines.push({
          id: pl.id,
          projectPath: p.path_with_namespace,
          status: ([
            'success',
            'failed',
            'canceled',
            'skipped',
            'running',
            'pending',
            'manual',
          ].includes(pl.status)
            ? pl.status
            : 'other') as RawPipeline['status'],
          ref: pl.ref,
          isDefaultBranch: p.default_branch === pl.ref,
          createdAt: at,
          // la lista non include la durata e un dettaglio per pipeline costerebbe troppe chiamate
          durationSeconds: null,
          author: username,
        });
      }
    });
    const deployments: RawDeployment[] = [];
    activeProjects.forEach((p, i) => {
      for (const d of deploymentLists[i] ?? []) {
        const at = toIso(d.created_at);
        if (d.user?.username !== username || !inYear(at, year)) continue;
        deployments.push({
          projectPath: p.path_with_namespace,
          environment: d.environment?.name ?? 'unknown',
          status: (['success', 'failed', 'canceled', 'running', 'created', 'blocked'].includes(
            d.status,
          )
            ? d.status
            : 'other') as RawDeployment['status'],
          createdAt: at,
        });
      }
    });

    // --- emoji
    // Limite: GitLab non ha un endpoint "emoji dati da un utente". Si leggono le emoji sulle MR/issue
    // dell'utente e su quelle dove ha commentato o approvato; le emoji sulle singole note e sugli
    // elementi mai toccati non sono raggiungibili senza scansionare tutto il gruppo.
    for (const i of issuesRaw) {
      putItem('issue', i.project_id, i.iid, { author: username, createdAt: toIso(i.created_at) });
    }
    const touched = new Map<string, { kind: 'mr' | 'issue'; pid: number; iid: number }>();
    const touch = (
      kind: 'mr' | 'issue',
      pid: number | null | undefined,
      iid: number | null | undefined,
    ) => {
      if (pid == null || iid == null || !pathOf(pid)) return;
      touched.set(itemKey(kind, pid, iid), { kind, pid, iid });
    };
    for (const m of mrsInYear) touch('mr', m.project_id, m.iid);
    for (const i of issuesRaw) touch('issue', i.project_id, i.iid);
    for (const e of approvedEvents) touch('mr', e.project_id, e.target_iid);
    for (const e of noteEvents) {
      const t = e.note?.noteable_type;
      if (t === 'MergeRequest') touch('mr', e.project_id, e.note?.noteable_iid);
      else if (t === 'Issue') touch('issue', e.project_id, e.note?.noteable_iid);
    }
    const emojiGiven: RawEmojiGiven[] = [];
    const emojiReceived: RawEmojiReceived[] = [];
    await mapLimit([...touched.values()], 6, async ({ kind, pid, iid }) => {
      const awards = await client.getAllOrEmpty<ApiAward>(
        `/projects/${pid}/${kind === 'mr' ? 'merge_requests' : 'issues'}/${iid}/award_emoji`,
      );
      if (!awards.length) return;
      const info = await getItem(kind, pid, iid);
      const awardableType: RawEmojiGiven['awardableType'] =
        kind === 'mr' ? 'MergeRequest' : 'Issue';
      for (const a of awards) {
        const at = toIso(a.created_at);
        const who = a.user?.username;
        if (!who || !inYear(at, year)) continue;
        if (who === username) {
          emojiGiven.push({
            name: a.name,
            awardedAt: at,
            awardableType,
            counterpart: info?.author ?? null,
          });
        } else if (info?.author === username) {
          emojiReceived.push({ name: a.name, awardedAt: at, awardableType, from: who });
        }
      }
    });

    const activity = {
      schemaVersion: 1 as const,
      member: { username: me.username, displayName: me.displayName },
      year,
      projects: rawProjects,
      commits,
      mergeRequests,
      approvalsGiven,
      pipelines,
      deployments,
      notes,
      emojiGiven,
      emojiReceived,
      issueEvents,
      pushEvents,
    };
    const parsed = rawActivitySchema.safeParse(activity);
    if (!parsed.success) {
      // niente dettagli: potrebbero contenere username o percorsi
      throw new SourceError('upstream_error', 'I dati di GitLab non rispettano il formato atteso');
    }
    return parsed.data;
  };

  /** Un 4xx non gestito sopra non deve uscire come errore generico (500): è un errore di GitLab. */
  const upstream =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await fn(...args);
      } catch (e) {
        if (e instanceof HttpStatusError) {
          throw new SourceError('upstream_error', 'Richiesta GitLab rifiutata');
        }
        throw e;
      }
    };

  return { listMembers: upstream(listMembers), getActivity: upstream(getActivity), client };
}
