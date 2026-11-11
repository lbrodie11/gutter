/**
 * FRAME/12 packages as devDependencies: the vendored tokens match `@frame12/tokens`, and every page Gutter
 * generates passes `@frame12/lint`'s `lintHtml()` (Gutter's own `lintPage()` stays the runtime check: zero
 * runtime dependencies).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { lintHtml } from '@frame12/lint';
import { cssText } from '@frame12/tokens';
import { assembleBrief } from '../src/brief.ts';
import { lintPage, renderComic } from '../src/render/comic.ts';
import { FRAME12_TOKENS, FRAME12_TOKENS_VERSION, TOKENS_ID } from '../src/render/frame12-tokens.ts';
import { frame12TokensModule } from '../scripts/sync-frame12-tokens.ts';
import { scenarios } from './fixtures/gu29/scenarios.ts';

const require = createRequire(import.meta.url);
const lint = (html: string, file: string) => lintHtml(html, { file, tokenStyleIds: [TOKENS_ID] });

test('the vendored tokens are @frame12/tokens, byte for byte (scripts/sync-frame12-tokens.ts regenerates them)', () => {
  const version = (require('@frame12/tokens/package.json') as { version: string }).version;
  assert.equal(FRAME12_TOKENS, cssText);
  assert.equal(FRAME12_TOKENS_VERSION, version);
  assert.equal(readFileSync('src/render/frame12-tokens.ts', 'utf8'), frame12TokensModule(cssText, version));
});

test('every comic page (each fixture scenario) and the committed example pass @frame12/lint', () => {
  for (const s of scenarios()) {
    const page = renderComic(assembleBrief({ ...s }));
    assert.deepEqual(lint(page, `${s.name}.html`), [], s.name);
    assert.deepEqual(lintPage(page), [], s.name);
  }
  assert.deepEqual(lint(readFileSync('docs/example/gutter.html', 'utf8'), 'docs/example/gutter.html'), []);
});

test('lintPage: marker yellow only as a background (outline, border, color and shadows are misuse)', () => {
  const page = renderComic(assembleBrief({ ...scenarios()[0]! }));
  for (const css of ['a:focus{outline:2px solid var(--f-marker)}', '.x{border-color:var(--f-marker)}', '.x{color:var(--f-marker)}', '.x{box-shadow:0 0 0 2px var(--f-marker)}']) {
    const bad = page.replace('</head>', `<style>${css}</style></head>`);
    assert.ok(lintPage(bad).some((p) => p.startsWith('marker-misuse')), css);
    assert.ok(lint(bad, 'bad.html').some((v) => v.rule === 'marker-misuse'), `@frame12/lint agrees: ${css}`);
  }
  assert.deepEqual(lintPage(page.replace('</head>', '<style>.y{background:var(--f-marker);color:var(--f-marker-ink)}</style></head>')), []);
  // A selector with a pseudo-class is not a property.
  assert.deepEqual(lintPage(page.replace('</head>', '<style>\na:hover{background:var(--f-marker);color:var(--f-marker-ink)}</style></head>')), []);
});
