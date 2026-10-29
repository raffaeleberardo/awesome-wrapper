import type { CalendarStats } from '@git-wrapped/contracts';
import type { WorkerRequest, WorkerResponse } from './protocol';

export const CALENDAR_TIMEZONE = 'Europe/Rome';

export interface CalendarJob {
  promise: Promise<CalendarStats>;
  cancel: () => void;
}

/** Avvia il Web Worker di parsing. Il file resta nel browser. */
export function parseCalendarFile(
  file: File,
  year: number,
  commits: number | null,
  onProgress: (fraction: number) => void,
): CalendarJob {
  const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' });
  const promise = new Promise<CalendarStats>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') return onProgress(msg.value);
      worker.terminate();
      if (msg.type === 'done') resolve(msg.stats);
      else reject(new Error(msg.message));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('Non riesco a leggere questo file di calendario.'));
    };
    const req: WorkerRequest = { file, year, commits, timezone: CALENDAR_TIMEZONE };
    worker.postMessage(req);
  });
  return { promise, cancel: () => worker.terminate() };
}
