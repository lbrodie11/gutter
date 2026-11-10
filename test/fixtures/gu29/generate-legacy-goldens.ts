/**
 * Writes `legacy/<scenario>.json`: `assembleBrief` output for every GU-29 scenario.
 *
 * Run once at the pre-GU-29 commit (2dc9b82) to capture the goldens:
 *   node --experimental-strip-types test/fixtures/gu29/generate-legacy-goldens.ts
 * The pre-GU-29 code ignores `legacyPredictions`, so the goldens are exactly the old behavior.
 * `test/gu29.test.ts` then checks today's code with `legacyPredictions: true` against them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { assembleBrief } from '../../../src/brief.ts';
import { normalizeForLegacyCompare, scenarios } from './scenarios.ts';

const outDir = new URL('./legacy/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const s of scenarios()) {
  const brief = assembleBrief({ ...s, config: { ...s.config, legacyPredictions: true } as typeof s.config });
  writeFileSync(new URL(`${s.name}.json`, outDir), normalizeForLegacyCompare(brief));
}
process.stdout.write(`wrote ${scenarios().length} legacy goldens\n`);
