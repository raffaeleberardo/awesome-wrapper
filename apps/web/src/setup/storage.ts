/**
 * Impostazioni ricordate nel browser (`localStorage`). URL e gruppo si ricordano sempre, per
 * comodità; il token solo se l'utente sceglie «Ricorda su questo browser». Lo storage può
 * mancare o lanciare (finestra privata, dati bloccati): ogni accesso è protetto e l'app funziona
 * anche senza.
 */

const KEY = 'git-wrapped:settings';

export interface SavedSettings {
  gitlabUrl: string;
  group: string;
  /** Presente solo se l'utente ha scelto di ricordarlo. */
  token?: string;
}

export function loadSettings(): SavedSettings | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { gitlabUrl, group, token } = v as Record<string, unknown>;
    if (typeof gitlabUrl !== 'string' || typeof group !== 'string') return null;
    return { gitlabUrl, group, ...(typeof token === 'string' && token ? { token } : {}) };
  } catch {
    return null;
  }
}

export function saveSettings(settings: SavedSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage non disponibile: si reinserisce al prossimo avvio
  }
}

/** Dimentica solo il token, tenendo URL e gruppo. */
export function forgetToken(): void {
  const current = loadSettings();
  if (current) saveSettings({ gitlabUrl: current.gitlabUrl, group: current.group });
}
