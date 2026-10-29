import { demoActivities, demoMembers } from '@git-wrapped/fixtures';
import type { Member, RawActivity } from '@git-wrapped/contracts';
import { SourceError } from '../source';
import type { ActivitySource, GitLabSourceConfig } from '../source';
import { createCollector } from './collector';
import type { GitLabSourceOptions } from './collector';
import { toIso, yearInZone } from './time';

export type { GitLabSourceOptions } from './collector';

/** Sorgente GitLab reale. `options` serve ai test (retry, concorrenza, fuso). */
export function createGitLabSource(
  config: GitLabSourceConfig,
  options?: GitLabSourceOptions,
): ActivitySource {
  return createCollector(config, options);
}

export interface DemoData {
  members: Member[];
  activities: Record<string, RawActivity>;
}

/**
 * Sorgente demo: legge da `@git-wrapped/fixtures`, nessuna chiamata di rete.
 * Le attività sono filtrate per anno; `data` permette di iniettare dati nei test.
 * Il "proprietario del token" è il primo membro del team demo.
 */
export function createDemoSource(data?: DemoData, timeZone?: string): ActivitySource {
  const members = data?.members ?? demoMembers;
  const activities = data?.activities ?? demoActivities;
  const tz = timeZone ?? process.env['TZ'] ?? 'Europe/Rome';

  const keep = (iso: string | null | undefined, year: number): boolean => {
    const v = toIso(iso);
    return v !== null && yearInZone(v, tz) === year;
  };

  return {
    async currentUser() {
      const first = members[0];
      if (!first) throw new SourceError('upstream_error', 'Nessun membro nei dati demo');
      return { ...first };
    },
    async listMembers() {
      return members.map((m) => ({ ...m }));
    },
    async getActivity(username, year) {
      const base = activities[username];
      if (!base || !members.some((m) => m.username === username)) return null;
      return {
        ...base,
        year,
        commits: base.commits.filter((c) => keep(c.authoredAt, year)),
        mergeRequests: base.mergeRequests.filter((m) => keep(m.createdAt, year)),
        approvalsGiven: base.approvalsGiven.filter((a) => keep(a.approvedAt, year)),
        pipelines: base.pipelines.filter((p) => keep(p.createdAt, year)),
        deployments: base.deployments.filter((d) => keep(d.createdAt, year)),
        notes: base.notes.filter((n) => keep(n.createdAt, year)),
        emojiGiven: base.emojiGiven.filter((e) => keep(e.awardedAt, year)),
        emojiReceived: base.emojiReceived.filter((e) => keep(e.awardedAt, year)),
        issueEvents: base.issueEvents.filter((e) => keep(e.at, year)),
        pushEvents: base.pushEvents.filter((e) => keep(e.at, year)),
      };
    },
  };
}
