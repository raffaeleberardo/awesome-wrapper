import { BADGE_IDS, PERSONALITY_DIMENSIONS } from '@git-wrapped/contracts';
import type { CalendarStats, WrappedStats } from '@git-wrapped/contracts';
import { exampleCalendarStats, exampleWrappedStats } from '@git-wrapped/contracts/examples';

/**
 * Varianti di dati per sviluppo e test: esempio, zero attività, valori estremi.
 * Sono `WrappedStats`/`CalendarStats` validi per i contratti.
 */

export type VariantName = 'example' | 'zero' | 'extreme';
export const VARIANT_NAMES: VariantName[] = ['example', 'zero', 'extreme'];

const zeros = (n: number) => Array.from({ length: n }, () => 0);

export const zeroStats: WrappedStats = {
  ...exampleWrappedStats,
  totals: {
    commits: 0,
    linesAdded: 0,
    linesDeleted: 0,
    mergeRequestsOpened: 0,
    mergeRequestsMerged: 0,
    approvalsGiven: 0,
    notesWritten: 0,
    pipelines: 0,
    pipelinesFailed: 0,
    deployments: 0,
    issuesOpened: 0,
    issuesClosed: 0,
    emojiGiven: 0,
    emojiReceived: 0,
    projectsTouched: 0,
    activeDays: 0,
  },
  topProjects: [],
  topFiles: [],
  languages: [],
  hours: zeros(24),
  weekdays: zeros(7),
  months: zeros(12),
  peakHour: null,
  peakWeekday: null,
  streak: { longestDays: 0, from: null, to: null },
  duet: null,
  commitMessages: {
    averageLength: 0,
    shortest: null,
    longestLength: 0,
    topWords: [],
    fixCount: 0,
    wipCount: 0,
    emojiCount: 0,
  },
  pipelines: {
    total: 0,
    failed: 0,
    successRate: null,
    longestFailStreak: 0,
    recoveries: 0,
    graveyard: [],
  },
  ghostMrs: { count: 0, oldestDays: null },
  fridayDeploys: { count: 0, latestAt: null },
  emoji: { topGiven: [], topReceived: [] },
  epicMoments: [],
  badges: [],
  horoscopeSeed: 0,
};

export const zeroCalendar: CalendarStats = {
  ...exampleCalendarStats,
  meetings: 0,
  meetingHours: 0,
  declinedInvites: 0,
  longestMeeting: null,
  mostCrowded: null,
  longestBackToBack: null,
  fridayAfternoonMeetings: 0,
  teamsCallShare: null,
  recurringShare: null,
  hours: zeros(24),
  weekdays: zeros(7),
  meetingsPerCommit: null,
};

const LONG_PATH =
  'azienda-con-un-nome-lunghissimo/gruppo-infrastruttura-e-piattaforme-condivise/sottogruppo-servizi-di-pagamento/progetto-backend-monolite-legacy-da-migrare';
const LONG_WORD =
  'Supercalifragilistichespiralidosoxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const BIG = 9_999_999;

export const extremeStats: WrappedStats = {
  ...exampleWrappedStats,
  member: {
    username: 'nome.utente.molto.lungo',
    displayName: `Massimiliano Alessandro Bartolomeo ${LONG_WORD}`,
  },
  totals: {
    commits: BIG,
    linesAdded: 1_234_567_890,
    linesDeleted: 987_654_321,
    mergeRequestsOpened: BIG,
    mergeRequestsMerged: BIG,
    approvalsGiven: BIG,
    notesWritten: BIG,
    pipelines: BIG,
    pipelinesFailed: BIG,
    deployments: BIG,
    issuesOpened: BIG,
    issuesClosed: BIG,
    emojiGiven: BIG,
    emojiReceived: BIG,
    projectsTouched: 1234,
    activeDays: 366,
  },
  topProjects: Array.from({ length: 5 }, (_, i) => ({
    projectPath: `${LONG_PATH}-${i}`,
    commits: BIG - i,
    share: 0.2,
  })),
  topFiles: Array.from({ length: 5 }, (_, i) => ({
    path: `src/${'cartella-molto-profonda/'.repeat(8)}file-${LONG_WORD}-${i}.ts`,
    projectPath: LONG_PATH,
    touches: BIG - i,
  })),
  languages: ['TypeScript', 'Rust', LONG_WORD, 'C++', 'Go', 'Python', 'Shell', 'Makefile'].map(
    (name) => ({ name, share: 0.125 }),
  ),
  hours: Array.from({ length: 24 }, (_, i) => (i + 1) * 400_000),
  weekdays: [BIG, BIG, BIG, BIG, BIG, BIG, BIG],
  months: Array.from({ length: 12 }, () => BIG),
  peakHour: 23,
  peakWeekday: 6,
  streak: { longestDays: 366, from: '2026-01-01', to: '2026-12-31' },
  duet: {
    partner: { username: 'altro.utente', displayName: `Collega ${LONG_WORD} Ferdinando Carlo` },
    interactions: BIG,
    via: { approvals: BIG, reviews: BIG, notes: BIG, emoji: BIG },
  },
  commitMessages: {
    averageLength: 1234.56,
    shortest: LONG_WORD.repeat(3),
    longestLength: BIG,
    topWords: Array.from({ length: 10 }, (_, i) => ({ word: `${LONG_WORD}${i}`, count: BIG })),
    fixCount: BIG,
    wipCount: BIG,
    emojiCount: BIG,
  },
  pipelines: {
    total: BIG,
    failed: BIG,
    successRate: 0.01,
    longestFailStreak: BIG,
    recoveries: BIG,
    graveyard: Array.from({ length: 3 }, (_, i) => ({
      projectPath: `${LONG_PATH}-${i}`,
      ref: `feature/${LONG_WORD}`,
      failedAt: '2026-03-14T23:45:00+01:00',
    })),
  },
  ghostMrs: { count: BIG, oldestDays: 99_999 },
  fridayDeploys: { count: BIG, latestAt: '2026-12-25T17:30:00+01:00' },
  emoji: {
    topGiven: ['tada', 'thumbsup', LONG_WORD, 'rocket', 'heart'].map((name) => ({
      name,
      count: BIG,
    })),
    topReceived: ['rocket', 'eyes', LONG_WORD, 'fire', 'star'].map((name) => ({
      name,
      count: BIG,
    })),
  },
  badges: BADGE_IDS.map((id) => ({ id, value: 123456.789 })),
  personality: {
    id: 'philosopher',
    scores: Object.fromEntries(
      PERSONALITY_DIMENSIONS.map((d) => [d, 1]),
    ) as WrappedStats['personality']['scores'],
  },
  horoscopeSeed: 4294967295,
};

export const extremeCalendar: CalendarStats = {
  ...exampleCalendarStats,
  meetings: BIG,
  meetingHours: BIG,
  declinedInvites: BIG,
  longestMeeting: { minutes: BIG, date: '2026-01-20' },
  mostCrowded: { attendees: BIG, date: '2026-12-18' },
  longestBackToBack: { meetings: BIG, date: '2026-04-21' },
  fridayAfternoonMeetings: BIG,
  teamsCallShare: 1,
  recurringShare: 1,
  hours: Array.from({ length: 24 }, () => BIG),
  weekdays: Array.from({ length: 7 }, () => BIG),
  meetingsPerCommit: 12345.67,
};

export const VARIANTS: Record<VariantName, { stats: WrappedStats; calendar: CalendarStats }> = {
  example: { stats: exampleWrappedStats, calendar: exampleCalendarStats },
  zero: { stats: zeroStats, calendar: zeroCalendar },
  extreme: { stats: extremeStats, calendar: extremeCalendar },
};
