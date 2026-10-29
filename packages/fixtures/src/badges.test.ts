import { describe, expect, it } from 'vitest';
import type { RawActivity } from '@git-wrapped/contracts';
import { demoActivities, demoMembers } from './index';

/**
 * Verifica dei profili demo con calcoli semplici, senza il motore delle statistiche.
 * Soglie da `packages/stats/BADGES.md` (A3). Per ogni badge: almeno una persona supera la
 * soglia con margine (almeno il doppio) e, dove previsto, le altre restano sotto.
 */

const DAY_MS = 86_400_000;

interface Row {
  username: string;
  a: RawActivity;
}

const rows: Row[] = demoMembers.map((m) => {
  const a = demoActivities[m.username];
  if (!a) throw new Error(`attività mancante per ${m.username}`);
  return { username: m.username, a };
});

/** Ora e minuto locali leggendo la parte locale dell'ISO (già nel fuso di Roma). */
const minuteOfDay = (iso: string): number =>
  Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
const hourOf = (iso: string): number => Number(iso.slice(11, 13));
const weekdayOf = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return (new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay() + 6) % 7; // 0 = lunedì
};
const avg = (xs: number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const unique = (xs: string[]): string[] => [...new Set(xs)];

/** Quante persone superano la soglia, e il valore massimo. */
function hitsAbove(metric: (r: Row) => number, threshold: number): { hits: string[]; max: number } {
  const values = rows.map((r) => ({ username: r.username, value: metric(r) }));
  return {
    hits: values.filter((v) => v.value >= threshold).map((v) => v.username),
    max: Math.max(...values.map((v) => v.value)),
  };
}

describe('badge: calcoli semplici sui dati demo', () => {
  it('night_owl: almeno il 20% dei commit tra le 22:00 e le 04:59, minimo 20 commit', () => {
    const share = (r: Row) => {
      const commits = r.a.commits;
      if (commits.length < 20) return 0;
      return (
        commits.filter((c) => {
          const h = hourOf(c.authoredAt);
          return h >= 22 || h < 5;
        }).length / commits.length
      );
    };
    const { hits, max } = hitsAbove(share, 0.2);
    expect(hits).toEqual(['elena.costa']);
    expect(max).toBeGreaterThanOrEqual(0.4);
  });

  it('early_bird: almeno il 20% dei commit tra le 05:00 e le 08:29, minimo 20 commit', () => {
    const share = (r: Row) => {
      const commits = r.a.commits;
      if (commits.length < 20) return 0;
      return (
        commits.filter((c) => {
          const m = minuteOfDay(c.authoredAt);
          return m >= 300 && m < 510;
        }).length / commits.length
      );
    };
    const { hits, max } = hitsAbove(share, 0.2);
    expect(hits).toEqual(['andrea.galli']);
    expect(max).toBeGreaterThanOrEqual(0.4);
  });

  it('main_breaker: almeno 5 pipeline fallite sul branch di default', () => {
    const failed = (r: Row) =>
      r.a.pipelines.filter((p) => p.isDefaultBranch && p.status === 'failed').length;
    const { hits, max } = hitsAbove(failed, 5);
    expect(hits).toEqual(['marco.vitale']);
    expect(max).toBeGreaterThanOrEqual(10);
  });

  it('blind_approver: almeno 3 approvazioni entro 5 minuti su MR con almeno 300 righe', () => {
    const blind = (r: Row) =>
      r.a.approvalsGiven.filter(
        (x) =>
          Date.parse(x.approvedAt) - Date.parse(x.mrCreatedAt) <= 5 * 60_000 &&
          (x.mrChangedLines ?? 0) >= 300,
      ).length;
    const { hits, max } = hitsAbove(blind, 3);
    expect(hits).toEqual(['luca.moretti']);
    expect(max).toBeGreaterThanOrEqual(6);
  });

  it('novelist: messaggi di commit medi ≥ 120 caratteri (min 10 commit) o note con bodyLength medio ≥ 400', () => {
    const avgMessage = (r: Row) =>
      r.a.commits.length >= 10 ? avg(r.a.commits.map((c) => c.message.length)) : 0;
    const avgNote = (r: Row) =>
      r.a.notes.length >= 10 ? avg(r.a.notes.map((n) => n.bodyLength)) : 0;
    const byCommits = hitsAbove(avgMessage, 120);
    const byNotes = hitsAbove(avgNote, 400);
    expect(unique([...byCommits.hits, ...byNotes.hits])).toEqual(['davide.rinaldi']);
    expect(byCommits.max).toBeGreaterThanOrEqual(240);
    expect(byNotes.max).toBeGreaterThanOrEqual(400);
  });

  it('silent_monk: stessa persona con messaggi medi ≤ 15 caratteri, ≥ 60% MR senza descrizione e nessuna nota scritta', () => {
    const matching = rows.filter((r) => {
      const commits = r.a.commits;
      if (commits.length < 20) return false;
      const avgLen = avg(commits.map((c) => c.message.length));
      const mrs = r.a.mergeRequests;
      const emptyShare = mrs.length
        ? mrs.filter((m) => m.descriptionLength === 0).length / mrs.length
        : 0;
      return avgLen <= 15 && emptyShare >= 0.6 && r.a.notes.length === 0;
    });
    expect(matching.map((r) => r.username)).toEqual(['andrea.galli']);
    const andrea = rows.find((r) => r.username === 'andrea.galli');
    expect(avg(andrea?.a.commits.map((c) => c.message.length) ?? [])).toBeLessThanOrEqual(7.5);
  });

  it('ghost_mr: almeno 2 MR chiuse senza merge o aperte e ferme da più di 30 giorni a fine anno', () => {
    const ghosts = (r: Row) =>
      r.a.mergeRequests.filter((m) => {
        if (m.state === 'closed' && m.mergedAt === null) return true;
        const yearEnd = Date.parse('2026-12-31T23:59:59+01:00');
        return m.state === 'opened' && yearEnd - Date.parse(m.updatedAt) > 30 * DAY_MS;
      }).length;
    const { hits, max } = hitsAbove(ghosts, 2);
    expect(hits).toEqual(['sara.bianchi']);
    expect(max).toBeGreaterThanOrEqual(4);
  });

  it('lives_dangerously: almeno 3 deploy di venerdì dalle 16:00 in poi', () => {
    const friday = (r: Row) =>
      r.a.deployments.filter((d) => weekdayOf(d.createdAt) === 4 && hourOf(d.createdAt) >= 16)
        .length;
    const { hits, max } = hitsAbove(friday, 3);
    expect(hits).toEqual(['marco.vitale']);
    expect(max).toBeGreaterThanOrEqual(6);
  });

  it('marie_kondo: righe cancellate ≥ 1,2 × aggiunte (min 500 cambiate) oppure ≥ 15 push di cancellazione', () => {
    const byLines = (r: Row) => {
      const added = r.a.commits.reduce((s, c) => s + c.additions, 0);
      const deleted = r.a.commits.reduce((s, c) => s + c.deletions, 0);
      return added + deleted >= 500 && added > 0 ? deleted / added : 0;
    };
    const byPushes = (r: Row) => r.a.pushEvents.filter((p) => p.action === 'deleted').length;
    const lines = hitsAbove(byLines, 1.2);
    const pushes = hitsAbove(byPushes, 15);
    expect(unique([...lines.hits, ...pushes.hits])).toEqual(['chiara.esposito']);
    expect(lines.max).toBeGreaterThanOrEqual(2.4);
    expect(pushes.max).toBeGreaterThanOrEqual(30);
  });

  it('todo_collector: somma di todosAdded − todosRemoved ≥ 10', () => {
    const net = (r: Row) => r.a.commits.reduce((s, c) => s + c.todosAdded - c.todosRemoved, 0);
    const { hits, max } = hitsAbove(net, 10);
    expect(hits).toEqual(['giulia.ferri']);
    expect(max).toBeGreaterThanOrEqual(20);
  });

  it('necromancer: issue riaperte dopo più di 180 giorni, e/o commit su progetti fermi da più di 365 giorni', () => {
    const reopened = (r: Row) =>
      r.a.issueEvents.filter(
        (i) =>
          i.action === 'reopened' &&
          i.previouslyClosedAt !== null &&
          Date.parse(i.at) - Date.parse(i.previouslyClosedAt) > 180 * DAY_MS,
      ).length;
    const dormantCommits = (r: Row) => {
      const dormant = new Map(r.a.projects.map((p) => [p.path, p.lastActivityBeforeYearAt]));
      return r.a.commits.filter((c) => {
        const last = dormant.get(c.projectPath);
        return (
          last !== null &&
          last !== undefined &&
          Date.parse(c.authoredAt) - Date.parse(last) > 365 * DAY_MS
        );
      }).length;
    };
    const byIssues = hitsAbove(reopened, 1);
    const byCommits = hitsAbove(dormantCommits, 1);
    expect(unique([...byIssues.hits, ...byCommits.hits])).toEqual(['chiara.esposito']);
    expect(byIssues.max).toBeGreaterThanOrEqual(2);
    expect(byCommits.max).toBeGreaterThanOrEqual(2);
  });

  it('polyglot: almeno 4 estensioni di linguaggio, ciascuna ≥ 5% dei file toccati', () => {
    const shares = (r: Row) => {
      const counts = new Map<string, number>();
      for (const c of r.a.commits) {
        for (const f of c.files) {
          const ext = f.slice(f.lastIndexOf('.') + 1);
          counts.set(ext, (counts.get(ext) ?? 0) + 1);
        }
      }
      const total = [...counts.values()].reduce((s, x) => s + x, 0);
      return [...counts.values()].map((x) => x / total);
    };
    const count = (r: Row) => shares(r).filter((s) => s >= 0.05).length;
    const { hits } = hitsAbove(count, 4);
    expect(hits).toEqual(['sara.bianchi']);
    expect(
      Math.min(
        ...shares(rows.find((r) => r.username === 'sara.bianchi') ?? rows[0] ?? ({} as Row)),
      ),
    ).toBeGreaterThanOrEqual(0.1);
  });

  it('emoji_overlord: almeno 150 emoji dati', () => {
    const given = (r: Row) => r.a.emojiGiven.length;
    const { hits, max } = hitsAbove(given, 150);
    expect(hits).toEqual(['luca.moretti']);
    expect(max).toBeGreaterThanOrEqual(300);
  });
});

describe('personalità: un segnale riconoscibile per ciascuna delle 8', () => {
  const byUser = (username: string): RawActivity => {
    const a = demoActivities[username];
    if (!a) throw new Error(`attività mancante per ${username}`);
    return a;
  };

  it('architect: MR grandi e molti file per commit', () => {
    const a = byUser('giulia.ferri');
    expect(avg(a.commits.map((c) => c.files.length))).toBeGreaterThanOrEqual(5);
    expect(avg(a.mergeRequests.map((m) => m.changedLines ?? 0))).toBeGreaterThanOrEqual(300);
  });

  it('firefighter: fix e hotfix frequenti, pipeline sul default branch', () => {
    const a = byUser('marco.vitale');
    const fixes =
      a.commits.filter((c) => /^(hotfix|fix)/.test(c.message)).length / a.commits.length;
    const main = a.pipelines.filter((p) => p.isDefaultBranch).length / a.pipelines.length;
    expect(fixes).toBeGreaterThanOrEqual(0.4);
    expect(main).toBeGreaterThanOrEqual(0.4);
  });

  it('gardener: cancella molto più di quanto aggiunge', () => {
    const a = byUser('chiara.esposito');
    const added = a.commits.reduce((s, c) => s + c.additions, 0);
    const deleted = a.commits.reduce((s, c) => s + c.deletions, 0);
    expect(deleted / added).toBeGreaterThanOrEqual(1.8);
  });

  it('diplomat: molte approvazioni e note verso colleghi', () => {
    const a = byUser('luca.moretti');
    expect(a.approvalsGiven.length).toBeGreaterThanOrEqual(120);
    expect(a.notes.length).toBeGreaterThanOrEqual(100);
  });

  it('sprinter: tanti commit piccoli e ravvicinati', () => {
    const a = byUser('sara.bianchi');
    const activeDays = new Set(a.commits.map((c) => c.authoredAt.slice(0, 10))).size;
    expect(a.commits.length / activeDays).toBeGreaterThanOrEqual(2.5);
    expect(avg(a.commits.map((c) => c.additions))).toBeLessThanOrEqual(25);
  });

  it('philosopher: messaggi lunghissimi', () => {
    const a = byUser('davide.rinaldi');
    expect(avg(a.commits.map((c) => c.message.length))).toBeGreaterThanOrEqual(200);
  });

  it('night_creature: lavora quasi solo di notte', () => {
    const a = byUser('elena.costa');
    const night = a.commits.filter(
      (c) => hourOf(c.authoredAt) >= 22 || hourOf(c.authoredAt) < 5,
    ).length;
    expect(night / a.commits.length).toBeGreaterThanOrEqual(0.6);
  });

  it('metronome: sempre alla stessa fascia oraria', () => {
    const a = byUser('andrea.galli');
    const minutes = a.commits.map((c) => minuteOfDay(c.authoredAt));
    const mean = avg(minutes);
    const deviation = Math.sqrt(avg(minutes.map((m) => (m - mean) ** 2)));
    expect(deviation).toBeLessThanOrEqual(60);
  });
});
