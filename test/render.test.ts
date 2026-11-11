import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrief } from '../src/brief.ts';
import { renderComic, lintPage } from '../src/render/comic.ts';
import { renderMarkdown, COMMENT_MARKER } from '../src/render/markdown.ts';
import { mdCode, mdText, html, fileUrl, commitUrl } from '../src/render/escape.ts';
import { wilsonInterval } from '../src/stats/wilson.ts';
import { TempRepo, lines, raBacktestFixture, raDiffFixture } from './helpers.ts';

const repos: TempRepo[] = [];
after(() => repos.forEach((r) => r.cleanup()));

test('Wilson interval matches known values', () => {
  const { low, high } = wilsonInterval(14, 19);
  assert.ok(Math.abs(low - 0.5123) < 1e-3 && Math.abs(high - 0.8822) < 1e-3, `${low} ${high}`);
  assert.deepEqual(wilsonInterval(0, 0), { low: 0, high: 1 });
});

test('Markdown escaping defuses syntax, mentions and code-span breakouts', () => {
  assert.equal(mdText('[x](javascript:alert(1)) @octocat'), '\\[x\\]\\(javascript:alert\\(1\\)\\) @​octocat');
  assert.equal(mdCode('a`b'), '``a`b``');
  assert.equal(mdCode('`edge`'), '`` `edge` ``');
  assert.equal(html('<img onerror=x>'), '&lt;img onerror=x&gt;');
});

test('links are only built from http(s) bases and hex shas', () => {
  assert.equal(commitUrl('javascript:alert(1)', 'abcdef1'), undefined);
  assert.equal(commitUrl('https://github.com/a/b', 'not-a-sha'), undefined);
  assert.equal(fileUrl('https://github.com/a/b', 'abcdef1', 'dir/a b#c.ts'), 'https://github.com/a/b/blob/abcdef1/dir/a%20b%23c.ts');
});

test('hostile PR text and file names never reach the page unescaped', () => {
  const r = new TempRepo().write({ 'src/x.ts': 'export const x = 1;\n' }).commit('init').branch('evil');
  repos.push(r);
  const diskEvilName = process.platform === 'win32' ? "src/evil&'file'[1].ts" : 'src/<img src=x onerror=alert(1)>.ts';
  r.write({ [diskEvilName]: 'x\n', 'src/x.ts': `export const x = 2;\n${lines(20)}` }).commit('</title><script>alert(1)</script>');
  const brief = buildBrief({
    cwd: r.dir, base: 'main', noHistory: true,
    title: '<script>alert("t")</script> | @here',
    intent: '<iframe src=//evil></iframe>',
  });
  if (process.platform === 'win32') {
    brief.changes.files.push({
      path: 'src/<img src=x onerror=alert(1)>.ts',
      status: 'added',
      additions: 1,
      deletions: 0,
      binary: false,
      module: 'src/<img src=x onerror=alert(1)>.ts',
      isTest: false,
      language: 'typescript',
    });
  }
  const page = renderComic(brief);
  assert.equal(/<script>alert/.test(page), false);
  assert.equal(page.includes('<iframe'), false);
  assert.equal(page.includes('<img src=x'), false);
  const md = renderMarkdown(brief);
  assert.equal(md.includes('<script>'), false);
  assert.equal(md.includes('@here'), false);
});

test('generated pages pass the FRAME/12 design-grammar lint and use sequential C-01..C-06 cuts', () => {
  const r = new TempRepo().write({ 'src/a.ts': 'export const a = 1;\n', 'src/a.test.ts': "import './a';\n" }).commit('init').branch('f');
  repos.push(r);
  r.write({ 'src/a.ts': `export const a = 2;\n${lines(30)}` }).commit('change a');
  const page = renderComic(buildBrief({ cwd: r.dir, base: 'main', raDiff: raDiffFixture(), raBacktest: raBacktestFixture(0.6) }));
  assert.deepEqual(lintPage(page), []);
  const cuts = [...page.matchAll(/\bdata-cut="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(cuts, ['C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06']);
});

test('the lint catches grammar violations including illegal-gutter and cut-order', () => {
  const bad = [
    '<style>.x{color:#ff0000;font-family:Comic Sans;gap:14px}.m{background:var(--f-marker)}.g{background:linear-gradient(red,blue)}</style>',
    '<section data-cut="C-01"><span class="num">C-01</span></section>',
    '<section data-cut="C-03"><span class="num">3</span></section>',
  ].join('\n');
  const rules = new Set(lintPage(bad).map((p) => p.split(':')[0]));
  assert.deepEqual(
    [...rules].sort(),
    ['color-literal', 'cut-order', 'font-literal', 'gradient', 'illegal-gutter', 'marker-misuse'],
  );
});

test('a small, unremarkable change produces a one-line quiet comment', () => {
  const r = new TempRepo().write({ 'docs/readme.md': '# hi\n' }).commit('init').branch('typo');
  repos.push(r);
  r.write({ 'docs/readme.md': '# hello\n' }).commit('fix typo');
  const brief = buildBrief({ cwd: r.dir, base: 'main', noHistory: true });
  assert.equal(brief.salience.level, 'quiet');
  const md = renderMarkdown(brief);
  assert.ok(md.startsWith(COMMENT_MARKER));
  assert.match(md, /nothing to flag/);
  assert.ok(md.split('\n').length <= 5, md);
  const page = renderComic(brief);
  assert.match(page, /quiet-banner/);
  assert.deepEqual(lintPage(page), []);
});

test('panel 3 marks itself partial instead of claiming no dependents when alias imports exist', () => {
  const r = new TempRepo()
    .write({
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } }),
      'src/a.ts': 'export const a = 1;\n',
      'src/a.test.ts': 'export const t = 1;\n',
      'src/b.ts': "import '@/a';\n",
    })
    .commit('init')
    .branch('next-app');
  repos.push(r);
  r.write({
    'src/a.ts': `export const a = 2;\n${lines(20)}`,
  }).commit('update a');
  const brief = buildBrief({ cwd: r.dir, base: 'main', noHistory: true });
  assert.equal(brief.dependents.coverage, 'partial');
  assert.equal(brief.dependents.unresolved.count, 1);
  assert.deepEqual(brief.dependents.unresolved.samples, ['src/b.ts → @/a']);

  const page = renderComic(brief);
  assert.equal(page.includes('No file outside this change imports what it changed'), false);
  assert.match(
    page,
    /<span class="stamp">partial<\/span> No importers found through relative imports\. 1 import that could reach this PR&#39;s files uses aliases or packages Gutter can&#39;t resolve yet \(for example <code class="path">src\/b\.ts → @\/a<\/code>\), so some importers may be missing\./,
  );
  assert.deepEqual(lintPage(page), []);

  const md = renderMarkdown(brief);
  assert.equal(md.includes('No file outside this change imports what it changed'), false);
  assert.match(
    md,
    /<sub>No importers found through relative imports\. 1 import that could reach this PR's files uses aliases or packages Gutter can't resolve yet \(for example `src\/b\.ts → @\/a`\), so some importers may be missing\.<\/sub>/,
  );

  // Saved legacy schemaVersion: 1 briefs (`unresolvedAliases` without `coverage` or `unresolved`)
  const { coverage: _c, unresolved: _u, ...legacyDepsBase } = brief.dependents;
  const legacyFull = {
    ...structuredClone(brief),
    dependents: { ...legacyDepsBase, unresolvedAliases: 0 } as unknown as typeof brief.dependents,
  };
  const legacyFullHtml = renderComic(legacyFull);
  const legacyFullMd = renderMarkdown(legacyFull);
  assert.match(legacyFullHtml, /No file outside this change imports what it changed\./);
  assert.equal(legacyFullMd.includes("aliases or packages Gutter can't resolve yet"), false);

  const legacyPartial = {
    ...structuredClone(brief),
    dependents: { ...legacyDepsBase, unresolvedAliases: 2 } as unknown as typeof brief.dependents,
  };
  const legacyPartialHtml = renderComic(legacyPartial);
  const legacyPartialMd = renderMarkdown(legacyPartial);
  assert.match(legacyPartialHtml, /2 imports use aliases or packages Gutter can&#39;t resolve yet/);
  assert.match(legacyPartialMd, /2 imports use aliases or packages Gutter can't resolve yet/);
});
