import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { rawActivitySchema } from '@git-wrapped/contracts';
import { SourceError } from '../source';
import { createDemoSource, createGitLabSource } from './index';

/** Tutti i dati sono inventati. Il server finto risponde a un sottoinsieme delle API v4. */

const BASE = 'https://gitlab.test';
const TOKEN = 'glpat-token-finto-123';
const NOTE_SECRET = 'testo-segreto-della-nota';
const DESC_SECRET = 'descrizione-segreta-della-mr';

type Route = (url: URL) => Response | object | null;

let route: Route = () => null;
const requests: string[] = [];

const server = setupServer(
  http.get(`${BASE}/api/v4/*`, ({ request }) => {
    const url = new URL(request.url);
    requests.push(url.pathname + url.search);
    const res = route(url);
    if (res instanceof Response) return res;
    if (res === null) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(res);
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  route = () => null;
  requests.length = 0;
});
afterAll(() => server.close());

const sleeps: number[] = [];
const fast = {
  retry: {
    maxAttempts: 3,
    baseDelayMs: 10,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
  },
  random: () => 0,
  timeZone: 'Europe/Rome',
};
const config = { url: BASE, token: TOKEN, group: 'acme/team' };

const members = [
  { id: 1, username: 'ada', name: 'Ada Finta', state: 'active' },
  { id: 2, username: 'bruno', name: 'Bruno Inventato', state: 'active' },
  { id: 3, username: 'project_5_bot_abc', name: 'Bot', state: 'active' },
  { id: 4, username: 'carla', name: 'Carla Bloccata', state: 'blocked' },
];

const projects = [
  {
    id: 10,
    path_with_namespace: 'acme/team/api',
    default_branch: 'main',
    last_activity_at: '2026-12-01T10:00:00Z',
  },
  {
    id: 11,
    path_with_namespace: 'acme/team/sub/web',
    default_branch: 'main',
    last_activity_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 12,
    path_with_namespace: 'acme/team/vuoto',
    default_branch: null,
    last_activity_at: '2024-02-01T10:00:00Z',
  },
];

/** Mondo finto con attività per `ada`. */
function world(url: URL): Response | object | null {
  const p = decodeURIComponent(url.pathname.replace('/api/v4', ''));
  const q = url.searchParams;
  if (p === '/groups/acme/team/members/all') return members;
  if (p === '/groups/acme/team/projects') return projects;
  if (p === '/users/1') return { public_email: 'ada@example.test' };
  if (p === '/users/2') return {};
  if (/^\/projects\/\d+\/languages$/.test(p)) return { TypeScript: 80.5, CSS: 19.5 };
  if (p === '/projects/10/repository/commits') {
    if (q.get('per_page') === '1')
      return [{ id: 'a'.repeat(40), authored_date: '2025-11-20T09:00:00+01:00' }];
    return [
      {
        id: 'c1'.repeat(20),
        message: 'feat: aggiunge la rotta\n',
        author_name: 'Ada Finta',
        author_email: 'ada@example.test',
        authored_date: '2026-03-14T23:41:07.000+01:00',
        parent_ids: ['p1'],
        stats: { additions: 12, deletions: 3 },
      },
      {
        id: 'c2'.repeat(20),
        message: "Merge branch 'x'",
        author_name: 'ada',
        author_email: 'altra@example.test',
        authored_date: '2026-03-15T10:00:00+01:00',
        parent_ids: ['p1', 'p2'],
        stats: { additions: 0, deletions: 0 },
      },
      {
        id: 'c3'.repeat(20),
        message: 'fix: del 2025',
        author_name: 'Ada Finta',
        author_email: 'ada@example.test',
        authored_date: '2025-12-31T22:30:00Z',
        parent_ids: ['p1'],
        stats: { additions: 1, deletions: 1 },
      },
      {
        // email aziendale con la parte locale uguale allo username: è di Ada
        id: 'c5'.repeat(20),
        message: "Merge branch 'y'",
        author_name: 'A. F.',
        author_email: 'Ada@azienda.test',
        authored_date: '2026-06-01T10:00:00Z',
        parent_ids: ['p1', 'p2'],
        stats: { additions: 0, deletions: 0 },
      },
      {
        // parte locale che inizia come lo username ma non coincide: non è di Ada
        id: 'c6'.repeat(20),
        message: "Merge branch 'z'",
        author_name: 'Adamo',
        author_email: 'adamo@azienda.test',
        authored_date: '2026-06-02T10:00:00Z',
        parent_ids: ['p1', 'p2'],
        stats: { additions: 0, deletions: 0 },
      },
      {
        id: 'c4'.repeat(20),
        message: 'chore: di Bruno',
        author_name: 'Bruno Inventato',
        author_email: 'bruno@example.test',
        authored_date: '2026-04-01T10:00:00Z',
        parent_ids: ['p1'],
        stats: { additions: 5, deletions: 5 },
      },
    ];
  }
  if (p === '/projects/11/repository/commits') return [];
  if (p === `/projects/10/repository/commits/${'c1'.repeat(20)}/diff`) {
    return [
      {
        new_path: 'src/a.ts',
        diff: '@@ -1 +1 @@\n-// FIXME vecchio\n+// TODO nuovo\n+// XXX altro\n+const x = 1;\n--- riga\n',
      },
      { new_path: 'src/b.ts', diff: '+ok\n' },
    ];
  }
  if (
    /^\/groups\/acme\/team\/(merge_requests|issues)$/.test(p) &&
    q.get('author_username') !== 'ada'
  ) {
    return [];
  }
  if (p === '/groups/acme/team/merge_requests') {
    return [
      {
        iid: 7,
        project_id: 10,
        created_at: '2026-05-02T08:00:00Z',
        updated_at: '2026-05-03T08:00:00Z',
        merged_at: '2026-05-03T08:00:00Z',
        closed_at: null,
        state: 'merged',
        draft: false,
        target_branch: 'main',
        description: DESC_SECRET,
        reviewers: [{ username: 'bruno' }],
        user_notes_count: 2,
        author: { username: 'ada' },
      },
    ];
  }
  if (p === '/groups/acme/team/issues') {
    return [
      { iid: 3, project_id: 10, created_at: '2026-02-01T08:00:00Z', author: { username: 'ada' } },
    ];
  }
  if (p === '/projects/10/merge_requests/7/approvals')
    return { approved_by: [{ user: { username: 'bruno' } }] };
  if (p === '/projects/10/merge_requests/7/notes') {
    return [
      { system: false, body: NOTE_SECRET, created_at: '2026-05-02T09:00:00Z' },
      { system: true, body: 'approved this merge request', created_at: '2026-05-02T10:00:00Z' },
    ];
  }
  if (p === '/projects/10/merge_requests/7/diffs') return [{ new_path: 'a', diff: '+a\n+b\n-c\n' }];
  if (p === '/projects/10/merge_requests/9') {
    return { iid: 9, created_at: '2026-04-01T08:00:00Z', author: { username: 'bruno' } };
  }
  if (p === '/projects/10/merge_requests/9/diffs') return [{ new_path: 'z', diff: '+z\n' }];
  if (p === '/users/2/events') return [];
  if (p === '/users/1/events') {
    return [
      {
        action_name: 'pushed to',
        project_id: 10,
        created_at: '2026-03-14T22:41:00Z',
        push_data: { action: 'pushed', ref_type: 'branch', ref: 'main', commit_count: 2 },
      },
      {
        action_name: 'approved',
        target_type: 'MergeRequest',
        target_iid: 9,
        project_id: 10,
        created_at: '2026-04-02T08:00:00Z',
      },
      {
        action_name: 'commented on',
        target_type: 'DiscussionNote',
        project_id: 10,
        created_at: '2026-04-03T08:00:00Z',
        note: { body: NOTE_SECRET, noteable_type: 'MergeRequest', noteable_iid: 9 },
      },
      {
        action_name: 'opened',
        target_type: 'Issue',
        target_iid: 3,
        project_id: 10,
        created_at: '2026-02-01T08:00:00Z',
      },
      {
        action_name: 'pushed to',
        project_id: 10,
        created_at: '2025-06-01T00:00:00Z',
        push_data: { action: 'pushed', ref_type: 'branch', ref: 'main', commit_count: 1 },
      },
    ];
  }
  if (p === '/projects/10/pipelines') {
    return [{ id: 100, status: 'failed', ref: 'main', created_at: '2026-03-01T10:00:00Z' }];
  }
  // come GitLab: il filtro `updated_*` va accoppiato a `order_by=updated_at`, altrimenti 400
  if (
    /^\/projects\/\d+\/deployments$/.test(p) &&
    url.searchParams.has('updated_after') !== (url.searchParams.get('order_by') === 'updated_at')
  ) {
    return new Response('{}', { status: 400 });
  }
  if (p === '/projects/10/deployments') {
    return [
      {
        status: 'success',
        created_at: '2026-03-06T16:00:00Z',
        user: { username: 'ada' },
        environment: { name: 'prod' },
      },
      {
        status: 'success',
        created_at: '2026-03-06T17:00:00Z',
        user: { username: 'bruno' },
        environment: { name: 'prod' },
      },
    ];
  }
  if (p === '/projects/10/merge_requests/7/award_emoji') {
    return [
      { name: 'tada', created_at: '2026-05-03T09:00:00Z', user: { username: 'bruno' } },
      { name: 'thumbsup', created_at: '2026-05-03T09:30:00Z', user: { username: 'ada' } },
    ];
  }
  if (p === '/projects/10/merge_requests/9/award_emoji') {
    return [{ name: 'eyes', created_at: '2026-04-02T08:10:00Z', user: { username: 'ada' } }];
  }
  if (p === '/projects/10/issues/3/award_emoji') return [];
  // il resto (pipeline/deployment di altri progetti) è vuoto
  if (/^\/projects\/\d+\/(pipelines|deployments)$/.test(p)) return [];
  return null;
}

describe('GitLab source', () => {
  it('elenca i membri escludendo bot e bloccati, con paginazione su più pagine', async () => {
    route = (url) => {
      if (!url.pathname.endsWith('/members/all')) return null;
      const page = Number(url.searchParams.get('page') ?? '1');
      if (page === 1) {
        return new Response(JSON.stringify([members[0], members[2]]), {
          headers: { 'content-type': 'application/json', 'x-next-page': '2' },
        });
      }
      if (page === 2) {
        return new Response(JSON.stringify([members[1], members[3]]), {
          headers: { 'content-type': 'application/json', 'x-next-page': '' },
        });
      }
      return null;
    };
    const src = createGitLabSource(config, fast);
    const list = await src.listMembers();
    expect(list.map((m) => m.username)).toEqual(['ada', 'bruno']);
    expect(requests.filter((r) => r.includes('/members/all'))).toHaveLength(2);
  });

  it('il proprietario del token è sempre tra i membri, anche se un gruppo risponde 403', async () => {
    route = (url) => {
      const p = decodeURIComponent(url.pathname.replace('/api/v4', ''));
      if (p === '/user') return { id: 7, username: 'io', name: 'Io Finto', state: 'active' };
      if (p === '/groups')
        return [
          { id: 1, full_path: 'acme/team' },
          { id: 2, full_path: 'chiuso' },
        ];
      if (p === '/groups/chiuso/members/all') return new Response(null, { status: 403 });
      if (p === '/groups/acme/team/members/all') return [members[0]];
      return null;
    };
    const src = createGitLabSource({ ...config, group: '' }, fast);
    expect((await src.listMembers()).map((m) => m.username)).toEqual(['ada', 'io']);
  });

  it('currentUser legge GET /user e lo riusa per i membri', async () => {
    route = (url) => {
      const p = decodeURIComponent(url.pathname.replace('/api/v4', ''));
      if (p === '/user') return { id: 1, username: 'ada', name: 'Ada Finta', state: 'active' };
      if (p === '/groups/acme/team/members/all') return members;
      return null;
    };
    const src = createGitLabSource(config, fast);
    expect(await src.currentUser()).toEqual({ username: 'ada', displayName: 'Ada Finta' });
    await src.listMembers();
    expect(await src.currentUser()).toEqual({ username: 'ada', displayName: 'Ada Finta' });
    expect(requests.filter((r) => r.startsWith('/api/v4/user'))).toHaveLength(1);
  });

  it('currentUser senza nome usa lo username', async () => {
    route = (url) => (url.pathname.endsWith('/user') ? { id: 1, username: 'ada' } : null);
    expect(await createGitLabSource(config, fast).currentUser()).toEqual({
      username: 'ada',
      displayName: 'ada',
    });
  });

  it.each([
    ['flag bot', { id: 9, username: 'servizio', name: 'Servizio', bot: true }],
    ['token di gruppo', { id: 9, username: 'group_123_bot_4f2a', name: 'Token gruppo' }],
    ['token di progetto', { id: 9, username: 'project_55_bot', name: 'Token progetto' }],
  ])('currentUser rifiuta un bot (%s) con bot_token', async (_label, user) => {
    route = (url) => (url.pathname.endsWith('/user') ? user : null);
    const err = await createGitLabSource(config, fast)
      .currentUser()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect((err as SourceError).code).toBe('bot_token');
    expect((err as SourceError).message).not.toContain(user.username);
    expect((err as SourceError).message).not.toContain(TOKEN);
  });

  it('currentUser: 401 -> unauthorized, 403 su /user -> unauthorized', async () => {
    route = () => new Response('{}', { status: 401 });
    const e1 = await createGitLabSource(config, fast)
      .currentUser()
      .catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(SourceError);
    expect((e1 as SourceError).code).toBe('unauthorized');
    expect((e1 as SourceError).message).not.toContain(TOKEN);
    route = () => new Response('{}', { status: 403 });
    const e2 = await createGitLabSource(config, fast)
      .currentUser()
      .catch((e: unknown) => e);
    expect((e2 as SourceError).code).toBe('unauthorized');
  });

  it('currentUser: 429 persistente -> rate_limited', async () => {
    route = () => new Response('{}', { status: 429 });
    const err = await createGitLabSource(config, fast)
      .currentUser()
      .catch((e: unknown) => e);
    expect((err as SourceError).code).toBe('rate_limited');
  });

  it('con un gruppo impostato un 403 resta un errore', async () => {
    route = (url) =>
      url.pathname.endsWith('/members/all') ? new Response(null, { status: 403 }) : null;
    const err = await createGitLabSource(config, fast)
      .listMembers()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceError);
  });

  it('segue la paginazione keyset via header Link', async () => {
    route = (url) => {
      if (url.pathname.endsWith('/members/all')) return members;
      if (
        url.pathname.endsWith('/groups/acme%2Fteam/projects') ||
        url.pathname.endsWith('/projects')
      ) {
        if (!url.searchParams.get('id_after')) {
          return new Response(JSON.stringify([projects[0]]), {
            headers: {
              'content-type': 'application/json',
              link: `<https://altro-host.test/api/v4/groups/acme%2Fteam/projects?id_after=10&pagination=keyset>; rel="next"`,
            },
          });
        }
        return [projects[1]];
      }
      return world(url);
    };
    const src = createGitLabSource(config, fast);
    const act = await src.getActivity('bruno', 2026);
    expect(act?.projects.map((p) => p.id)).toEqual([10, 11]);
  });

  it('ritenta su 429 rispettando Retry-After e poi riesce', async () => {
    let calls = 0;
    route = (url) => {
      if (url.pathname.endsWith('/user')) return null;
      calls++;
      if (calls === 1) return new Response('{}', { status: 429, headers: { 'retry-after': '3' } });
      return members;
    };
    sleeps.length = 0;
    const list = await createGitLabSource(config, fast).listMembers();
    expect(list).toHaveLength(2);
    expect(calls).toBe(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(3000);
  });

  it('429 persistente produce SourceError rate_limited senza token né username', async () => {
    route = (url) => (url.pathname.endsWith('/user') ? null : new Response('{}', { status: 429 }));
    sleeps.length = 0;
    const err = await createGitLabSource(config, fast)
      .listMembers()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect((err as SourceError).code).toBe('rate_limited');
    expect((err as SourceError).message).not.toContain(TOKEN);
    expect(sleeps).toHaveLength(2);
    // backoff esponenziale
    expect(sleeps[1]).toBeGreaterThan(sleeps[0] as number);
  });

  it('5xx persistente produce upstream_error, 401 unauthorized', async () => {
    route = () => new Response('{}', { status: 503 });
    const e1 = await createGitLabSource(config, fast)
      .listMembers()
      .catch((e: unknown) => e);
    expect((e1 as SourceError).code).toBe('upstream_error');
    route = () => new Response('{}', { status: 401 });
    const e2 = await createGitLabSource(config, fast)
      .listMembers()
      .catch((e: unknown) => e);
    expect((e2 as SourceError).code).toBe('unauthorized');
  });

  it('un 403 su un progetto (ruolo Guest) non blocca le statistiche', async () => {
    route = (url) =>
      url.pathname.includes('/projects/11/') ? new Response('{}', { status: 403 }) : world(url);
    const act = await createGitLabSource(config, fast).getActivity('ada', 2026);
    expect(rawActivitySchema.safeParse(act).success).toBe(true);
  });

  it('chiede i diff delle MR con per_page 30: oltre GitLab risponde 500', async () => {
    route = (url) =>
      url.pathname.endsWith('/merge_requests/7/diffs') && url.searchParams.get('per_page') !== '30'
        ? new Response('{}', { status: 500 })
        : world(url);
    const act = await createGitLabSource(config, fast).getActivity('ada', 2026);
    expect(act?.mergeRequests.find((m) => m.iid === 7)?.changedLines).toBe(3);
  });

  it('un 5xx persistente sul diff di una MR lascia changedLines a null senza bloccare il resto', async () => {
    route = (url) =>
      url.pathname.endsWith('/merge_requests/7/diffs')
        ? new Response('{}', { status: 500 })
        : world(url);
    const act = await createGitLabSource(config, fast).getActivity('ada', 2026);
    expect(rawActivitySchema.safeParse(act).success).toBe(true);
    expect(act?.mergeRequests.find((m) => m.iid === 7)?.changedLines).toBeNull();
    expect(requests.filter((r) => r.includes('/merge_requests/7/diffs'))).toHaveLength(2);
  });

  it('un 4xx imprevisto diventa upstream_error, non un errore generico', async () => {
    route = (url) =>
      url.pathname.endsWith('/events') ? new Response('{}', { status: 400 }) : world(url);
    const err = await createGitLabSource(config, fast)
      .getActivity('ada', 2026)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect((err as SourceError).code).toBe('upstream_error');
  });

  it('senza gruppo legge tutti i gruppi del token, senza duplicati', async () => {
    route = (url) => {
      const p = decodeURIComponent(url.pathname.replace('/api/v4', ''));
      if (p === '/groups') {
        expect(url.searchParams.get('min_access_level')).toBe('10');
        return [
          { id: 1, full_path: 'acme/team' },
          { id: 2, full_path: 'acme/team/sub' },
          { id: 3, full_path: 'altro' },
        ];
      }
      if (p === '/groups/acme/team/members/all') return [members[0], members[1]];
      if (p === '/groups/acme/team/sub/members/all') return [members[0]];
      if (p === '/groups/altro/members/all')
        return [{ id: 5, username: 'dario', name: 'Dario Finto', state: 'active' }];
      if (p === '/groups/acme/team/projects') return projects;
      if (p === '/groups/acme/team/sub/projects') throw new Error('sottogruppo già incluso');
      if (p.startsWith('/groups/altro/')) return [];
      return world(url);
    };
    const src = createGitLabSource({ ...config, group: '' }, fast);
    expect((await src.listMembers()).map((m) => m.username)).toEqual(['ada', 'bruno', 'dario']);
    const act = await src.getActivity('ada', 2026);
    expect(rawActivitySchema.safeParse(act).success).toBe(true);
    expect(act?.projects.map((p) => p.id)).toEqual([10, 11, 12]);
    expect(requests.some((r) => r.startsWith('/api/v4/groups/acme%2Fteam%2Fsub/projects'))).toBe(
      false,
    );
  });

  it('utente non membro (o bot) -> null', async () => {
    route = world;
    const src = createGitLabSource(config, fast);
    expect(await src.getActivity('sconosciuto', 2026)).toBeNull();
    expect(await src.getActivity('project_5_bot_abc', 2026)).toBeNull();
  });

  it('progetti vuoti: attività valida e vuota', async () => {
    route = world;
    const act = await createGitLabSource(config, fast).getActivity('bruno', 2026);
    expect(act).not.toBeNull();
    expect(rawActivitySchema.safeParse(act).success).toBe(true);
    expect(act?.commits.map((c) => c.message)).toEqual(['chore: di Bruno']);
    expect(act?.mergeRequests).toEqual([]);
    expect(act?.projects.find((p) => p.id === 12)?.lastActivityBeforeYearAt).toBe(
      '2024-02-01T10:00:00Z',
    );
  });

  it('costruisce una RawActivity valida e senza testo di note o descrizioni', async () => {
    route = world;
    const act = await createGitLabSource(config, fast).getActivity('ada', 2026);
    expect(act).not.toBeNull();
    expect(rawActivitySchema.safeParse(act).success).toBe(true);
    const a = act!;

    // commit: filtro per autore (email e nome) e per anno esatto, merge senza diff
    expect(a.commits.map((c) => c.sha.slice(0, 2))).toEqual(['c1', 'c2', 'c5']);
    const c1 = a.commits[0]!;
    expect(c1).toMatchObject({
      additions: 12,
      deletions: 3,
      todosAdded: 2,
      todosRemoved: 1,
      isMerge: false,
    });
    expect(c1.files).toEqual(['src/a.ts', 'src/b.ts']);
    expect(a.commits[1]).toMatchObject({ isMerge: true, files: [], todosAdded: 0 });

    // progetti
    expect(a.projects).toHaveLength(3);
    expect(a.projects.find((p) => p.id === 10)).toMatchObject({
      defaultBranch: 'main',
      languages: { TypeScript: 80.5, CSS: 19.5 },
      lastActivityBeforeYearAt: '2025-11-20T09:00:00+01:00',
    });
    expect(a.projects.find((p) => p.id === 12)?.defaultBranch).toBeNull();

    // MR
    expect(a.mergeRequests).toHaveLength(1);
    expect(a.mergeRequests[0]).toMatchObject({
      iid: 7,
      projectPath: 'acme/team/api',
      descriptionLength: DESC_SECRET.length,
      notesCount: 2,
      approvedBy: ['bruno'],
      reviewers: ['bruno'],
      firstApprovedAt: '2026-05-02T10:00:00Z',
      changedLines: 3,
    });

    // approvazioni, note, issue, push, pipeline, deployment, emoji
    expect(a.approvalsGiven).toEqual([
      {
        projectPath: 'acme/team/api',
        mrIid: 9,
        mrAuthor: 'bruno',
        mrCreatedAt: '2026-04-01T08:00:00Z',
        approvedAt: '2026-04-02T08:00:00Z',
        mrChangedLines: 1,
      },
    ]);
    expect(a.notes).toEqual([
      {
        createdAt: '2026-04-03T08:00:00Z',
        noteableType: 'MergeRequest',
        bodyLength: NOTE_SECRET.length,
        projectPath: 'acme/team/api',
        counterpart: 'bruno',
      },
    ]);
    expect(a.issueEvents).toHaveLength(1);
    expect(a.issueEvents[0]).toMatchObject({
      action: 'opened',
      issueIid: 3,
      previouslyClosedAt: null,
    });
    expect(a.pushEvents).toHaveLength(1);
    expect(a.pushEvents[0]).toMatchObject({
      action: 'pushed',
      isDefaultBranch: true,
      commitCount: 2,
    });
    expect(a.pipelines).toMatchObject([
      { id: 100, status: 'failed', isDefaultBranch: true, author: 'ada' },
    ]);
    expect(a.deployments).toHaveLength(1);
    expect(a.emojiReceived).toMatchObject([{ name: 'tada', from: 'bruno' }]);
    expect(a.emojiGiven.map((e) => e.name).sort()).toEqual(['eyes', 'thumbsup']);

    // privacy: nessun testo di note/descrizioni nel risultato, nessun token
    const json = JSON.stringify(a);
    expect(json).not.toContain(NOTE_SECRET);
    expect(json).not.toContain(DESC_SECRET);
    expect(json).not.toContain(TOKEN);
  });
});

describe('Demo source', () => {
  const base = {
    schemaVersion: 1 as const,
    member: { username: 'demo', displayName: 'Demo Finta' },
    year: 2026,
    projects: [],
    commits: [
      {
        sha: 'abcdef1234',
        authoredAt: '2026-01-10T10:00:00+01:00',
        projectPath: 'demo/app',
        files: [],
        additions: 1,
        deletions: 0,
        message: 'uno',
        isMerge: false,
        todosAdded: 0,
        todosRemoved: 0,
      },
      {
        sha: 'abcdef5678',
        authoredAt: '2025-01-10T10:00:00+01:00',
        projectPath: 'demo/app',
        files: [],
        additions: 1,
        deletions: 0,
        message: 'due',
        isMerge: false,
        todosAdded: 0,
        todosRemoved: 0,
      },
    ],
    mergeRequests: [],
    approvalsGiven: [],
    pipelines: [],
    deployments: [],
    notes: [],
    emojiGiven: [],
    emojiReceived: [],
    issueEvents: [],
    pushEvents: [],
  };
  const data = {
    members: [{ username: 'demo', displayName: 'Demo Finta' }],
    activities: { demo: base },
  };

  it('legge i dati iniettati, filtra per anno e non usa la rete', async () => {
    const src = createDemoSource(data);
    expect(await src.listMembers()).toEqual(data.members);
    const a2026 = await src.getActivity('demo', 2026);
    expect(a2026?.commits.map((c) => c.message)).toEqual(['uno']);
    expect(rawActivitySchema.safeParse(a2026).success).toBe(true);
    const a2025 = await src.getActivity('demo', 2025);
    expect(a2025?.commits.map((c) => c.message)).toEqual(['due']);
    expect(await src.getActivity('altro', 2026)).toBeNull();
  });

  it('senza dati iniettati usa le fixture (anche vuote)', async () => {
    const src = createDemoSource();
    expect(Array.isArray(await src.listMembers())).toBe(true);
  });

  it('currentUser restituisce il primo membro e non usa la rete', async () => {
    expect(await createDemoSource(data).currentUser()).toEqual(data.members[0]);
    const src = createDemoSource();
    const members = await src.listMembers();
    expect(await src.currentUser()).toEqual(members[0]);
    expect(await src.getActivity((await src.currentUser()).username, 2026)).not.toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('currentUser senza membri demo -> SourceError', async () => {
    const err = await createDemoSource({ members: [], activities: {} })
      .currentUser()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceError);
  });
});
