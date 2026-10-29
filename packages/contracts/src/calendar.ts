import { z } from 'zod';
import {
  count,
  hourHistogram,
  isoDate,
  isoDateTime,
  ratio,
  weekdayHistogram,
  year,
} from './common';

/**
 * Evento di calendario normalizzato, prodotto dal parser .ics nel Web Worker.
 * Non contiene oggetto, descrizione, luogo né partecipanti: solo metadati.
 * Esiste solo nel browser.
 */
export const calendarEventSchema = z.object({
  start: isoDateTime,
  end: isoDateTime,
  isAllDay: z.boolean(),
  /** Numero di partecipanti (organizzatore incluso). */
  attendeeCount: count,
  /** Rilevato da un link `teams.microsoft.com` in descrizione, luogo o proprietà X-MICROSOFT-*. */
  isTeamsCall: z.boolean(),
  /** `true` se l'occorrenza deriva da una regola RRULE. */
  isRecurring: z.boolean(),
  /** `true` se l'utente ha rifiutato l'invito (PARTSTAT=DECLINED) o l'evento è CANCELLED. */
  declined: z.boolean(),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

/** Statistiche del calendario. Calcolate e mostrate solo nel browser, mai inviate al server. */
export const calendarStatsSchema = z.object({
  schemaVersion: z.literal(1),
  year,
  /** Riunioni accettate o senza risposta, esclusi gli eventi tutto il giorno. */
  meetings: count,
  meetingHours: z.number().nonnegative(),
  declinedInvites: count,
  longestMeeting: z.object({ minutes: count, date: isoDate }).nullable(),
  mostCrowded: z.object({ attendees: count, date: isoDate }).nullable(),
  /** Serie più lunga di riunioni consecutive con al massimo 5 minuti di pausa. */
  longestBackToBack: z.object({ meetings: count, date: isoDate }).nullable(),
  /** Riunioni di venerdì che iniziano dalle 14:00 in poi. */
  fridayAfternoonMeetings: count,
  /** Quota di riunioni che sono call Teams; `null` se nessuna riunione. */
  teamsCallShare: ratio.nullable(),
  recurringShare: ratio.nullable(),
  hours: hourHistogram,
  weekdays: weekdayHistogram,
  /** Riunioni per commit nell'anno; `null` se i commit non sono noti o sono zero. */
  meetingsPerCommit: z.number().nonnegative().nullable(),
});
export type CalendarStats = z.infer<typeof calendarStatsSchema>;
