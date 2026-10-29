import {
  PERSONALITY_IDS,
  type PersonalityDimension,
  type PersonalityId,
  type WrappedStats,
} from '@git-wrapped/contracts';
import { clamp01, confidence, mean, round, safeRatio } from './internal/math';
import { isNightHour, type ActivityContext } from './internal/context';
import { commitMessageAverage } from './badges';

/**
 * Personalità: un punteggio in [0, 1] per ogni dimensione, poi una combinazione lineare per
 * personalità e argmax. Formula e pesi sono documentati in `packages/stats/BADGES.md`.
 * Ogni punteggio è moltiplicato per una "fiducia" che cresce con il campione: con pochi dati
 * i punteggi restano bassi, senza mai premiare il volume in sé.
 */

export type DimensionScores = Record<PersonalityDimension, number>;

const FIX_LIKE = /fix|urgent|urgente|asap|revert|rollback|emergenz|critical|critico/i;
const CLEANUP_LIKE =
  /refactor|clean ?up|cleanup|remove|rimuov|rimozion|elimin|pulizia|pulisc|delete|cancell|semplific|simplif|dead code|deprecat/i;

export function computeDimensions(ctx: ActivityContext): DimensionScores {
  const commits = ctx.commits;
  const authored = ctx.authoredCommits;
  const n = commits.length;
  const a = authored.length;

  // nocturnality: quota di commit 22:00–04:59; 35% = punteggio pieno.
  const nightShare = safeRatio(commits.filter((c) => isNightHour(c.at.hour)).length, n);
  const nocturnality = clamp01(nightShare / 0.35) * confidence(n, 10);

  // collaboration: peso delle azioni verso gli altri sul totale delle azioni.
  const social = ctx.approvalsGiven.length + ctx.notes.length + 0.25 * ctx.emojiGiven.length;
  const own = n + ctx.mergeRequests.length;
  const collaboration =
    clamp01(safeRatio(social, social + own) / 0.6) * confidence(social + own, 20);

  // cleanup: quota di righe cancellate (dal 30% in su) o di commit di pulizia.
  let added = 0;
  let deleted = 0;
  for (const { item } of authored) {
    added += item.additions;
    deleted += item.deletions;
  }
  const deleteShare = safeRatio(deleted, added + deleted);
  const cleanupMessages = safeRatio(
    authored.filter((c) => CLEANUP_LIKE.test(c.item.message)).length,
    a,
  );
  const cleanup = Math.max(
    clamp01((deleteShare - 0.3) / 0.3) * confidence(added + deleted, 200),
    clamp01(cleanupMessages / 0.4) * confidence(a, 10),
  );

  // changeSize: file per commit (10 = pieno) e righe per MR (800 = piene).
  const avgFiles = mean(authored.map((c) => new Set(c.item.files).size));
  const fileScore = clamp01((avgFiles - 1) / 9) * confidence(a, 5);
  const mrLines = ctx.mergeRequests
    .map((m) => m.item.changedLines)
    .filter((l): l is number => l !== null);
  const changeSize =
    mrLines.length > 0
      ? mean([fileScore, clamp01(mean(mrLines) / 800) * confidence(mrLines.length, 3)])
      : fileScore;

  // cadence: commit piccoli (meno righe) e ravvicinati (più commit per giorno di lavoro).
  const avgLines = mean(authored.map((c) => c.item.additions + c.item.deletions));
  const commitDays = new Set(commits.map((c) => c.at.dateKey)).size;
  const smallness = a > 0 ? clamp01(1 - avgLines / 200) : 0;
  const frequency = clamp01((safeRatio(n, commitDays) - 1) / 5);
  const cadence = (0.5 * smallness + 0.5 * frequency) * confidence(n, 20);

  // verbosity: il massimo tra messaggi di commit, note e descrizioni delle MR.
  const verbosity = Math.max(
    clamp01((commitMessageAverage(ctx) - 20) / 100) * confidence(a, 10),
    clamp01(mean(ctx.notes.map((x) => x.item.bodyLength)) / 400) * confidence(ctx.notes.length, 10),
    clamp01(mean(ctx.mergeRequests.map((m) => m.item.descriptionLength)) / 600) *
      confidence(ctx.mergeRequests.length, 5),
  );

  // regularity: stessa fascia di 3 ore, giorni feriali, feriali equilibrati tra loro.
  const hours = Array.from({ length: 24 }, () => 0);
  const weekdays = Array.from({ length: 7 }, () => 0);
  for (const { at } of commits) {
    hours[at.hour] = (hours[at.hour] ?? 0) + 1;
    weekdays[at.weekday] = (weekdays[at.weekday] ?? 0) + 1;
  }
  let bestWindow = 0;
  for (let h = 0; h < 24; h++) {
    bestWindow = Math.max(
      bestWindow,
      (hours[h] ?? 0) + (hours[(h + 1) % 24] ?? 0) + (hours[(h + 2) % 24] ?? 0),
    );
  }
  const workdays = weekdays.slice(0, 5);
  const workdayTotal = workdays.reduce((x, y) => x + y, 0);
  const workdayMean = workdayTotal / 5;
  const workdayCv =
    workdayMean > 0
      ? Math.sqrt(mean(workdays.map((v) => (v - workdayMean) ** 2))) / workdayMean
      : 1;
  const regularity =
    mean([
      clamp01((safeRatio(bestWindow, n) - 0.3) / 0.5),
      clamp01((safeRatio(workdayTotal, n) - 0.7) / 0.3),
      clamp01(1 - workdayCv),
    ]) * confidence(n, 20);

  // urgency: commit da pompiere ("fix", revert, urgente...) e pipeline sul branch di default.
  const fixShare = safeRatio(authored.filter((c) => FIX_LIKE.test(c.item.message)).length, a);
  const fixScore = clamp01(fixShare / 0.4) * confidence(a, 10);
  const pipelines = ctx.pipelines.length;
  const urgency =
    pipelines > 0
      ? 0.6 * fixScore +
        0.4 *
          clamp01(
            safeRatio(ctx.pipelines.filter((p) => p.item.isDefaultBranch).length, pipelines) / 0.6,
          ) *
          confidence(pipelines, 10)
      : fixScore;

  const scores: DimensionScores = {
    nocturnality,
    collaboration,
    cleanup,
    changeSize,
    cadence,
    verbosity,
    regularity,
    urgency,
  };
  for (const key of Object.keys(scores) as PersonalityDimension[]) {
    scores[key] = round(clamp01(scores[key]), 3);
  }
  return scores;
}

/** Pesi delle personalità sulle dimensioni (le dimensioni non elencate pesano 0). */
export const PERSONALITY_WEIGHTS: Record<
  PersonalityId,
  Partial<Record<PersonalityDimension, number>>
> = {
  architect: { changeSize: 1, cadence: -0.3 },
  firefighter: { urgency: 1 },
  gardener: { cleanup: 1 },
  diplomat: { collaboration: 1 },
  sprinter: { cadence: 1, changeSize: -0.3 },
  philosopher: { verbosity: 1 },
  night_creature: { nocturnality: 1, regularity: -0.2 },
  metronome: { regularity: 0.85, nocturnality: -0.3 },
};

/**
 * Ordine di precedenza a parità di punteggio (anche con attività zero, dove tutto vale 0:
 * vince il Filosofo, che "sta ancora pensando").
 */
export const PERSONALITY_TIE_ORDER: readonly PersonalityId[] = [
  'philosopher',
  'metronome',
  'diplomat',
  'architect',
  'gardener',
  'sprinter',
  'firefighter',
  'night_creature',
];

export function personalityScore(id: PersonalityId, scores: DimensionScores): number {
  let total = 0;
  for (const [dim, weight] of Object.entries(PERSONALITY_WEIGHTS[id])) {
    total += (weight ?? 0) * scores[dim as PersonalityDimension];
  }
  return total;
}

export function computePersonality(ctx: ActivityContext): WrappedStats['personality'] {
  const scores = computeDimensions(ctx);
  let best: PersonalityId = PERSONALITY_TIE_ORDER[0] ?? PERSONALITY_IDS[0];
  let bestScore = -Infinity;
  for (const id of PERSONALITY_TIE_ORDER) {
    const s = round(personalityScore(id, scores), 6);
    if (s > bestScore) {
      best = id;
      bestScore = s;
    }
  }
  return { id: best, scores };
}
