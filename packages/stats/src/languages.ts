import type { WrappedStats } from '@git-wrapped/contracts';
import { floorTo, increment, rankCounts } from './internal/math';
import type { ActivityContext } from './internal/context';

/**
 * Linguaggi. Fonte principale: le estensioni dei file toccati nei commit (non di merge),
 * un punto per file per commit. Se nessun file è riconosciuto, si usano le percentuali di
 * `projects[].languages` pesate per numero di commit sul progetto.
 * Nomi allineati a quelli che GitLab restituisce in `/projects/:id/languages`.
 * File di dati e testo (JSON, YAML, Markdown, lockfile...) non contano come linguaggio.
 */

const BY_EXTENSION: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  mts: 'TypeScript',
  cts: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  py: 'Python',
  java: 'Java',
  kt: 'Kotlin',
  kts: 'Kotlin',
  groovy: 'Groovy',
  gradle: 'Groovy',
  scala: 'Scala',
  go: 'Go',
  rs: 'Rust',
  rb: 'Ruby',
  php: 'PHP',
  cs: 'C#',
  fs: 'F#',
  vb: 'Visual Basic .NET',
  c: 'C',
  h: 'C',
  cc: 'C++',
  cpp: 'C++',
  cxx: 'C++',
  hpp: 'C++',
  hh: 'C++',
  m: 'Objective-C',
  swift: 'Swift',
  dart: 'Dart',
  ex: 'Elixir',
  exs: 'Elixir',
  erl: 'Erlang',
  hs: 'Haskell',
  clj: 'Clojure',
  lua: 'Lua',
  r: 'R',
  pl: 'Perl',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  ps1: 'PowerShell',
  sql: 'SQL',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  vue: 'Vue',
  svelte: 'Svelte',
  tf: 'HCL',
  hcl: 'HCL',
  dockerfile: 'Dockerfile',
};

const BY_FILENAME: Record<string, string> = {
  dockerfile: 'Dockerfile',
  containerfile: 'Dockerfile',
  makefile: 'Makefile',
  gnumakefile: 'Makefile',
  jenkinsfile: 'Groovy',
  rakefile: 'Ruby',
  gemfile: 'Ruby',
};

/** Linguaggio di un percorso, `null` se non riconosciuto. */
export function languageOf(path: string): string | null {
  const name = (path.split('/').pop() ?? '').toLowerCase();
  const byName = BY_FILENAME[name];
  if (byName) return byName;
  if (name.startsWith('dockerfile.')) return 'Dockerfile';
  const dot = name.lastIndexOf('.');
  // Nessuna estensione, o file nascosto tipo `.bashrc`: non riconosciuto.
  if (dot <= 0) return null;
  return BY_EXTENSION[name.slice(dot + 1)] ?? null;
}

const MAX_LANGUAGES = 8;

function toShares(weights: Map<string, number>, total: number): WrappedStats['languages'] {
  if (total <= 0) return [];
  return rankCounts(weights, MAX_LANGUAGES)
    .map(([name, w]) => ({ name, share: floorTo(w / total) }))
    .filter((l) => l.share > 0);
}

export function computeLanguages(ctx: ActivityContext): WrappedStats['languages'] {
  const fromFiles = new Map<string, number>();
  let recognized = 0;
  for (const { item } of ctx.authoredCommits) {
    for (const path of new Set(item.files)) {
      const lang = languageOf(path);
      if (lang) {
        increment(fromFiles, lang);
        recognized++;
      }
    }
  }
  if (recognized > 0) return toShares(fromFiles, recognized);

  // Ripiego: percentuali del progetto pesate per i commit fatti su quel progetto.
  const byPath = new Map(ctx.raw.projects.map((p) => [p.path, p.languages]));
  const fromProjects = new Map<string, number>();
  let commitsWithData = 0;
  let weightSum = 0;
  for (const { item } of ctx.authoredCommits) {
    const langs = byPath.get(item.projectPath);
    if (!langs || Object.keys(langs).length === 0) continue;
    commitsWithData++;
    for (const [name, pct] of Object.entries(langs)) {
      increment(fromProjects, name, pct / 100);
      weightSum += pct / 100;
    }
  }
  // Le percentuali di GitLab possono sommare a 100,01: si normalizza sul massimo dei due.
  return toShares(fromProjects, Math.max(commitsWithData, weightSum));
}
