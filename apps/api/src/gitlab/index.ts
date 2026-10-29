import type { ActivitySource, GitLabSourceConfig } from '../source';

/** Stub di A0; A1 implementa entrambe le sorgenti. Le firme sono congelate. */

export function createGitLabSource(_config: GitLabSourceConfig): ActivitySource {
  throw new Error('createGitLabSource: non ancora implementato (A1)');
}

/** Sorgente demo: legge da `@git-wrapped/fixtures`, nessuna chiamata di rete. */
export function createDemoSource(): ActivitySource {
  throw new Error('createDemoSource: non ancora implementato (A1)');
}
