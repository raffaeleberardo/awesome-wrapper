import type {
  ApiError,
  CalendarEvent,
  CalendarStats,
  HealthResponse,
  MembersResponse,
  RawActivity,
  TeamAwards,
  WrappedStats,
} from './index';

/**
 * Un esempio valido per ogni tipo dei contratti. Usati da `docs/contracts.md`,
 * dai test dei contratti e come dati finti per sviluppare le card prima che il motore sia pronto.
 * Persone e progetti sono inventati.
 */

const zeros = (n: number) => Array.from({ length: n }, () => 0);

export const exampleRawActivity: RawActivity = {
  schemaVersion: 1,
  member: { username: 'giulia.ferri', displayName: 'Giulia Ferri' },
  year: 2026,
  projects: [
    {
      id: 101,
      path: 'acme/piattaforma/backend',
      defaultBranch: 'main',
      languages: { TypeScript: 82.5, Shell: 10.1, Dockerfile: 7.4 },
      lastActivityBeforeYearAt: '2025-12-19T17:02:11+01:00',
    },
  ],
  commits: [
    {
      sha: '3f9c2a1e7b4d',
      authoredAt: '2026-03-14T23:41:07+01:00',
      projectPath: 'acme/piattaforma/backend',
      files: ['src/server.ts', 'src/routes/orders.ts'],
      additions: 42,
      deletions: 7,
      message: 'fix: gestisce gli ordini vuoti senza esplodere',
      isMerge: false,
      todosAdded: 1,
      todosRemoved: 0,
    },
  ],
  mergeRequests: [
    {
      iid: 57,
      projectPath: 'acme/piattaforma/backend',
      createdAt: '2026-03-14T10:00:00+01:00',
      updatedAt: '2026-03-15T09:30:00+01:00',
      mergedAt: '2026-03-15T09:30:00+01:00',
      closedAt: null,
      firstApprovedAt: '2026-03-14T16:12:00+01:00',
      state: 'merged',
      isDraft: false,
      targetBranch: 'main',
      changedLines: 49,
      descriptionLength: 312,
      reviewers: ['marco.vitale'],
      approvedBy: ['marco.vitale'],
      notesCount: 4,
    },
  ],
  approvalsGiven: [
    {
      projectPath: 'acme/piattaforma/frontend',
      mrIid: 88,
      mrAuthor: 'marco.vitale',
      mrCreatedAt: '2026-05-02T11:00:00+02:00',
      approvedAt: '2026-05-02T11:03:00+02:00',
      mrChangedLines: 1240,
    },
  ],
  pipelines: [
    {
      id: 90210,
      projectPath: 'acme/piattaforma/backend',
      status: 'failed',
      ref: 'main',
      isDefaultBranch: true,
      createdAt: '2026-03-14T23:45:00+01:00',
      durationSeconds: 412,
      author: 'giulia.ferri',
    },
  ],
  deployments: [
    {
      projectPath: 'acme/piattaforma/backend',
      environment: 'production',
      status: 'success',
      createdAt: '2026-06-12T17:30:00+02:00',
    },
  ],
  notes: [
    {
      createdAt: '2026-05-02T11:02:00+02:00',
      noteableType: 'MergeRequest',
      bodyLength: 18,
      projectPath: 'acme/piattaforma/frontend',
      counterpart: 'marco.vitale',
    },
  ],
  emojiGiven: [
    {
      name: 'tada',
      awardedAt: '2026-05-02T11:03:30+02:00',
      awardableType: 'MergeRequest',
      counterpart: 'marco.vitale',
    },
  ],
  emojiReceived: [
    {
      name: 'rocket',
      awardedAt: '2026-03-15T09:31:00+01:00',
      awardableType: 'MergeRequest',
      from: 'marco.vitale',
    },
  ],
  issueEvents: [
    {
      action: 'reopened',
      at: '2026-09-01T09:00:00+02:00',
      projectPath: 'acme/piattaforma/backend',
      issueIid: 12,
      issueCreatedAt: '2024-02-10T10:00:00+01:00',
      previouslyClosedAt: '2024-03-01T10:00:00+01:00',
    },
  ],
  pushEvents: [
    {
      at: '2026-03-14T23:41:30+01:00',
      projectPath: 'acme/piattaforma/backend',
      action: 'pushed',
      refType: 'branch',
      ref: 'main',
      isDefaultBranch: true,
      commitCount: 1,
    },
  ],
};

const hours = zeros(24);
hours[23] = 41;
hours[10] = 120;
hours[15] = 98;

export const exampleWrappedStats: WrappedStats = {
  schemaVersion: 1,
  member: { username: 'giulia.ferri', displayName: 'Giulia Ferri' },
  year: 2026,
  timezone: 'Europe/Rome',
  totals: {
    commits: 612,
    linesAdded: 48210,
    linesDeleted: 39877,
    mergeRequestsOpened: 74,
    mergeRequestsMerged: 69,
    approvalsGiven: 131,
    notesWritten: 402,
    pipelines: 980,
    pipelinesFailed: 143,
    deployments: 37,
    issuesOpened: 22,
    issuesClosed: 31,
    emojiGiven: 288,
    emojiReceived: 197,
    projectsTouched: 6,
    activeDays: 201,
  },
  topProjects: [
    { projectPath: 'acme/piattaforma/backend', commits: 401, share: 0.655 },
    { projectPath: 'acme/piattaforma/frontend', commits: 150, share: 0.245 },
  ],
  topFiles: [
    { path: 'src/routes/orders.ts', projectPath: 'acme/piattaforma/backend', touches: 77 },
  ],
  languages: [
    { name: 'TypeScript', share: 0.78 },
    { name: 'Shell', share: 0.12 },
    { name: 'Dockerfile', share: 0.1 },
  ],
  hours,
  weekdays: [130, 141, 120, 118, 92, 8, 3],
  months: [40, 51, 66, 58, 49, 60, 71, 12, 55, 63, 50, 37],
  peakHour: 10,
  peakWeekday: 1,
  streak: { longestDays: 17, from: '2026-02-02', to: '2026-02-18' },
  duet: {
    partner: { username: 'marco.vitale', displayName: 'Marco Vitale' },
    interactions: 214,
    via: { approvals: 88, reviews: 61, notes: 40, emoji: 25 },
  },
  commitMessages: {
    averageLength: 38.4,
    shortest: 'ops',
    longestLength: 612,
    topWords: [
      { word: 'fix', count: 120 },
      { word: 'ordini', count: 44 },
    ],
    fixCount: 120,
    wipCount: 9,
    emojiCount: 14,
  },
  pipelines: {
    total: 980,
    failed: 143,
    successRate: 0.854,
    longestFailStreak: 6,
    graveyard: [
      {
        projectPath: 'acme/piattaforma/backend',
        ref: 'main',
        failedAt: '2026-03-14T23:45:00+01:00',
      },
    ],
  },
  ghostMrs: { count: 3, oldestDays: 142 },
  fridayDeploys: { count: 5, latestAt: '2026-06-12T17:30:00+02:00' },
  emoji: {
    topGiven: [
      { name: 'tada', count: 90 },
      { name: 'thumbsup', count: 80 },
    ],
    topReceived: [{ name: 'rocket', count: 51 }],
  },
  epicMoments: [
    {
      kind: 'latest_night_commit',
      at: '2026-03-15T03:12:00+01:00',
      value: 192,
      projectPath: 'acme/piattaforma/backend',
    },
  ],
  badges: [
    { id: 'night_owl', value: 0.18 },
    { id: 'blind_approver', value: 3 },
  ],
  personality: {
    id: 'firefighter',
    scores: {
      nocturnality: 0.6,
      collaboration: 0.7,
      cleanup: 0.4,
      changeSize: 0.3,
      cadence: 0.8,
      verbosity: 0.2,
      regularity: 0.4,
      urgency: 0.9,
    },
  },
  horoscopeSeed: 2840193771,
};

export const exampleTeamAwards: TeamAwards = {
  schemaVersion: 1,
  year: 2026,
  teamSize: 8,
  awards: [
    {
      id: 'best_duet',
      winners: [
        { username: 'giulia.ferri', displayName: 'Giulia Ferri' },
        { username: 'marco.vitale', displayName: 'Marco Vitale' },
      ],
      value: 214,
      detail: null,
    },
    {
      id: 'emoji_of_the_year',
      winners: [{ username: 'giulia.ferri', displayName: 'Giulia Ferri' }],
      value: 90,
      detail: 'tada',
    },
  ],
  teamTotals: { commits: 4210, mergeRequestsMerged: 512, pipelines: 7311, emojiGiven: 1904 },
};

export const exampleCalendarEvent: CalendarEvent = {
  start: '2026-04-17T15:00:00+02:00',
  end: '2026-04-17T16:30:00+02:00',
  isAllDay: false,
  attendeeCount: 12,
  isTeamsCall: true,
  isRecurring: false,
  declined: false,
};

const calHours = zeros(24);
calHours[10] = 140;
calHours[15] = 96;

export const exampleCalendarStats: CalendarStats = {
  schemaVersion: 1,
  year: 2026,
  meetings: 412,
  meetingHours: 377.5,
  declinedInvites: 58,
  longestMeeting: { minutes: 240, date: '2026-01-20' },
  mostCrowded: { attendees: 86, date: '2026-12-18' },
  longestBackToBack: { meetings: 6, date: '2026-04-21' },
  fridayAfternoonMeetings: 27,
  teamsCallShare: 0.71,
  recurringShare: 0.55,
  hours: calHours,
  weekdays: [95, 102, 88, 80, 47, 0, 0],
  meetingsPerCommit: 0.67,
};

export const exampleHealthResponse: HealthResponse = {
  status: 'ok',
  demoMode: true,
  year: 2026,
  contractsVersion: 1,
};

export const exampleMembersResponse: MembersResponse = {
  year: 2026,
  members: [
    { username: 'giulia.ferri', displayName: 'Giulia Ferri' },
    { username: 'marco.vitale', displayName: 'Marco Vitale' },
  ],
};

export const exampleApiError: ApiError = {
  error: { code: 'not_found', message: 'Questa persona non fa parte del gruppo.' },
};
