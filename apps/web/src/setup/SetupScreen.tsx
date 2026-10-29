import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import type { SettingsRequest } from '@git-wrapped/contracts';
import { copy } from '@git-wrapped/copy';
import { api } from '../shared/api';
import { DisplayTitle, Kicker, ThemeSurface, THEMES } from '../theme';
import type { ThemeName } from '../shared/types';
import { forgetToken, saveSettings, type SavedSettings } from './storage';

/**
 * Schermata iniziale: indirizzo di GitLab, gruppo (facoltativo) e Personal Access Token.
 * Il server locale li verifica subito con GitLab (`POST /api/settings`) e li tiene solo in RAM.
 * Stile delle card: stessa palette, font e sfondo della storia e della schermata di attesa.
 */

const THEME: ThemeName = 'electric';
const DEFAULT_URL = 'https://gitlab.com';

/** Pagina di GitLab per creare un PAT con nome e scope già compilati, se l'URL è valido. */
function createTokenUrl(gitlabUrl: string): string | null {
  const base = gitlabUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base) || !URL.canParse(base)) return null;
  return `${base}/-/user_settings/personal_access_tokens?name=git-wrapped&scopes=read_api`;
}

const field =
  'w-full rounded-xl border-2 border-white/25 bg-black/25 px-4 py-3 text-base text-white ' +
  'placeholder:text-white/45 focus:border-[var(--card-accent)] focus:outline-none';

export interface SetupScreenProps {
  /** Impostazioni ricordate nel browser, per precompilare i campi. */
  saved: SavedSettings | null;
  /** Prova subito con il token ricordato (all'avvio, non quando si modificano le impostazioni). */
  autoSubmit?: boolean;
  onConfigured: () => void;
  /** Presente se c'è già una configurazione valida a cui tornare. */
  onCancel?: () => void;
}

type Status = { phase: 'idle' } | { phase: 'checking' } | { phase: 'error'; message: string };

export function SetupScreen({
  saved,
  autoSubmit = false,
  onConfigured,
  onCancel,
}: SetupScreenProps) {
  const [gitlabUrl, setGitlabUrl] = useState(saved?.gitlabUrl ?? DEFAULT_URL);
  const [group, setGroup] = useState(saved?.group ?? '');
  const [token, setToken] = useState(saved?.token ?? '');
  const [remember, setRemember] = useState(saved?.token !== undefined);
  const [showToken, setShowToken] = useState(false);
  const startNow = autoSubmit && saved?.token !== undefined;
  const [status, setStatus] = useState<Status>(
    startNow ? { phase: 'checking' } : { phase: 'idle' },
  );
  const ids = { url: useId(), group: useId(), token: useId(), remember: useId() };
  const abort = useRef<AbortController | null>(null);

  /** Invia le impostazioni; lo stato cambia solo quando il server risponde. */
  const send = (settings: SettingsRequest): void => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    api.saveSettings(settings, ctrl.signal).then(
      () => {
        if (settings.mode === 'gitlab') {
          saveSettings({
            gitlabUrl: settings.gitlabUrl.trim(),
            group: (settings.group ?? '').trim(),
            ...(remember ? { token: settings.token.trim() } : {}),
          });
        }
        onConfigured();
      },
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        // Un token ricordato che GitLab rifiuta non va riprovato al prossimo avvio.
        if (settings.mode === 'gitlab' && saved?.token) forgetToken();
        setStatus({
          phase: 'error',
          message: err instanceof Error ? err.message : copy.ui.error_generic,
        });
      },
    );
  };

  // Token ricordato: si prova subito, senza far premere il pulsante.
  useEffect(() => {
    if (startNow && saved?.token) {
      send({
        mode: 'gitlab',
        gitlabUrl: saved.gitlabUrl,
        group: saved.group,
        token: saved.token,
      });
    }
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setStatus({ phase: 'checking' });
    send({ mode: 'gitlab', gitlabUrl, group, token });
  };

  const onDemo = () => {
    setStatus({ phase: 'checking' });
    send({ mode: 'demo' });
  };

  const checking = status.phase === 'checking';
  const tokenUrl = createTokenUrl(gitlabUrl);
  const palette = THEMES[THEME];
  const stage = {
    '--stage-bg': palette.background,
    '--stage-accent': palette.accent,
  } as CSSProperties;

  return (
    <div className="gw-story relative grid min-h-full place-items-center sm:p-6" style={stage}>
      <div aria-hidden="true" className="gw-story-backdrop absolute inset-0 hidden sm:block" />
      <ThemeSurface
        theme={THEME}
        className="relative min-h-full w-full sm:min-h-0 sm:max-w-md sm:rounded-[1.75rem] sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
      >
        <form
          onSubmit={onSubmit}
          aria-busy={checking}
          className="flex flex-col gap-5 px-6 py-8 sm:px-8"
          data-testid="setup-form"
        >
          <header className="flex flex-col gap-3">
            <Kicker>{copy.ui.app_title}</Kicker>
            <DisplayTitle as="h1" size="md">
              {copy.ui.setup_title}
            </DisplayTitle>
            <p className="text-base leading-snug font-medium opacity-90">{copy.ui.setup_intro}</p>
          </header>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.url} className="text-sm font-bold">
              {copy.ui.setup_url_label}
            </label>
            <input
              id={ids.url}
              type="url"
              inputMode="url"
              autoComplete="url"
              required
              spellCheck={false}
              value={gitlabUrl}
              onChange={(e) => setGitlabUrl(e.target.value)}
              aria-describedby={`${ids.url}-hint`}
              className={field}
            />
            <p id={`${ids.url}-hint`} className="text-sm opacity-80">
              {copy.ui.setup_url_hint}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.group} className="text-sm font-bold">
              {copy.ui.setup_group_label}
            </label>
            <input
              id={ids.group}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="team/backend"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              aria-describedby={`${ids.group}-hint`}
              className={field}
            />
            <p id={`${ids.group}-hint`} className="text-sm opacity-80">
              {copy.ui.setup_group_hint}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.token} className="text-sm font-bold">
              {copy.ui.setup_token_label}
            </label>
            <div className="relative">
              <input
                id={ids.token}
                type={showToken ? 'text' : 'password'}
                autoComplete="off"
                required
                spellCheck={false}
                placeholder="glpat-…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                aria-describedby={`${ids.token}-hint`}
                className={`${field} pr-24`}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-pressed={showToken}
                className="gw-control absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-sm font-semibold hover:bg-white/10"
              >
                {showToken ? copy.ui.setup_token_hide : copy.ui.setup_token_show}
              </button>
            </div>
            <p id={`${ids.token}-hint`} className="text-sm opacity-80">
              {copy.ui.setup_token_hint}{' '}
              {tokenUrl && (
                <a
                  href={tokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[var(--card-accent)] underline underline-offset-2"
                >
                  {copy.ui.setup_token_create} ↗
                </a>
              )}
            </p>
          </div>

          <div className="flex items-start gap-3">
            <input
              id={ids.remember}
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              aria-describedby={`${ids.remember}-hint`}
              className="mt-0.5 size-5 shrink-0 accent-[var(--card-accent)]"
            />
            <div>
              <label htmlFor={ids.remember} className="text-sm font-bold">
                {copy.ui.setup_remember}
              </label>
              <p id={`${ids.remember}-hint`} className="text-sm opacity-80">
                {copy.ui.setup_remember_hint}
              </p>
            </div>
          </div>

          {status.phase === 'error' && (
            <p
              role="alert"
              data-testid="setup-error"
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#2a0fb8]"
            >
              {status.message}
            </p>
          )}
          {checking && (
            <p role="status" aria-live="polite" className="text-sm font-semibold">
              {copy.ui.setup_checking}
            </p>
          )}

          <div className="flex flex-col gap-3 pt-1">
            <button
              type="submit"
              disabled={checking}
              className="gw-control font-display w-full rounded-full bg-[var(--card-accent)] px-6 py-3.5 text-lg font-extrabold text-[#101500] transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
            >
              {copy.ui.setup_submit}
            </button>
            <button
              type="button"
              disabled={checking}
              onClick={onDemo}
              className="gw-control w-full rounded-full border-2 border-white/40 px-6 py-3 font-semibold hover:bg-white/10 disabled:opacity-60"
            >
              {copy.ui.setup_demo}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="gw-control self-center rounded-lg px-3 py-1 text-sm font-semibold underline underline-offset-2"
              >
                {copy.ui.setup_cancel}
              </button>
            )}
          </div>

          <p className="text-xs leading-snug opacity-75">🔒 {copy.ui.setup_privacy}</p>
        </form>
      </ThemeSurface>
    </div>
  );
}
