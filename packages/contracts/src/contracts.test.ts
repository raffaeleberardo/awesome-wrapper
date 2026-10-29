import { describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  apiPaths,
  calendarEventSchema,
  calendarStatsSchema,
  copyCatalogSchema,
  healthResponseSchema,
  meResponseSchema,
  rawActivitySchema,
  wrappedStatsSchema,
  yearQuerySchema,
} from './index';
import * as ex from './examples';

describe('esempi dei contratti', () => {
  it.each([
    ['RawActivity', rawActivitySchema, ex.exampleRawActivity],
    ['WrappedStats', wrappedStatsSchema, ex.exampleWrappedStats],
    ['CalendarEvent', calendarEventSchema, ex.exampleCalendarEvent],
    ['CalendarStats', calendarStatsSchema, ex.exampleCalendarStats],
    ['HealthResponse', healthResponseSchema, ex.exampleHealthResponse],
    ['MeResponse', meResponseSchema, ex.exampleWrappedStats],
    ['ApiError', apiErrorSchema, ex.exampleApiError],
  ] as const)('%s è valido', (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });
});

describe('regole dei contratti', () => {
  it('rifiuta istogrammi orari di lunghezza sbagliata', () => {
    const bad = { ...ex.exampleWrappedStats, hours: [1, 2, 3] };
    expect(wrappedStatsSchema.safeParse(bad).success).toBe(false);
  });

  it('il catalogo dei testi richiede ogni badge', () => {
    const result = copyCatalogSchema.shape.badges.safeParse({
      night_owl: { title: 'Gufo notturno', description: 'x' },
    });
    expect(result.success).toBe(false);
  });

  it('ammette i codici di errore del token', () => {
    for (const code of ['unauthorized', 'bot_token'] as const) {
      expect(apiErrorSchema.safeParse({ error: { code, message: 'x' } }).success).toBe(true);
    }
  });

  it('converte la query year', () => {
    expect(yearQuerySchema.parse({ year: '2026' })).toEqual({ year: 2026 });
    expect(yearQuerySchema.parse({})).toEqual({});
    expect(yearQuerySchema.safeParse({ year: 'abc' }).success).toBe(false);
  });

  it('costruisce i percorsi API', () => {
    expect(apiPaths.health()).toBe('/api/health');
    expect(apiPaths.me()).toBe('/api/me');
    expect(apiPaths.me(2026)).toBe('/api/me?year=2026');
  });
});
