import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runBench, writeBenchOutputs } from '../src/bench/runner.ts';
import { renderBenchHtml } from '../src/bench/report-html.ts';
import { renderBenchMarkdown } from '../src/bench/report-md.ts';
import { validateBenchResults } from '../src/bench/validate.ts';
import { lintPage } from '../src/render/comic.ts';
import { TempRepo } from './helpers.ts';

const DAY_SEC = 86400;
const BASE_TIME = 1760000000;

function commitAt(
  repo: TempRepo,
  msg: string,
  opts: { dateSec: number; authorName?: string; authorEmail?: string },
): void {
  repo.git('add', '-A');
  const name = opts.authorName ?? 'Alice';
  const email = opts.authorEmail ?? 'alice@example.com';
  const dateIso = new Date(opts.dateSec * 1000).toISOString();
  execFileSync('git', ['commit', '-q', '-m', msg], {
    cwd: repo.dir,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: name,
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: name,
      GIT_COMMITTER_EMAIL: email,
      GIT_AUTHOR_DATE: dateIso,
      GIT_COMMITTER_DATE: dateIso,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
}

function extractNumbersFromJson(jsonText: string): Set<string> {
  const nums = new Set<string>();
  for (const m of jsonText.matchAll(/-?\d+(?:\.\d+)?/g)) {
    nums.add(m[0]);
    const parsed = Number(m[0]);
    if (Number.isFinite(parsed)) {
      nums.add(String(parsed));
    }
  }
  return nums;
}

test('reports & schema: bench.json conforms to schema/bench.schema.json, bench.html passes lintPage(), and every number in bench.md and bench.html appears in bench.json', async () => {
  const repo = new TempRepo();
  const outDir = mkdtempSync(join(tmpdir(), 'gutter-bench-reports-'));
  try {
    repo.write({ 'src/a.ts': 'export const a = 0;\n', 'src/b.ts': 'export const b = 0;\n' });
    commitAt(repo, 'chore: init', { dateSec: BASE_TIME });

    for (let i = 1; i <= 10; i++) {
      repo.write({
        'src/a.ts': `export const a = ${i};\n`,
        'src/b.ts': `export const b = ${i};\n`,
      });
      commitAt(repo, `feat: co-change ${i} (#${i})`, { dateSec: BASE_TIME + i * DAY_SEC });
    }

    // PR #11 modifies src/a.ts only
    repo.write({
      'src/a.ts': 'export const a = 11;\nexport const extra = true;\n',
    });
    commitAt(repo, 'feat: update a only (#11)', { dateSec: BASE_TIME + 11 * DAY_SEC });

    // Follow-up 1 day later modifies src/b.ts
    repo.write({
      'src/b.ts': 'export const b = 11;\n',
    });
    commitAt(repo, 'fix: follow up b (#12)', { dateSec: BASE_TIME + 12 * DAY_SEC });

    // Final commit 10 days later so windows are fully observed
    repo.write({ 'README.md': '# Repo\n' });
    commitAt(repo, 'docs: update readme', { dateSec: BASE_TIME + 25 * DAY_SEC });

    const model = await runBench({
      cwd: repo.dir,
      outDir,
      prs: 5,
      windowDays: 7,
      now: new Date((BASE_TIME + 30 * DAY_SEC) * 1000),
    });

    const jsonPath = join(outDir, 'bench.json');
    const mdPath = join(outDir, 'bench.md');
    const htmlPath = join(outDir, 'bench.html');
    assert.ok(existsSync(jsonPath), 'bench.json should be written');
    assert.ok(existsSync(mdPath), 'bench.md should be written');
    assert.ok(existsSync(htmlPath), 'bench.html should be written');

    const jsonText = readFileSync(jsonPath, 'utf8');
    const mdText = readFileSync(mdPath, 'utf8');
    const htmlText = readFileSync(htmlPath, 'utf8');

    // 1. Validate bench.json against schema/bench.schema.json
    const schemaProblems = validateBenchResults(JSON.parse(jsonText));
    assert.deepEqual(schemaProblems, []);

    // Verify validator catches tampered fields
    const invalidCopy = { ...model, schemaVersion: 2 };
    assert.ok(validateBenchResults(invalidCopy).length > 0, 'validator must reject invalid schemaVersion');

    // 2. Verify FRAME/12 design-grammar lint on bench.html
    const grammarProblems = lintPage(htmlText);
    assert.deepEqual(grammarProblems, []);

    // 3. Verify Gate A never claims PASS and ungated is labeled "research: not product behavior"
    assert.match(mdText, /Question usefulness \(Gate A\): UNVERIFIED \(insufficient sample: N=\d+ < 30\)\./);
    assert.match(htmlText, /Question usefulness \(Gate A\): UNVERIFIED \(insufficient sample: N=\d+ &lt; 30\)\./);
    assert.doesNotMatch(mdText, /Gate A.*PASS/i);
    assert.doesNotMatch(htmlText, /Gate A.*PASS/i);
    assert.match(mdText, /research: not product behavior/);
    assert.match(htmlText, /research: not product behavior/);

    // 4. Assert that EVERY number in bench.md and in visible text of bench.html appears in bench.json
    const jsonNumbers = extractNumbersFromJson(jsonText);

    const mdNumbers = [...mdText.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((m) => m[0]);
    assert.ok(mdNumbers.length > 20, 'bench.md should contain numeric metrics');
    const missingFromMd = mdNumbers.filter(
      (n) => !jsonNumbers.has(n) && !jsonNumbers.has(String(Number(n))),
    );
    assert.deepEqual(
      missingFromMd,
      [],
      `Every number in bench.md must appear in bench.json; missing: ${missingFromMd.join(', ')}`,
    );

    const visibleHtmlText = htmlText
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<span class="num">C-\d+<\/span>/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    const htmlNumbers = [...visibleHtmlText.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((m) => m[0]);
    assert.ok(htmlNumbers.length > 20, 'bench.html should contain numeric metrics');
    const missingFromHtml = htmlNumbers.filter(
      (n) => !jsonNumbers.has(n) && !jsonNumbers.has(String(Number(n))),
    );
    assert.deepEqual(
      missingFromHtml,
      [],
      `Every number in bench.html visible text must appear in bench.json; missing: ${missingFromHtml.join(', ')}`,
    );
  } finally {
    repo.cleanup();
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('security: malicious paths, subjects, HTML, control/bidi chars, emails, tokens, and local paths are escaped and sanitized', async () => {
  const repo = new TempRepo();
  const outDir = mkdtempSync(join(tmpdir(), 'gutter-bench-sec-'));
  try {
    const evilFile = "src/evil&'file[1].ts";
    repo.write({
      'src/a.ts': 'export const a = 0;\n',
      [evilFile]: 'export const e = 0;\n',
    });
    commitAt(repo, 'chore: init', { dateSec: BASE_TIME });

    for (let i = 1; i <= 10; i++) {
      repo.write({
        'src/a.ts': `export const a = ${i};\n`,
        [evilFile]: `export const e = ${i};\n`,
      });
      commitAt(repo, `feat: sync ${i} (#${i})`, { dateSec: BASE_TIME + i * DAY_SEC });
    }

    // PR #11 with hostile subject, bidi override (\u202E), control char (\u0007), token, email, local path, and CSS-like text linear-gradient()
    repo.write({ 'src/a.ts': 'export const a = 11;\n' });
    const hostileSubject =
      'feat: fix linear-gradient() \u202E\u0007<script>alert("xss")</script><img src=x onerror=alert(1)> | `break` @victim leak@example.com ghp_1234567890abcdef AKIA1234567890ABCDEF sk-proj-1234567890abcdefghijklmnop Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 /Users/secret/file.ts (#11)';
    commitAt(repo, hostileSubject, {
      dateSec: BASE_TIME + 11 * DAY_SEC,
      authorName: 'Mallory <mallory@example.com> \u202E<script>',
      authorEmail: 'mallory@example.com',
    });

    repo.write({ [evilFile]: 'export const e = 11;\n' });
    commitAt(repo, 'fix: follow up evil file (#12)', {
      dateSec: BASE_TIME + 12 * DAY_SEC,
      authorName: 'Mallory <mallory@example.com>',
      authorEmail: 'mallory@example.com',
    });

    repo.write({ 'README.md': '# Done\n' });
    commitAt(repo, 'docs: done', { dateSec: BASE_TIME + 25 * DAY_SEC });

    const model = await runBench({
      cwd: repo.dir,
      outDir,
      prs: 5,
      windowDays: 7,
      now: new Date((BASE_TIME + 30 * DAY_SEC) * 1000),
    });

    // Also inject a synthetic <img src=x onerror=alert(1)> target path in an exemplar to test HTML path escaping on all OSes
    if (model.aggregates.production.exemplars.bestQuestions[0]) {
      model.aggregates.production.exemplars.bestQuestions[0].targetFile = 'src/<img src=x onerror=alert(1)>.ts';
    }

    const jsonText = JSON.stringify(model);
    const mdText = renderBenchMarkdown(model);
    const htmlText = renderBenchHtml(model);

    // 1. No raw <script> or <img src=x onerror=...> in HTML or Markdown
    assert.ok(!htmlText.includes('<script>alert'), 'raw <script> must be escaped in bench.html');
    assert.ok(!htmlText.includes('<img src=x'), 'raw <img onerror> must be escaped in bench.html');
    assert.ok(!mdText.includes('<script>alert'), 'raw <script> must be escaped in bench.md');

    // 2. No bidi override (\u202E) or control character (\u0007) in outputs
    for (const text of [jsonText, mdText, htmlText]) {
      assert.ok(!/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u0007]/.test(text), 'bidi and control chars must be stripped');
      assert.ok(!text.includes('mallory@example.com'), 'author emails must never appear in outputs');
      assert.ok(!text.includes('leak@example.com'), 'emails in subjects must be redacted');
      assert.ok(!text.includes('ghp_1234567890abcdef'), 'tokens must be redacted');
      assert.ok(!text.includes('AKIA1234567890ABCDEF'), 'AWS access key IDs must be redacted');
      assert.ok(!text.includes('sk-proj-1234567890abcdefghijklmnop'), 'sk- API keys must be redacted');
      assert.ok(!text.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'Bearer tokens must be redacted');
      assert.ok(!text.includes('/Users/secret/file.ts'), 'absolute local paths must be redacted');
      assert.ok(!text.includes(repo.dir), 'local temp repo path must never appear in outputs');
    }

    // Verify linear-gradient() in visible report text does not trigger the CSS grammar lint, whereas CSS gradient() in <style> does
    assert.ok(htmlText.includes('linear-gradient()'), 'visible PR title text containing linear-gradient() is preserved');
    assert.deepEqual(lintPage(htmlText), []);
    const badCssHtml = htmlText.replace('<style>', '<style>.bad{background:linear-gradient(#000,#fff)}');
    assert.ok(lintPage(badCssHtml).some((p) => p.startsWith('gradient:')));

    // Verify consistent byte-cap truncation for Markdown and HTML without throwing or breaking lintPage()
    const cappedMd = renderBenchMarkdown(model, 1800);
    assert.ok(Buffer.byteLength(cappedMd, 'utf8') <= 1800, 'truncated Markdown must stay within byte cap');
    assert.ok(cappedMd.endsWith('_[Report truncated to size cap.]_\n'));

    const fullHtmlBytes = Buffer.byteLength(htmlText, 'utf8');
    const cappedHtml = renderBenchHtml(model, fullHtmlBytes - 200);
    assert.ok(Buffer.byteLength(cappedHtml, 'utf8') <= fullHtmlBytes - 200, 'truncated HTML must stay within byte cap');
    assert.deepEqual(lintPage(cappedHtml), [], 'truncated HTML must still pass FRAME/12 grammar lint');

    // 3. Author names appear only in per-question detail (not on top-level PR records or baseline targets)
    for (const pr of model.prs) {
      assert.equal('authorNames' in pr, false, 'BenchPrRecord must not carry top-level authorNames');
      for (const bName of ['popular', 'popular-near', 'recent'] as const) {
        for (const t of pr.policies.production.baselines[bName].targets) {
          assert.equal(t.authorName, null, 'Baseline targets must not carry author names');
        }
      }
    }

    // 4. HTML still passes FRAME/12 grammar lint
    assert.deepEqual(lintPage(htmlText), []);

    // 5. writeBenchOutputs succeeds
    writeBenchOutputs(model, outDir);
  } finally {
    repo.cleanup();
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('CLI: gutter bench prints the two gate check lines and exits 2 with a single line when repo-archaeology library is missing', () => {
  const repo = new TempRepo();
  const outDir = mkdtempSync(join(tmpdir(), 'gutter-cli-bench-'));
  const cliPath = resolve(import.meta.dirname, '../src/cli.ts');
  try {
    repo.write({ 'src/a.ts': 'export const a = 1;\n' });
    commitAt(repo, 'init (#1)', { dateSec: BASE_TIME });
    repo.write({ 'src/a.ts': 'export const a = 2;\n' });
    commitAt(repo, 'second (#2)', { dateSec: BASE_TIME + 10 * DAY_SEC });

    // 1. Offline missing library -> exit code 2, single line message
    const missingRes = spawnSync(
      process.execPath,
      ['--experimental-strip-types', cliPath, 'bench', '--cwd', repo.dir, '--out', outDir, '--ra-lib', '/nonexistent/ra-lib.js'],
      { encoding: 'utf8' },
    );
    assert.equal(missingRes.status, 2);
    const stderrLines = missingRes.stderr
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('(node:') && !l.startsWith('(Use `node'));
    assert.equal(stderrLines.length, 1, `Expected 1 error line, got: ${JSON.stringify(stderrLines)}`);
    assert.match(stderrLines[0]!, /repo-archaeology >= 0\.4\.0/);

    // 2. Normal CLI execution -> exit code 0, prints the two gate lines to stdout, writes bench.json, bench.md, bench.html
    const okOut = execFileSync(
      process.execPath,
      ['--experimental-strip-types', cliPath, 'bench', '--cwd', repo.dir, '--out', outDir, '--prs', '5'],
      { encoding: 'utf8' },
    );
    const stdoutLines = okOut.trim().split('\n');
    assert.equal(stdoutLines.length, 2);
    assert.match(stdoutLines[0]!, /^Full-salience share:/);
    assert.match(stdoutLines[1]!, /^Question usefulness \(Gate A\): UNVERIFIED \(insufficient sample: N=\d+ < 30\)\./);
    assert.ok(existsSync(join(outDir, 'bench.json')));
    assert.ok(existsSync(join(outDir, 'bench.md')));
    assert.ok(existsSync(join(outDir, 'bench.html')));
  } finally {
    repo.cleanup();
    rmSync(outDir, { recursive: true, force: true });
  }
});
