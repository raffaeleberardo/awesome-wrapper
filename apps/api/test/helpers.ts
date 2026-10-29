import { Writable } from 'node:stream';
import { vi } from 'vitest';
import { exampleRawActivity, exampleWrappedStats } from '@git-wrapped/contracts/examples';
import type { Member, RawActivity } from '@git-wrapped/contracts';
import type { AppConfig } from '../src/config';
import { createLogger } from '../src/logger';
import { buildServer, type ComputeFns, type ServerDeps } from '../src/server';
import type { ActivitySource } from '../src/source';

export const testConfig: AppConfig = {
  demoMode: true,
  gitlabUrl: 'https://gitlab.example.test',
  gitlabToken: '',
  gitlabGroup: '',
  year: 2026,
  timezone: 'Europe/Rome',
  cacheTtlMinutes: 15,
  gitlabCaCert: undefined,
};

/** Proprietario del token nei test. */
export const testUser: Member = { username: 'giulia.ferri', displayName: 'Giulia Ferri' };
/** Membri finti dei gruppi, proprietario del token compreso. */
export const testMembers: Member[] = [
  testUser,
  { username: 'marco.vitale', displayName: 'Marco Vitale' },
];

/** Sorgente fake costruita sugli esempi dei contratti. */
export function makeSource(overrides: Partial<ActivitySource> = {}) {
  const members = testMembers;
  const defaults: ActivitySource = {
    currentUser: async () => ({ ...testUser }),
    listMembers: async () => members,
    getActivity: async (username, year): Promise<RawActivity | null> => {
      const member = members.find((m) => m.username === username);
      return member ? { ...exampleRawActivity, year, member } : null;
    },
  };
  return {
    currentUser: vi.fn<ActivitySource['currentUser']>(
      overrides.currentUser ?? defaults.currentUser,
    ),
    listMembers: vi.fn<ActivitySource['listMembers']>(
      overrides.listMembers ?? defaults.listMembers,
    ),
    getActivity: vi.fn<ActivitySource['getActivity']>(
      overrides.getActivity ?? defaults.getActivity,
    ),
  };
}

export function makeCompute() {
  return {
    computeWrappedStats: vi.fn((raw: RawActivity) => ({
      ...exampleWrappedStats,
      member: raw.member,
      year: raw.year,
    })),
  } satisfies ComputeFns;
}

/** Cattura le righe di log pino in memoria. */
export function makeLogSink() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, stream };
}

export function makeApp(
  opts: {
    source?: ReturnType<typeof makeSource>;
    /** Nessuna sorgente iniziale: l'app aspetta la schermata iniziale. */
    unconfigured?: boolean;
    createSource?: ServerDeps['createSource'];
    config?: Partial<AppConfig>;
  } = {},
) {
  const source = opts.source ?? makeSource();
  const createSource = vi.fn<ServerDeps['createSource']>(opts.createSource ?? (() => makeSource()));
  const compute = makeCompute();
  const sink = makeLogSink();
  const app = buildServer({
    source: opts.unconfigured ? null : source,
    createSource,
    compute,
    config: { ...testConfig, ...opts.config },
    logger: createLogger('info', sink.stream),
  });
  return { app, source, createSource, compute, sink };
}
