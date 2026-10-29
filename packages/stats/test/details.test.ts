import { describe, expect, it } from 'vitest';
import { computeWrappedStats } from '../src/index';
import { languageOf } from '../src/languages';
import { hasEmoji, isFixMessage, isWipMessage, wordsOf } from '../src/messages';
import {
  activity,
  ada,
  approval,
  bruno,
  carla,
  commit,
  commits,
  dario,
  deployment,
  emojiGiven,
  emojiReceived,
  fridayDay,
  mr,
  note,
  pipeline,
  project,
  team,
  times,
  winter,
} from './builders';

const stats = (raw: Parameters<typeof computeWrappedStats>[0], members = team) =>
  computeWrappedStats(raw, members);

describe('repo e file più toccati', () => {
  it('ordina per conteggio, poi per nome, con quote ≤ 1', () => {
    const raw = activity({
      commits: [
        ...commits(3, { projectPath: 'acme/b', files: ['x.ts', 'x.ts', 'y.ts'] }),
        ...commits(3, { projectPath: 'acme/a', files: ['x.ts'] }),
        commit(winter(50), { projectPath: 'acme/c', files: ['z.ts'], isMerge: true }),
      ],
    });
    const s = stats(raw);
    expect(s.topProjects.map((p) => p.projectPath)).toEqual(['acme/a', 'acme/b', 'acme/c']);
    expect(s.topProjects[0]?.share).toBe(0.428);
    expect(s.topFiles[0]).toEqual({ path: 'x.ts', projectPath: 'acme/a', touches: 3 });
    expect(s.topFiles.find((f) => f.path === 'z.ts')).toBeUndefined();
  });

  it('tiene al massimo 5 repo e 5 file', () => {
    const raw = activity({
      commits: times(8, (i) =>
        commit(winter(i), { projectPath: `acme/p${i}`, files: [`f${i}.ts`] }),
      ),
    });
    const s = stats(raw);
    expect(s.topProjects).toHaveLength(5);
    expect(s.topFiles).toHaveLength(5);
  });
});

describe('linguaggi', () => {
  it('riconosce estensioni e nomi di file', () => {
    expect(languageOf('src/app.tsx')).toBe('TypeScript');
    expect(languageOf('Dockerfile')).toBe('Dockerfile');
    expect(languageOf('docker/Dockerfile.api')).toBe('Dockerfile');
    expect(languageOf('deploy/api.dockerfile')).toBe('Dockerfile');
    expect(languageOf('Makefile')).toBe('Makefile');
    expect(languageOf('README.md')).toBeNull();
    expect(languageOf('.bashrc')).toBeNull();
    expect(languageOf('LICENSE')).toBeNull();
  });

  it('dalle estensioni, al massimo 8, somma ≤ 1', () => {
    const files = [
      'a.ts',
      'b.py',
      'c.go',
      'd.rs',
      'e.java',
      'f.rb',
      'g.php',
      'h.cs',
      'i.swift',
      'README.md',
    ];
    const s = stats(activity({ commits: commits(3, { files }) }));
    expect(s.languages).toHaveLength(8);
    expect(s.languages.reduce((t, l) => t + l.share, 0)).toBeLessThanOrEqual(1);
    expect(s.languages[0]).toEqual({ name: 'C#', share: 0.111 });
  });

  it('ripiega sulle percentuali dei progetti pesate per commit', () => {
    const raw = activity({
      projects: [
        project({ path: 'acme/a', languages: { Go: 60, Shell: 40.01 } }),
        project({ path: 'acme/b', languages: { Kotlin: 100 } }),
        project({ path: 'acme/c', languages: {} }),
      ],
      commits: [
        ...commits(3, { projectPath: 'acme/a', files: ['README.md'] }),
        commit(winter(40), { projectPath: 'acme/b', files: [] }),
        commit(winter(41), { projectPath: 'acme/c', files: [] }),
        commit(winter(42), { projectPath: 'acme/ignoto', files: [] }),
      ],
    });
    const s = stats(raw);
    expect(s.languages.map((l) => l.name)).toEqual(['Go', 'Shell', 'Kotlin']);
    expect(s.languages.reduce((t, l) => t + l.share, 0)).toBeLessThanOrEqual(1);
    expect(s.languages[0]?.share).toBe(0.449);
  });
});

describe('messaggi di commit', () => {
  it('parole senza stopword né prefissi conventional, in minuscolo, max 10', () => {
    expect(wordsOf('feat(api)!: Aggiunge il Carrello per gli ordini')).toEqual([
      'aggiunge',
      'carrello',
      'ordini',
    ]);
    expect(wordsOf('chore: update the deps :tada: https://esempio.test/x 2026')).toEqual([
      'update',
      'deps',
    ]);
    const raw = activity({
      commits: commits(12, (i) => ({ message: `fix: parola${i} carrello carrello ordini` })),
    });
    const { topWords } = stats(raw).commitMessages;
    expect(topWords).toHaveLength(10);
    expect(topWords[0]).toEqual({ word: 'carrello', count: 24 });
    expect(topWords[1]).toEqual({ word: 'ordini', count: 12 });
    expect(topWords.some((w) => w.word === 'fix')).toBe(false);
  });

  it('conteggi di fix, wip ed emoji', () => {
    expect(isFixMessage('Hotfix del login')).toBe(true);
    expect(isWipMessage('WIP: bozza')).toBe(true);
    expect(isWipMessage('wipe della cache')).toBe(false);
    expect(hasEmoji('rilascio 🚀')).toBe(true);
    expect(hasEmoji('rilascio :rocket:')).toBe(true);
    expect(hasEmoji('alle 10:30:00')).toBe(false);
  });

  it('lunghezze, messaggio più corto (prima riga) e merge esclusi', () => {
    const raw = activity({
      commits: [
        commit(winter(1), { message: 'aggiorna\n\ncorpo lungo del messaggio' }),
        commit(winter(2), { message: 'ops' }),
        commit(winter(3), { message: 'ups' }),
        commit(winter(4), { message: 'Merge branch x', isMerge: true }),
      ],
    });
    const m = stats(raw).commitMessages;
    expect(m.shortest).toBe('ops');
    expect(m.longestLength).toBe(35);
    expect(m.averageLength).toBe(13.7);
  });
});

describe('duetto', () => {
  it('somma le interazioni nei due sensi con il nome da teamMembers', () => {
    const raw = activity({
      mergeRequests: [
        mr({
          approvedBy: [bruno.username, ada.username],
          reviewers: [bruno.username, carla.username],
        }),
      ],
      approvalsGiven: [
        approval({ mrAuthor: bruno.username }),
        approval({ mrAuthor: carla.username }),
      ],
      notes: [
        note({ counterpart: bruno.username }),
        note({ counterpart: null }),
        note({ counterpart: ada.username }),
      ],
      emojiGiven: [emojiGiven({ counterpart: bruno.username })],
      emojiReceived: [emojiReceived({ from: bruno.username }), emojiReceived({ from: 'estraneo' })],
    });
    expect(stats(raw).duet).toEqual({
      partner: bruno,
      interactions: 6,
      via: { approvals: 2, reviews: 1, notes: 1, emoji: 2 },
    });
  });

  it('a parità vince lo username alfabeticamente primo; null senza interazioni', () => {
    const raw = activity({
      notes: [note({ counterpart: dario.username }), note({ counterpart: carla.username })],
    });
    expect(stats(raw).duet?.partner).toEqual(carla);
    expect(stats(activity({ notes: [note({ counterpart: 'estraneo' })] })).duet).toBeNull();
  });

  it('senza lista del team usa lo username come nome', () => {
    const raw = activity({ notes: [note({ counterpart: 'estraneo' })] });
    expect(stats(raw, []).duet?.partner).toEqual({ username: 'estraneo', displayName: 'estraneo' });
  });
});

describe('pipeline', () => {
  it('quota di successo, serie di fallimenti e cimitero', () => {
    const raw = activity({
      pipelines: [
        pipeline({
          status: 'failed',
          createdAt: winter(1),
          isDefaultBranch: false,
          ref: 'feat',
          durationSeconds: 900,
        }),
        pipeline({ status: 'canceled', createdAt: winter(2) }),
        pipeline({ status: 'failed', createdAt: winter(3), durationSeconds: 10 }),
        pipeline({ status: 'failed', createdAt: winter(4), durationSeconds: null }),
        pipeline({ status: 'success', createdAt: winter(5) }),
        pipeline({ status: 'failed', createdAt: winter(6), durationSeconds: 10 }),
      ],
    });
    const p = stats(raw).pipelines;
    expect(p.total).toBe(6);
    expect(p.failed).toBe(4);
    expect(p.successRate).toBe(0.333);
    expect(p.longestFailStreak).toBe(3);
    // main: rossa, rossa, verde → una rinascita; feat: solo rossa.
    expect(p.recoveries).toBe(1);
    expect(p.graveyard).toEqual([
      { projectPath: 'acme/officina/motore', ref: 'main', failedAt: winter(6) },
      { projectPath: 'acme/officina/motore', ref: 'main', failedAt: winter(3) },
      { projectPath: 'acme/officina/motore', ref: 'main', failedAt: winter(4) },
    ]);
  });
});

describe('MR fantasma', () => {
  it('conta aperte ferme e chiuse senza merge, con l’età della più antica', () => {
    const raw = activity({
      mergeRequests: [
        mr({
          state: 'opened',
          mergedAt: null,
          createdAt: '2025-12-01T10:00:00+01:00',
          updatedAt: winter(5),
        }),
        mr({ state: 'closed', mergedAt: null, createdAt: winter(10), closedAt: winter(20) }),
        mr({
          state: 'closed',
          mergedAt: null,
          createdAt: winter(10),
          closedAt: null,
          updatedAt: winter(12),
        }),
        mr({ state: 'closed', mergedAt: null, closedAt: '2025-12-01T10:00:00+01:00' }),
        mr({ state: 'opened', mergedAt: null, createdAt: '2027-01-05T10:00:00+01:00' }),
        mr({ state: 'locked', mergedAt: null }),
        mr(),
      ],
    });
    // Aperta dal 1° dicembre 2025 alle 10:00 fino a fine 2026: 395 giorni e 14 ore.
    expect(stats(raw).ghostMrs).toEqual({ count: 3, oldestDays: 395 });
  });
});

describe('deploy del venerdì', () => {
  it('conta i deploy dalle 14:00 e riporta quello più tardo', () => {
    const raw = activity({
      deployments: [
        deployment({ createdAt: winter(fridayDay(0), 14, 0) }),
        deployment({ createdAt: winter(fridayDay(1), 19, 30) }),
        deployment({ createdAt: winter(fridayDay(2), 19, 30) }),
        deployment({ createdAt: winter(fridayDay(3), 13, 59) }),
        deployment({ createdAt: winter(fridayDay(3) + 1, 20, 0) }),
      ],
    });
    expect(stats(raw).fridayDeploys).toEqual({ count: 3, latestAt: winter(fridayDay(2), 19, 30) });
  });

  it('senza deploy ripiega sulle pipeline del branch di default', () => {
    const raw = activity({
      pipelines: [
        pipeline({ createdAt: winter(fridayDay(0), 15) }),
        pipeline({ createdAt: winter(fridayDay(1), 16), isDefaultBranch: false }),
      ],
    });
    expect(stats(raw).fridayDeploys.count).toBe(1);
  });
});

describe('emoji', () => {
  it('top 5 date e ricevute', () => {
    const names = ['tada', 'tada', 'rocket', 'a', 'b', 'c', 'd'];
    const raw = activity({
      emojiGiven: names.map((name) => emojiGiven({ name })),
      emojiReceived: [emojiReceived({ name: 'eyes' })],
    });
    const e = stats(raw).emoji;
    expect(e.topGiven).toEqual([
      { name: 'tada', count: 2 },
      { name: 'a', count: 1 },
      { name: 'b', count: 1 },
      { name: 'c', count: 1 },
      { name: 'd', count: 1 },
    ]);
    expect(e.topReceived).toEqual([{ name: 'eyes', count: 1 }]);
  });
});

describe('momenti epici', () => {
  it('calcola ogni tipo con la sua unità', () => {
    const raw = activity({
      commits: [
        commit(winter(2, 9), { additions: 100, deletions: 50, projectPath: 'acme/a' }),
        commit(winter(2, 23, 30)),
        commit(winter(3, 3, 12)),
        commit(winter(3, 4, 50)),
        commit(winter(40, 10), { additions: 999, deletions: 999, isMerge: true }),
      ],
      mergeRequests: [
        mr({
          createdAt: winter(10, 9),
          firstApprovedAt: winter(10, 9, 42),
          mergedAt: winter(13, 21),
        }),
        mr({
          createdAt: winter(11, 9),
          firstApprovedAt: winter(11, 8),
          mergedAt: '2027-02-01T10:00:00+01:00',
        }),
        mr({ createdAt: winter(12, 9), firstApprovedAt: null, mergedAt: null }),
      ],
    });
    const byKind = Object.fromEntries(stats(raw).epicMoments.map((m) => [m.kind, m]));
    expect(byKind.biggest_commit).toMatchObject({ value: 150, projectPath: 'acme/a' });
    expect(byKind.first_commit).toMatchObject({ value: 3, at: winter(2, 9) });
    expect(byKind.last_commit).toMatchObject({ value: 41 });
    expect(byKind.latest_night_commit).toMatchObject({ value: 192, at: winter(3, 3, 12) });
    expect(byKind.fastest_approval).toMatchObject({ value: 42 });
    expect(byKind.longest_mr).toMatchObject({ value: 3.5 });
    expect(byKind.busiest_day).toMatchObject({ value: 2, at: winter(2, 9), projectPath: null });
    // 04:50 è ancora notte: il più mattiniero è quello delle 09:00.
    expect(byKind.earliest_morning_commit).toMatchObject({ value: 540, at: winter(2, 9) });
  });
});
