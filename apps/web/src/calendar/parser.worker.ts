/// <reference lib="webworker" />
import { computeCalendarStats } from '@git-wrapped/stats/calendar';
import { CalendarParseError, parseIcs } from './parse';
import { MAX_FILE_BYTES, type WorkerRequest, type WorkerResponse } from './protocol';

/**
 * Web Worker del calendario. PRIVACY: nessuna richiesta di rete (niente fetch, XHR, WebSocket,
 * sendBeacon, import dinamici). Legge il `File` ricevuto, lo elabora in memoria e risponde solo
 * con `CalendarStats` (numeri e date), mai con testi del calendario.
 */

const post = (msg: WorkerResponse) => self.postMessage(msg);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { file, year, commits, timezone } = e.data;
  try {
    if (file.size > MAX_FILE_BYTES) {
      throw new CalendarParseError('too_large', 'Il file supera la dimensione massima consentita.');
    }
    const text = await file.text();
    let last = 0;
    const events = parseIcs(text, year, {
      timezone,
      onProgress: (f) => {
        if (f - last >= 0.02 || f === 1) {
          last = f;
          post({ type: 'progress', value: f });
        }
      },
    });
    post({ type: 'done', stats: computeCalendarStats(events, year, { timezone, commits }) });
  } catch (err) {
    const known = err instanceof CalendarParseError;
    post({
      type: 'error',
      code: known ? err.code : 'invalid',
      message: known ? err.message : 'Non riesco a leggere questo file di calendario.',
    });
  }
};
