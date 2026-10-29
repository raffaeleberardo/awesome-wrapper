import type { WrappedStats } from '@git-wrapped/contracts';
import { charLength, increment, rankCounts, round } from './internal/math';
import type { ActivityContext } from './internal/context';

/**
 * Messaggi di commit. Si considerano solo i commit non di merge: i messaggi di merge
 * sono generati da GitLab ("Merge branch ...") e falserebbero lunghezze e parole.
 */

/** Prefisso conventional commit, es. `feat(api)!: `, `fix: `, `chore(deps): `. */
const CONVENTIONAL_PREFIX =
  /^\s*(feat|fix|chore|docs?|style|refactor|perf|tests?|build|ci|revert|hotfix|wip|release|deps)(\([^)]*\))?!?\s*:\s*/i;

/** Parole vuote italiane e inglesi (più qualche elisione italiana). */
const STOPWORDS = new Set(
  [
    // italiano
    'il lo la le gli un uno una del dello della dei degli delle dell al allo alla ai agli alle all',
    'dal dallo dalla dai dagli dalle dall nel nello nella nei negli nelle nell sul sullo sulla sui',
    'sugli sulle sull col coi per tra fra con che chi cui non più meno come anche ancora già poi',
    'quando dove perché perche quindi però pero mentre senza sono sei siamo siete era erano stato',
    'stata stati state essere avere ha hanno abbiamo avete aveva questo questa questi queste quello',
    'quella quelli quelle tutto tutti tutta tutte ogni solo molto poco altro altra altri altre suo',
    'sua suoi sue loro nostro nostra mio mia tuo tua cosa ecc via qui qua adesso ora oppure ovvero',
    // inglese
    'the and for with from into onto that this these those not but are was were been being has',
    'have had does did done doing than then them they their there here what when where which who',
    'why how all any some more most other such only own same too very can will just should now',
    'also its it’s our your you his her him she its out off over under again further once both each',
    'few nor yet use uses used using after before while about above below between through during',
    'per via upon',
  ]
    .join(' ')
    .split(/\s+/),
);

const SHORTCODE = /:[a-z][a-z0-9_+-]*:/gi;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const URL = /\bhttps?:\/\/\S+/gi;

function firstLine(message: string): string {
  return (message.split(/\r?\n/)[0] ?? '').trim();
}

/** Parole significative di un messaggio, senza prefisso conventional. */
export function wordsOf(message: string): string[] {
  const text = message
    .trim()
    .replace(CONVENTIONAL_PREFIX, '')
    .replace(URL, ' ')
    .replace(SHORTCODE, ' ')
    .toLowerCase();
  return text
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => charLength(w) >= 3 && /\p{L}/u.test(w) && !STOPWORDS.has(w));
}

export function hasEmoji(message: string): boolean {
  return PICTOGRAPHIC.test(message) || /:[a-z][a-z0-9_+-]*:/i.test(message);
}

/** Contiene "fix" in qualunque forma (fix, fixes, hotfix, bugfix...). */
export function isFixMessage(message: string): boolean {
  return /fix/i.test(message);
}

/** Contiene la parola "wip" (non "wipe"). */
export function isWipMessage(message: string): boolean {
  return /(^|[^\p{L}])wip([^\p{L}]|$)/iu.test(message);
}

export function computeCommitMessages(ctx: ActivityContext): WrappedStats['commitMessages'] {
  const commits = ctx.authoredCommits;
  let totalLength = 0;
  let longestLength = 0;
  let shortest: string | null = null;
  let fixCount = 0;
  let wipCount = 0;
  let emojiCount = 0;
  const words = new Map<string, number>();

  for (const { item } of commits) {
    const message = item.message.trim();
    const length = charLength(message);
    totalLength += length;
    longestLength = Math.max(longestLength, length);
    const line = firstLine(message);
    // A parità di lunghezza vince il primo dell'anno (i commit sono in ordine cronologico).
    if (shortest === null || charLength(line) < charLength(shortest)) shortest = line;
    if (isFixMessage(message)) fixCount++;
    if (isWipMessage(message)) wipCount++;
    if (hasEmoji(message)) emojiCount++;
    for (const w of wordsOf(message)) increment(words, w);
  }

  return {
    averageLength: commits.length === 0 ? 0 : round(totalLength / commits.length, 1),
    shortest,
    longestLength,
    topWords: rankCounts(words, 10).map(([word, count]) => ({ word, count })),
    fixCount,
    wipCount,
    emojiCount,
  };
}
