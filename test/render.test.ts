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

test('generated pages pass the FRAME/12 design-grammar lint', () => {
  const r = new TempRepo().write({ 'src/a.ts': 'export const a = 1;\n', 'src/a.test.ts': "import './a';\n" }).commit('init').branch('f');
  repos.push(r);
  r.write({ 'src/a.ts': `export const a = 2;\n${lines(30)}` }).commit('change a');
  const page = renderComic(buildBrief({ cwd: r.dir, base: 'main', raDiff: raDiffFixture(), raBacktest: raBacktestFixture(0.6) }));
  assert.deepEqual(lintPage(page), []);
});

test('the lint catches grammar violations', () => {
  const bad = '<style>.x{color:#ff0000;font-family:Comic Sans}.m{background:var(--f-marker)}.g{background:linear-gradient(red,blue)}</style>';
  const problems = lintPage(bad).map((p) => p.split(':')[0]);
  assert.deepEqual(problems.sort(), ['color-literal', 'font-literal', 'gradient', 'marker-misuse']);
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
  assert.match(renderComic(brief), /quiet-banner/);
});

test('panel 3 marks itself partial instead of claiming no dependents when alias imports exist', () => {
  const aliasSpec = '@/components/x';
  const r = new TempRepo()
    .write({
      'src/components/x.ts': 'export const x = 1;\n',
      'src/components/x.test.ts': 'export const t = 1;\n',
      'src/app/page.ts': `import '${aliasSpec}';\n`,
    })
    .commit('init')
    .branch('next-app');
  repos.push(r);
  r.write({
    'src/components/x.ts': `export const x = 2;\n${lines(20)}`,
  }).commit('update x');
  const brief = buildBrief({ cwd: r.dir, base: 'main', noHistory: true });
  assert.equal(brief.dependents.unresolvedAliases, 1);
  const page = renderComic(brief);
  assert.equal(page.includes('No file outside this change imports what it changed.'), false);
  assert.match(page, /<span class="stamp">partial<\/span> No relative imports outside this change point at what it changed, but 1 path-alias import was not resolved\./);
  assert.deepEqual(lintPage(page), []);
  const md = renderMarkdown(brief);
  assert.match(md, /Import scan is partial: 1 path-alias import/);
});
