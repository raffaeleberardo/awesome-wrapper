import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSampleIcs } from './ics';
import { buildTeam, type TeamData } from './team';

/** File prodotti in `packages/fixtures/data/`. */
export const FIXTURE_FILES = {
  team: 'team.json',
  sampleIcsJson: 'sample-ics.json',
  sampleIcs: 'calendario-esempio.ics',
} as const;

export interface FixtureOutput {
  team: TeamData;
  sampleIcs: string;
}

export function buildFixtures(): FixtureOutput {
  return { team: buildTeam(), sampleIcs: buildSampleIcs() };
}

/** Scrive i file in `outDir`. Output riproducibile byte per byte: solo `\n` nel JSON, CRLF nell'.ics. */
export function writeFixtures(outDir: string): void {
  const { team, sampleIcs } = buildFixtures();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, FIXTURE_FILES.team), `${JSON.stringify(team)}\n`, 'utf8');
  writeFileSync(
    join(outDir, FIXTURE_FILES.sampleIcsJson),
    `${JSON.stringify(sampleIcs)}\n`,
    'utf8',
  );
  writeFileSync(join(outDir, FIXTURE_FILES.sampleIcs), sampleIcs, 'utf8');
}
