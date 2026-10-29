import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { CalendarStats } from '@git-wrapped/contracts';
import { copy } from '@git-wrapped/copy';
import type { CalendarUploadProps } from '../shared/types';
import { MAX_FILE_BYTES } from './protocol';
import { parseCalendarFile, type CalendarJob } from './worker-client';

type State =
  | { phase: 'idle' }
  | { phase: 'parsing'; progress: number; fileName: string }
  | { phase: 'error'; message: string };

/** Caricamento del calendario .ics: il file viene letto solo nel browser (Web Worker). */
export function CalendarUpload({ year, commits, onStats, onSkip }: CalendarUploadProps) {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const jobRef = useRef<CalendarJob | null>(null);

  useEffect(() => () => jobRef.current?.cancel(), []);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setState({
        phase: 'error',
        message: `Il file è troppo grande (massimo ${MAX_FILE_BYTES / 1024 / 1024} MB).`,
      });
      return;
    }
    setState({ phase: 'parsing', progress: 0, fileName: file.name });
    jobRef.current?.cancel();
    const job = parseCalendarFile(file, year, commits, (progress) =>
      setState((s) => (s.phase === 'parsing' ? { ...s, progress } : s)),
    );
    jobRef.current = job;
    job.promise.then(
      (stats: CalendarStats) => {
        if (jobRef.current === job) onStats(stats);
      },
      (err: unknown) => {
        if (jobRef.current !== job) return;
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : copy.ui.calendar_error,
        });
      },
    );
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const parsing = state.phase === 'parsing';

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4 p-6" aria-labelledby="cal-title">
      <h2 id="cal-title" className="text-2xl font-bold">
        {copy.ui.calendar_upload_title}
      </h2>
      <p className="text-sm opacity-80">{copy.ui.calendar_upload_hint}</p>
      <p
        data-testid="calendar-privacy-note"
        className="rounded-lg border border-current/30 bg-black/5 p-3 text-sm font-medium"
      >
        {copy.ui.calendar_privacy_note}
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label={copy.ui.calendar_upload_title}
        aria-disabled={parsing}
        onClick={() => !parsing && inputRef.current?.click()}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center outline-offset-4 focus-visible:outline-2 ${
          dragging ? 'bg-black/10' : 'bg-black/5'
        }`}
      >
        <span className="font-medium">.ics</span>
        <input
          ref={inputRef}
          type="file"
          accept=".ics,text/calendar"
          data-testid="calendar-file-input"
          aria-label=".ics"
          disabled={parsing}
          tabIndex={-1}
          className="sr-only"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {parsing && (
        <div role="status" aria-live="polite" data-testid="calendar-parsing">
          <p className="text-sm">
            {copy.ui.calendar_parsing} ({state.fileName})
          </p>
          <progress
            className="w-full"
            max={100}
            value={Math.round(state.progress * 100)}
            aria-label={copy.ui.calendar_parsing}
          />
        </div>
      )}
      {state.phase === 'error' && (
        <p role="alert" data-testid="calendar-error" className="font-medium text-red-700">
          {copy.ui.calendar_error} {state.message}
        </p>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="self-start rounded-lg border px-4 py-2 font-medium"
      >
        {copy.ui.calendar_skip}
      </button>
    </section>
  );
}

/** Caricamento isolato, servito su `#/dev/calendar` per sviluppo e test (mostra le stats calcolate). */
export function CalendarDemo() {
  const [stats, setStats] = useState<CalendarStats | null | 'skipped'>(null);
  return (
    <main>
      <CalendarUpload
        year={2026}
        commits={1200}
        onStats={setStats}
        onSkip={() => setStats('skipped')}
      />
      {stats === 'skipped' && <p className="p-6">Calendario saltato.</p>}
      {stats && stats !== 'skipped' && (
        <pre data-testid="calendar-stats" className="mx-auto max-w-xl overflow-auto p-6 text-xs">
          {JSON.stringify(stats, null, 2)}
        </pre>
      )}
    </main>
  );
}
