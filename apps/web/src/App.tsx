import { useEffect, useState, useSyncExternalStore } from 'react';
import type {
  CalendarStats,
  HealthResponse,
  Member,
  TeamAwards,
  WrappedStats,
} from '@git-wrapped/contracts';
import { copy } from '@git-wrapped/copy';
import { api } from './shared/api';
import { StoryDemo, StoryPlayer } from './story';
import { buildStoryCards, CardExportButton, CardsDemo } from './cards';
import { MemberPicker, OscarNight } from './team';
import { CalendarDemo, CalendarUpload } from './calendar';

/**
 * Guscio dell'app (A0): routing su hash e caricamento dati. Ogni schermata è di un altro agente.
 * Rotte: `#/` scelta del membro · `#/u/:username` storia · `#/oscar` premi.
 * Rotte di sviluppo senza API: `#/dev/story` (A6) · `#/dev/cards` (A7) · `#/dev/calendar` (A8).
 */

type Route =
  | { name: 'home' }
  | { name: 'story'; username: string }
  | { name: 'oscar' }
  | { name: 'dev-story' }
  | { name: 'dev-cards' }
  | { name: 'dev-calendar' };

function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const story = /^\/u\/([^/]+)$/.exec(path);
  if (story?.[1]) return { name: 'story', username: decodeURIComponent(story[1]) };
  if (path === '/oscar') return { name: 'oscar' };
  if (path === '/dev/story') return { name: 'dev-story' };
  if (path === '/dev/cards') return { name: 'dev-cards' };
  if (path === '/dev/calendar') return { name: 'dev-calendar' };
  return { name: 'home' };
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

const go = (path: string) => {
  window.location.hash = path;
};

function Loading() {
  const [line] = useState(() => copy.loading[Math.floor(Math.random() * copy.loading.length)]);
  return (
    <p role="status" aria-live="polite" className="grid h-full place-items-center p-6 text-center">
      {line}
    </p>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="grid h-full place-items-center gap-4 p-6 text-center">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        {copy.ui.retry}
      </button>
    </div>
  );
}

/** Carica dati asincroni con annullamento e possibilità di riprovare. */
function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [attempt, setAttempt] = useState(0);
  // Il risultato è legato alla chiave della richiesta: se cambiano le dipendenze, quello vecchio si ignora.
  const key = JSON.stringify([...deps, attempt]);
  const [state, setState] = useState<{ key?: string; data?: T; error?: string }>({});
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).then(
      (data) => setState({ key, data }),
      (err: unknown) => {
        if (!ctrl.signal.aborted) {
          setState({ key, error: err instanceof Error ? err.message : copy.ui.error_generic });
        }
      },
    );
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key ? state : {};
  return { data: current.data, error: current.error, retry: () => setAttempt((n) => n + 1) };
}

function Home({ health }: { health: HealthResponse }) {
  const members = useLoad((s) => api.members(s), []);
  if (members.error) return <ErrorView message={members.error} onRetry={members.retry} />;
  if (!members.data) return <Loading />;
  return (
    <MemberPicker
      members={members.data.members}
      year={members.data.year}
      demoMode={health.demoMode}
      onPick={(m: Member) => go(`/u/${encodeURIComponent(m.username)}`)}
      onOpenOscar={() => go('/oscar')}
    />
  );
}

function Story({ username, year }: { username: string; year: number }) {
  const wrapped = useLoad((s) => api.wrapped(username, year, s), [username, year]);
  const [calendar, setCalendar] = useState<CalendarStats | null | undefined>(undefined);
  if (wrapped.error) return <ErrorView message={wrapped.error} onRetry={wrapped.retry} />;
  if (!wrapped.data) return <Loading />;
  const stats: WrappedStats = wrapped.data;
  if (calendar === undefined) {
    return (
      <CalendarUpload
        year={stats.year}
        commits={stats.totals.commits}
        onStats={setCalendar}
        onSkip={() => setCalendar(null)}
      />
    );
  }
  const cards = buildStoryCards({ stats, calendar });
  return (
    <StoryPlayer
      label={`Git Wrapped ${stats.year} di ${stats.member.displayName}`}
      cards={cards}
      onClose={() => go('/')}
      onComplete={() => go('/oscar')}
      renderOverlay={(card) => (
        <CardExportButton card={card} fileName={`git-wrapped-${stats.year}-${card.id}`} />
      )}
    />
  );
}

function Oscar({ year }: { year: number }) {
  const team = useLoad((s) => api.team(year, s), [year]);
  if (team.error) return <ErrorView message={team.error} onRetry={team.retry} />;
  if (!team.data) return <Loading />;
  const awards: TeamAwards = team.data;
  return <OscarNight awards={awards} onBack={() => go('/')} />;
}

export function App() {
  const route = useRoute();
  const health = useLoad((s) => api.health(s), []);

  if (route.name === 'dev-story') return <StoryDemo />;
  if (route.name === 'dev-cards') return <CardsDemo />;
  if (route.name === 'dev-calendar') return <CalendarDemo />;
  if (health.error) return <ErrorView message={health.error} onRetry={health.retry} />;
  if (!health.data) return <Loading />;

  switch (route.name) {
    case 'story':
      return <Story username={route.username} year={health.data.year} />;
    case 'oscar':
      return <Oscar year={health.data.year} />;
    default:
      return <Home health={health.data} />;
  }
}
