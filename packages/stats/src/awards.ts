import type { Member, TeamAward, TeamAwards, WrappedStats } from '@git-wrapped/contracts';
import { charLength, compareStrings, round } from './internal/math';

/**
 * Premi della notte degli Oscar, calcolati solo dalle `WrappedStats` del team.
 * Regole (dettagli in BADGES.md): pari merito ammessi (vincitori in ordine di username),
 * premio omesso se nessuno ha dati utili. Nessun premio misura il volume di lavoro.
 */

/** Minimo di righe cambiate per lo Spazzino d'oro (come Marie Kondo). */
export const GOLDEN_BROOM_MIN_LINES = 500;

interface Candidate {
  member: Member;
  /** Chiave di ordinamento: vince il valore più basso; a parità esatta si è pari merito. */
  rank: number[];
  value: number;
  detail: string | null;
}

function byUsername(a: Member, b: Member): number {
  return compareStrings(a.username, b.username);
}

function compareRank(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Vincitori (pari merito compresi) tra i candidati; `null` se non ce ne sono. */
function podium(id: TeamAward['id'], candidates: Candidate[]): TeamAward | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort(
    (a, b) => compareRank(a.rank, b.rank) || byUsername(a.member, b.member),
  );
  const top = sorted[0] as Candidate;
  const winners = sorted.filter((c) => compareRank(c.rank, top.rank) === 0);
  return { id, winners: winners.map((w) => w.member), value: top.value, detail: top.detail };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const clock = (minuteOfDay: number) =>
  `${pad2(Math.floor(minuteOfDay / 60))}:${pad2(minuteOfDay % 60)}`;

function bestDuet(stats: WrappedStats[]): TeamAward | null {
  const pairs = new Map<string, { members: [Member, Member]; value: number }>();
  for (const s of stats) {
    if (!s.duet || s.duet.interactions <= 0) continue;
    if (s.duet.partner.username === s.member.username) continue;
    const members = [s.member, s.duet.partner].sort(byUsername) as [Member, Member];
    const key = `${members[0].username}\u0000${members[1].username}`;
    const existing = pairs.get(key);
    // Le due metà della coppia vedono le stesse interazioni: si tiene il conteggio più alto.
    if (!existing || s.duet.interactions > existing.value) {
      pairs.set(key, { members: existing?.members ?? members, value: s.duet.interactions });
    }
  }
  const best = [...pairs.entries()].sort(
    (a, b) => b[1].value - a[1].value || compareStrings(a[0], b[0]),
  )[0];
  if (!best) return null;
  return { id: 'best_duet', winners: best[1].members, value: best[1].value, detail: null };
}

function nightShift(stats: WrappedStats[]): TeamAward | null {
  const candidates: Candidate[] = [];
  for (const s of stats) {
    const night = s.epicMoments.find((m) => m.kind === 'latest_night_commit');
    if (!night) continue;
    const minute = night.value;
    const distance = Math.min(Math.abs(minute - 240), 1440 - Math.abs(minute - 240));
    candidates.push({
      member: s.member,
      rank: [distance, -minute],
      value: minute,
      detail: clock(minute),
    });
  }
  return podium('night_shift', candidates);
}

function emojiOfTheYear(stats: WrappedStats[]): TeamAward | null {
  const totals = new Map<string, number>();
  for (const s of stats) {
    for (const e of s.emoji.topGiven) totals.set(e.name, (totals.get(e.name) ?? 0) + e.count);
  }
  const top = [...totals.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]))[0];
  if (!top) return null;
  const [name] = top;
  const candidates: Candidate[] = [];
  for (const s of stats) {
    const used = s.emoji.topGiven.find((e) => e.name === name);
    if (used && used.count > 0) {
      candidates.push({ member: s.member, rank: [-used.count], value: used.count, detail: name });
    }
  }
  return podium('emoji_of_the_year', candidates);
}

function marathonMr(stats: WrappedStats[]): TeamAward | null {
  const candidates: Candidate[] = [];
  for (const s of stats) {
    const longest = s.epicMoments.find((m) => m.kind === 'longest_mr')?.value ?? 0;
    const days = Math.max(longest, s.ghostMrs.oldestDays ?? 0);
    if (days > 0) candidates.push({ member: s.member, rank: [-days], value: days, detail: null });
  }
  return podium('marathon_mr', candidates);
}

function hemingway(stats: WrappedStats[]): TeamAward | null {
  const candidates: Candidate[] = [];
  for (const s of stats) {
    const shortest = s.commitMessages.shortest;
    if (shortest === null || shortest.length === 0) continue;
    const length = charLength(shortest);
    candidates.push({ member: s.member, rank: [length], value: length, detail: shortest });
  }
  return podium('hemingway', candidates);
}

function tolstoy(stats: WrappedStats[]): TeamAward | null {
  const candidates = stats
    .filter((s) => s.commitMessages.longestLength > 0)
    .map((s) => ({
      member: s.member,
      rank: [-s.commitMessages.longestLength],
      value: s.commitMessages.longestLength,
      detail: null,
    }));
  return podium('tolstoy', candidates);
}

function goldenBroom(stats: WrappedStats[]): TeamAward | null {
  const candidates: Candidate[] = [];
  for (const s of stats) {
    const { linesAdded, linesDeleted } = s.totals;
    if (linesAdded + linesDeleted < GOLDEN_BROOM_MIN_LINES || linesDeleted === 0) continue;
    const ratio = round(linesDeleted / Math.max(linesAdded, 1), 2);
    candidates.push({ member: s.member, rank: [-ratio], value: ratio, detail: null });
  }
  return podium('golden_broom', candidates);
}

function fridayCourage(stats: WrappedStats[]): TeamAward | null {
  const candidates = stats
    .filter((s) => s.fridayDeploys.count > 0)
    .map((s) => ({
      member: s.member,
      rank: [-s.fridayDeploys.count],
      value: s.fridayDeploys.count,
      detail: null,
    }));
  return podium('friday_courage', candidates);
}

/** Mattiniero: il commit più presto (dalle 05:00 alle 11:59), al minuto. */
function firstLight(stats: WrappedStats[]): TeamAward | null {
  const candidates: Candidate[] = [];
  for (const s of stats) {
    const morning = s.epicMoments.find((m) => m.kind === 'earliest_morning_commit');
    if (!morning) continue;
    const minute = morning.value;
    candidates.push({ member: s.member, rank: [minute], value: minute, detail: clock(minute) });
  }
  return podium('first_light', candidates);
}

/** Fenice: più pipeline verdi subito dopo una rossa (stesso progetto e ref). */
function pipelinePhoenix(stats: WrappedStats[]): TeamAward | null {
  const candidates = stats
    .filter((s) => s.pipelines.recoveries > 0)
    .map((s) => ({
      member: s.member,
      rank: [-s.pipelines.recoveries],
      value: s.pipelines.recoveries,
      detail: null,
    }));
  return podium('pipeline_phoenix', candidates);
}

export function computeAwards(allStats: WrappedStats[], year: number): TeamAwards {
  const stats = allStats.filter((s) => s.year === year);
  const awards = [
    bestDuet(stats),
    nightShift(stats),
    pipelinePhoenix(stats),
    emojiOfTheYear(stats),
    marathonMr(stats),
    hemingway(stats),
    tolstoy(stats),
    goldenBroom(stats),
    fridayCourage(stats),
    firstLight(stats),
  ].filter((a): a is TeamAward => a !== null);

  const sum = (pick: (s: WrappedStats) => number) => stats.reduce((t, s) => t + pick(s), 0);
  return {
    schemaVersion: 1,
    year,
    teamSize: stats.length,
    awards,
    teamTotals: {
      commits: sum((s) => s.totals.commits),
      mergeRequestsMerged: sum((s) => s.totals.mergeRequestsMerged),
      pipelines: sum((s) => s.totals.pipelines),
      emojiGiven: sum((s) => s.totals.emojiGiven),
    },
  };
}
