import type { CalendarStats } from '@git-wrapped/contracts';

/** Dimensione massima del file .ics accettato (importabile dal thread principale senza ical.js). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface WorkerRequest {
  file: File;
  year: number;
  commits: number | null;
  timezone: string;
}

export type WorkerResponse =
  | { type: 'progress'; value: number }
  | { type: 'done'; stats: CalendarStats }
  | { type: 'error'; code: 'too_large' | 'invalid' | 'too_many'; message: string };
