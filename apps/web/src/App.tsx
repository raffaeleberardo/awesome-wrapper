import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CalendarStats, HealthResponse, WrappedStats } from '@git-wrapped/contracts';
import { copy } from '@git-wrapped/copy';
import { api, ApiRequestError } from './shared/api';
import { LoadingScreen } from './shared/LoadingScreen';
import { loadSettings, SetupScreen } from './setup';
import { StoryDemo, StoryPlayer } from './story';
import { buildStoryCards, CardExportButton, CardsDemo } from './cards';
import { CalendarDemo, CalendarUpload } from './calendar';

/**
 * Guscio dell'app (A0): routing su hash e caricamento dati. Ogni schermata è di un altro agente.
 * L'app mostra solo il wrapped del proprietario del token GitLab (`GET /api/me`): ogni rotta che
 * non è di sviluppo apre il suo percorso, impostazioni (se mancano) → calendario (facoltativo) → storia.
 * Rotte di sviluppo senza API: `#/dev/story` (A6) · `#/dev/cards` (A7) · `#/dev/calendar` (A8).
 */

type Route =
  { name: 'main' } | { name: 'dev-story' } | { name: 'dev-cards' } | { name: 'dev-calendar' };

function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/dev/story') return { name: 'dev-story' };
  if (path === '/dev/cards') return { name: 'dev-cards' };
  if (path === '/dev/calendar') return { name: 'dev-calendar' };
  return { name: 'main' };
}

function useRoute(): Route {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb);
      return () => window.removeEventListener('hashchange', cb);
    },
    () => window.location.hash,
  );
  return parseRoute(hash);
}

/** Errori di configurazione: riprovare non serve, bisogna cambiare URL, gruppo o token. */
const SETTINGS_ERRORS: ReadonlySet<string> = new Set([
  'unauthorized',
  'bot_token',
  'not_configured',
]);

interface LoadError {
  message: string;
  code?: string;
}

function ErrorView({
  error,
  onRetry,
  onChangeSettings,
}: {
  error: LoadError;
  onRetry: () => void;
  onChangeSettings?: () => void;
}) {
  const settingsError = error.code !== undefined && SETTINGS_ERRORS.has(error.code);
  return (
    <div role="alert" className="grid h-full place-items-center gap-4 p-6 text-center">
      <div className="grid max-w-md gap-4">
        <p className="text-lg font-semibold">{error.message}</p>
        {settingsError && <p className="text-sm opacity-80">{copy.ui.error_token_hint}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          {onChangeSettings && (
            <button
              type="button"
              onClick={onChangeSettings}
              className="gw-control rounded-full bg-[#d4ff3a] px-5 py-2.5 font-bold text-[#101500]"
            >
              {copy.ui.change_settings}
            </button>
          )}
          {!settingsError && (
            <button
              type="button"
              onClick={onRetry}
              className="gw-control rounded-full border-2 border-white/40 px-5 py-2.5 font-semibold"
            >
              {copy.ui.retry}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Carica dati asincroni con annullamento e possibilità di riprovare. */
function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [attempt, setAttempt] = useState(0);
  // Il risultato è legato alla chiave della richiesta: se cambiano le dipendenze, quello vecchio si ignora.
  const key = JSON.stringify([...deps, attempt]);
  const [state, setState] = useState<{ key?: string; data?: T; error?: LoadError }>({});
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).then(
      (data) => setState({ key, data }),
      (err: unknown) => {
        if (!ctrl.signal.aborted) {
          const error: LoadError =
            err instanceof ApiRequestError
              ? { message: err.message, code: err.code }
              : { message: err instanceof Error ? err.message : copy.ui.error_generic };
          setState({ key, error });
        }
      },
    );
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key ? state : {};
  return { data: current.data, error: current.error, retry: () => setAttempt((n) => n + 1) };
}

function DemoBanner() {
  return (
    <p
      role="status"
      className="mx-auto mt-4 max-w-xl rounded-xl bg-[#c6ff3d] px-4 py-2 font-bold text-[#111]"
    >
      {copy.ui.demo_mode_banner}
    </p>
  );
}

/**
 * Percorso dell'utente del token: calendario (facoltativo) → storia → fine.
 * Chiudere la storia riporta al calendario; arrivare in fondo mostra la fine con «ricomincia».
 */
function MyWrapped({
  health,
  stats,
  onChangeSettings,
}: {
  health: HealthResponse;
  stats: WrappedStats;
  onChangeSettings: () => void;
}) {
  const [calendar, setCalendar] = useState<CalendarStats | null | undefined>(undefined);
  const [step, setStep] = useState<'story' | 'end'>('story');
  // Cambia a ogni ripartenza: rimonta il player dalla prima card.
  const [run, setRun] = useState(0);

  if (calendar === undefined) {
    return (
      <div className="h-full overflow-y-auto">
        {health.demoMode ? <DemoBanner /> : null}
        <header className="mx-auto flex max-w-xl flex-wrap items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h1 className="font-display text-4xl font-black">
              {copy.ui.app_title} {stats.year}
            </h1>
            <p className="opacity-80">{copy.ui.app_tagline}</p>
          </div>
          <button
            type="button"
            onClick={onChangeSettings}
            className="gw-control rounded-full border-2 border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            {copy.ui.change_settings}
          </button>
        </header>
        <CalendarUpload
          year={stats.year}
          commits={stats.totals.commits}
          onStats={(c) => {
            setCalendar(c);
            setStep('story');
          }}
          onSkip={() => {
            setCalendar(null);
            setStep('story');
          }}
        />
      </div>
    );
  }

  if (step === 'end') {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="grid gap-4">
          <p className="text-xl font-bold">{copy.ui.story_end}</p>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setRun((n) => n + 1);
              setStep('story');
            }}
            className="justify-self-center rounded-lg border px-4 py-2 font-medium"
          >
            {copy.ui.restart}
          </button>
        </div>
      </div>
    );
  }

  const cards = buildStoryCards({ stats, calendar });
  return (
    <StoryPlayer
      key={run}
      label={`Git Wrapped ${stats.year} di ${stats.member.displayName}`}
      cards={cards}
      onClose={() => setCalendar(undefined)}
      onComplete={() => setStep('end')}
      renderOverlay={(card) => (
        <CardExportButton card={card} fileName={`git-wrapped-${stats.year}-${card.id}`} />
      )}
    />
  );
}

export function App() {
  const route = useRoute();
  // Le rotte di sviluppo funzionano senza API: niente richiesta a /api/health.
  if (route.name === 'dev-story') return <StoryDemo />;
  if (route.name === 'dev-cards') return <CardsDemo />;
  if (route.name === 'dev-calendar') return <CalendarDemo />;
  return <MainApp />;
}

/**
 * Impostazioni → wrapped. Senza impostazioni (né `.env` né schermata) si apre la schermata
 * iniziale; con un token ricordato nel browser la schermata lo prova da sola.
 */
function MainApp() {
  // Cambia a ogni nuova impostazione: ricarica salute e wrapped da capo.
  const [generation, setGeneration] = useState(0);
  const [editing, setEditing] = useState(false);
  const health = useLoad((s) => api.health(s), [generation]);

  if (health.error) return <ErrorView error={health.error} onRetry={health.retry} />;
  if (!health.data) return null;

  if (!health.data.configured || editing) {
    const saved = loadSettings();
    return (
      <SetupScreen
        key={generation}
        saved={saved}
        autoSubmit={!editing}
        onConfigured={() => {
          setEditing(false);
          setGeneration((n) => n + 1);
        }}
        onCancel={health.data.configured ? () => setEditing(false) : undefined}
      />
    );
  }
  return (
    <Wrapped key={generation} health={health.data} onChangeSettings={() => setEditing(true)} />
  );
}

/** Wrapped dell'utente: schermata di attesa con percentuale, poi calendario e storia. */
function Wrapped({
  health,
  onChangeSettings,
}: {
  health: HealthResponse;
  onChangeSettings: () => void;
}) {
  // L'anno è quello di default del server (`WRAPPED_YEAR`).
  const me = useLoad((s) => api.me(undefined, s), []);
  // La schermata di attesa mostra il 100% prima di lasciare il posto al wrapped.
  const [revealed, setRevealed] = useState(false);

  if (me.error) {
    return <ErrorView error={me.error} onRetry={me.retry} onChangeSettings={onChangeSettings} />;
  }
  if (!me.data || !revealed) {
    return <LoadingScreen done={me.data !== undefined} onFinished={() => setRevealed(true)} />;
  }
  return <MyWrapped health={health} stats={me.data} onChangeSettings={onChangeSettings} />;
}
