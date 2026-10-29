import { Writable } from 'node:stream';
import { vi } from 'vitest';
import {
  exampleMembersResponse,
  exampleRawActivity,
  exampleTeamAwards,
  exampleWrappedStats,
} from '@git-wrapped/contracts/examples';
import type { Member, RawActivity } from '@git-wrapped/contracts';
import type { AppConfig } from '../src/config';
import { createLogger } from '../src/logger';
import { buildServer, type ComputeFns } from '../src/server';
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

/** Sorgente fake costruita sugli esempi dei contratti. */
export function makeSource(overrides: Partial<ActivitySource> = {}) {
  const members: Member[] = exampleMembersResponse.members;
  const defaults: ActivitySource = {
    listMembers: async () => members,
    getActivity: async (username, year): Promise<RawActivity | null> => {
      const member = members.find((m) => m.username === username);
      return member ? { ...exampleRawActivity, year, member } : null;
    },
  };
  return {
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
    computeTeamAwards: vi.fn((_stats, year: number) => ({ ...exampleTeamAwards, year })),
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
  opts: { source?: ReturnType<typeof makeSource>; config?: Partial<AppConfig> } = {},
) {
  const source = opts.source ?? makeSource();
  const compute = makeCompute();
  const sink = makeLogSink();
  const app = buildServer({
    source,
    compute,
    config: { ...testConfig, ...opts.config },
    logger: createLogger('info', sink.stream),
  });
  return { app, source, compute, sink };
}
