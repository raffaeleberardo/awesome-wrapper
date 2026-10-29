const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

/** Numero intero con separatore delle migliaia italiano. */
export const fmt = (n: number): string => nf.format(Number.isFinite(n) ? n : 0);
export const fmt1 = (n: number): string => nf1.format(Number.isFinite(n) ? n : 0);
export const fmt2 = (n: number): string => nf2.format(Number.isFinite(n) ? n : 0);
export const pct = (ratio: number): string => `${fmt(Math.round(ratio * 100))}%`;

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const dateYearFmt = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Data ISO (`2026-02-18` o con orario) in forma breve; stringa originale se non valida. */
export function shortDate(iso: string | null, withYear = false): string {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (withYear ? dateYearFmt : dateFmt).format(d);
}

/** Nomi dei giorni (0 = lunedì) generati dal locale, nessun testo scritto a mano. */
export const WEEKDAY_NAMES: string[] = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(new Date(2024, 0, 1 + i)),
);

export const hourLabel = (h: number): string => `${String(h).padStart(2, '0')}:00`;

const EMOJI: Record<string, string> = {
  tada: '🎉',
  thumbsup: '👍',
  '+1': '👍',
  thumbsdown: '👎',
  '-1': '👎',
  rocket: '🚀',
  heart: '❤️',
  eyes: '👀',
  fire: '🔥',
  smile: '😄',
  joy: '😂',
  laughing: '😆',
  clap: '👏',
  '100': '💯',
  white_check_mark: '✅',
  ok_hand: '👌',
  pray: '🙏',
  thinking: '🤔',
  sob: '😭',
  star: '⭐',
  sparkles: '✨',
  raised_hands: '🙌',
  muscle: '💪',
  bug: '🐛',
};

/** Emoji GitLab (nome) → glifo; se sconosciuta resta `:nome:`. */
export const emojiGlyph = (name: string): string => EMOJI[name] ?? `:${name}:`;

export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Hash stabile di una stringa, per scegliere colori. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Dimensione del testo (in cqw) che fa stare `text` in `width` cqw, tra `min` e `max`. */
export function fitSize(text: string, width: number, max: number, min = 3): number {
  const len = Math.max(1, text.length);
  return Math.max(min, Math.min(max, (width / len) * 1.75));
}
