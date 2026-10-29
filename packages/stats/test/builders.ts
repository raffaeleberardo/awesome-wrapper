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

/**
 * Costruttori di `RawActivity` per i test. Persone e progetti inventati.
 * Le date "invernali" usano l'offset +01:00 così l'ora scritta è l'ora di Roma.
 */

export const YEAR = 2026;
export const PROJECT = 'acme/officina/motore';

export const ada: Member = { username: 'ada.rinaldi', displayName: 'Ada Rinaldi' };
export const bruno: Member = { username: 'bruno.sala', displayName: 'Bruno Sala' };
export const carla: Member = { username: 'carla.neri', displayName: 'Carla Neri' };
export const dario: Member = { username: 'dario.galli', displayName: 'Dario Galli' };
export const team: Member[] = [ada, bruno, carla, dario];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Istante in inverno (CET, +01:00): `day` = giorni dal 1° gennaio 2026 (0–80, prima del cambio
 * d'ora del 29 marzo). Il 1° gennaio 2026 è giovedì; il 5 gennaio (day 4) è lunedì.
 */
export function winter(day: number, hour = 10, minute = 0): string {
  if (day < 0 || day > 80) throw new Error('winter(): giorno fuori dall’inverno');
  const date = new Date(Date.UTC(YEAR, 0, 1 + day));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(hour)}:${pad(minute)}:00+01:00`;
}

/** Il `n`-esimo venerdì invernale (0 = 2 gennaio 2026). */
export function fridayDay(n: number): number {
  return 1 + 7 * n;
}

/** Il `n`-esimo lunedì invernale (0 = 5 gennaio 2026). */
export function mondayDay(n: number): number {
  return 4 + 7 * n;
}

let shaSeq = 0;

export function commit(at: string, overrides: Partial<RawCommit> = {}): RawCommit {
  shaSeq++;
  return {
    sha: `c0ffee${String(shaSeq).padStart(6, '0')}`,
    authoredAt: at,
    projectPath: PROJECT,
    files: ['src/motore.ts'],
    additions: 10,
    deletions: 2,
    message: 'aggiorna il calcolo dei preventivi',
    isMerge: false,
    todosAdded: 0,
    todosRemoved: 0,
    ...overrides,
  };
}

/** `n` commit, uno per giorno lavorativo a partire dal 5 gennaio, all'ora indicata. */
export function commits(
  n: number,
  overrides: Partial<RawCommit> | ((i: number) => Partial<RawCommit>) = {},
  hour = 10,
): RawCommit[] {
  return Array.from({ length: n }, (_, i) => {
    const week = Math.floor(i / 5) % 11;
    const day = mondayDay(week) + (i % 5);
    const o = typeof overrides === 'function' ? overrides(i) : overrides;
    return commit(winter(day, hour, i % 60), o);
  });
}

export function project(overrides: Partial<RawProject> = {}): RawProject {
  return {
    id: 1,
    path: PROJECT,
    defaultBranch: 'main',
    languages: { TypeScript: 100 },
    lastActivityBeforeYearAt: '2025-12-01T10:00:00+01:00',
    ...overrides,
  };
}

let mrSeq = 0;

export function mr(overrides: Partial<RawMergeRequest> = {}): RawMergeRequest {
  mrSeq++;
  return {
    iid: mrSeq,
    projectPath: PROJECT,
    createdAt: winter(10, 9),
    updatedAt: winter(11, 9),
    mergedAt: winter(11, 9),
    closedAt: null,
    firstApprovedAt: winter(10, 15),
    state: 'merged',
    isDraft: false,
    targetBranch: 'main',
    changedLines: 120,
    descriptionLength: 200,
    reviewers: [],
    approvedBy: [],
    notesCount: 0,
    ...overrides,
  };
}

export function approval(overrides: Partial<RawApprovalGiven> = {}): RawApprovalGiven {
  return {
    projectPath: PROJECT,
    mrIid: 900,
    mrAuthor: bruno.username,
    mrCreatedAt: winter(20, 10, 0),
    approvedAt: winter(20, 11, 0),
    mrChangedLines: 50,
    ...overrides,
  };
}

let pipelineSeq = 0;

export function pipeline(overrides: Partial<RawPipeline> = {}): RawPipeline {
  pipelineSeq++;
  return {
    id: pipelineSeq,
    projectPath: PROJECT,
    status: 'success',
    ref: 'main',
    isDefaultBranch: true,
    createdAt: winter(15, 10, pipelineSeq % 60),
    durationSeconds: 300,
    author: ada.username,
    ...overrides,
  };
}

export function deployment(overrides: Partial<RawDeployment> = {}): RawDeployment {
  return {
    projectPath: PROJECT,
    environment: 'production',
    status: 'success',
    createdAt: winter(15, 10),
    ...overrides,
  };
}

export function note(overrides: Partial<RawNote> = {}): RawNote {
  return {
    createdAt: winter(12, 11),
    noteableType: 'MergeRequest',
    bodyLength: 80,
    projectPath: PROJECT,
    counterpart: bruno.username,
    ...overrides,
  };
}

export function emojiGiven(overrides: Partial<RawEmojiGiven> = {}): RawEmojiGiven {
  return {
    name: 'thumbsup',
    awardedAt: winter(12, 12),
    awardableType: 'MergeRequest',
    counterpart: bruno.username,
    ...overrides,
  };
}

export function emojiReceived(overrides: Partial<RawEmojiReceived> = {}): RawEmojiReceived {
  return {
    name: 'tada',
    awardedAt: winter(12, 12),
    awardableType: 'MergeRequest',
    from: bruno.username,
    ...overrides,
  };
}

export function issueEvent(overrides: Partial<RawIssueEvent> = {}): RawIssueEvent {
  return {
    action: 'opened',
    at: winter(30, 10),
    projectPath: PROJECT,
    issueIid: 1,
    issueCreatedAt: winter(30, 10),
    previouslyClosedAt: null,
    ...overrides,
  };
}

export function pushEvent(overrides: Partial<RawPushEvent> = {}): RawPushEvent {
  return {
    at: winter(30, 10),
    projectPath: PROJECT,
    action: 'pushed',
    refType: 'branch',
    ref: 'feature/x',
    isDefaultBranch: false,
    commitCount: 1,
    ...overrides,
  };
}

export function activity(overrides: Partial<RawActivity> = {}): RawActivity {
  return {
    schemaVersion: 1,
    member: ada,
    year: YEAR,
    projects: [project()],
    commits: [],
    mergeRequests: [],
    approvalsGiven: [],
    pipelines: [],
    deployments: [],
    notes: [],
    emojiGiven: [],
    emojiReceived: [],
    issueEvents: [],
    pushEvents: [],
    ...overrides,
  };
}

export function times<T>(n: number, make: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => make(i));
}
