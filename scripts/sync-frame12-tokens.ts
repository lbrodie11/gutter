/**
 * Regenerate src/render/frame12-tokens.ts from the `@frame12/tokens` devDependency.
 *
 *   node --experimental-strip-types scripts/sync-frame12-tokens.ts [--check]
 *
 * Gutter has zero runtime dependencies, so the token stylesheet is vendored into the source tree rather than
 * imported at runtime. `--check` exits 1 when the vendored copy differs from the package (test/frame12.test.ts
 * runs the same comparison).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cssText } from '@frame12/tokens';

const require = createRequire(import.meta.url);
const OUT = new URL('../src/render/frame12-tokens.ts', import.meta.url);

export function frame12TokensModule(css: string, version: string): string {
  return `/**
 * FRAME/12 tokens, generated from \`@frame12/tokens\` ${version} (MIT, © Laqwan Brodie) by
 * \`scripts/sync-frame12-tokens.ts\`. Do not edit by hand: bump the devDependency and rerun the script.
 * https://github.com/lbrodie11/frame12
 *
 * Vendored because Gutter has zero runtime dependencies. This block is the ONLY place a color literal or font
 * family may appear in a Gutter page; \`lintPage()\` (and \`@frame12/lint\`'s \`lintHtml()\` in the tests) enforce it.
 */
export const TOKENS_ID = 'f12-tokens';

export const FRAME12_TOKENS_VERSION = ${JSON.stringify(version)};

export const FRAME12_TOKENS = ${JSON.stringify(css)};
`;
}

if (process.argv[1]?.endsWith('sync-frame12-tokens.ts')) {
  const version = (require('@frame12/tokens/package.json') as { version: string }).version;
  const want = frame12TokensModule(cssText, version);
  const have = readFileSync(OUT, 'utf8');
  if (process.argv.includes('--check')) {
    if (have !== want) {
      process.stderr.write('src/render/frame12-tokens.ts differs from @frame12/tokens; run scripts/sync-frame12-tokens.ts\n');
      process.exitCode = 1;
    }
  } else if (have !== want) {
    writeFileSync(OUT, want);
    process.stderr.write(`src/render/frame12-tokens.ts regenerated from @frame12/tokens ${version}\n`);
  }
}
