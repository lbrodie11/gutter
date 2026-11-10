import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderCompareLabelHtml, sampleCompare } from '../src/bench/label.ts';
import type { BenchPrRecord } from '../src/bench/model.ts';
import { lintPage } from '../src/render/comic.ts';
import { benchModel, labelFixturePrs, target } from './bench-fixtures.ts';

test('label --compare sampling: 30/15/15 by default, deterministic per seed, spread across PRs, scored targets only', () => {
  const prs = labelFixturePrs(40);
  // Censored targets are never eligible, for any source.
  prs[0]!.policies.production.questions[0]!.targets[0]!.status = 'censored';
  prs[0]!.policies.production.baselines.recent.targets[0]!.status = 'censored';
  const model = benchModel(prs);

  const a = sampleCompare(model, { seed: 1 });
  assert.deepEqual(a.requested, { gutter: 30, recent: 15, 'popular-near': 15 });
  assert.deepEqual(a.drawn, { gutter: 30, recent: 15, 'popular-near': 15 });
  assert.deepEqual(a.pool, { gutter: 39, recent: 39, 'popular-near': 40 });
  assert.equal(a.items.length, 60);
  assert.deepEqual(a.items.map((i) => i.itemId).slice(0, 3), ['c01', 'c02', 'c03']);
  assert.ok(
    !a.items.some((i) => i.pr.id === 'pr-1' && i.source !== 'popular-near'),
    'censored Gutter and recent targets on PR 1 are never sampled',
  );

  // One item per PR per source before any PR repeats.
  for (const source of ['gutter', 'recent', 'popular-near'] as const) {
    const prIds = a.items.filter((i) => i.source === source).map((i) => i.pr.id);
    assert.equal(new Set(prIds).size, prIds.length, `${source} items come from distinct PRs`);
  }
  // No (PR, file) appears twice.
  const keys = a.items.map((i) => `${i.pr.id}|${i.file}`);
  assert.equal(new Set(keys).size, keys.length);

  const again = sampleCompare(model, { seed: 1 });
  assert.equal(again.sampleId, a.sampleId);
  assert.deepEqual(again.items.map((i) => i.questionId), a.items.map((i) => i.questionId));
  const other = sampleCompare(model, { seed: 2 });
  assert.notEqual(other.sampleId, a.sampleId);
  assert.notDeepEqual(other.items.map((i) => i.questionId), a.items.map((i) => i.questionId));

  // The display order interleaves sources (not 30 Gutter items first).
  assert.notDeepEqual(
    a.items.slice(0, 30).map((i) => i.source),
    Array(30).fill('gutter'),
  );
});

test('label --compare sampling: a baseline proposal that is also a Gutter companion target on the same PR is excluded', () => {
  const prs = labelFixturePrs(4);
  // PR 2's recent baseline proposes exactly the file Gutter asked about.
  prs[1]!.policies.production.baselines.recent.targets[0]!.targetFile = 'src/companion-2.ts';
  const s = sampleCompare(benchModel(prs), { seed: 1, gutter: 4, recent: 4, popularNear: 4 });
  assert.equal(s.overlapExcluded, 1);
  assert.equal(s.pool.recent, 3);
  assert.equal(s.drawn.recent, 3, 'small pools draw what exists without padding');
  assert.ok(!s.items.some((i) => i.source === 'recent' && i.file === 'src/companion-2.ts'));
});

test('label page: identical cards per source, outcome and source only in the encoded reveal, hostile text escaped, FRAME/12 lint clean', () => {
  const prs = labelFixturePrs(8);
  prs[0]!.subject = 'fix: <script>alert(1)</script> "quoted" & <b>bold</b> (#1)';
  prs[0]!.changedFiles = [{ path: 'src/<img src=x onerror=alert(2)>.ts', status: 'modified', additions: 1, deletions: 1 }];
  prs[0]!.policies.production.questions[0]!.targets[0]!.targetFile = 'src/"><svg onload=alert(3)>.ts';
  const sample = sampleCompare(benchModel(prs), { seed: 7, gutter: 4, recent: 2, popularNear: 2 });
  const page = renderCompareLabelHtml(sample);

  assert.deepEqual(lintPage(page), []);
  assert.ok(!page.includes('<script>alert(1)'), 'PR title is escaped');
  assert.ok(!page.includes('<img src=x'), 'changed path is escaped');
  assert.ok(!page.includes('<svg onload'), 'target path is escaped');
  assert.match(page, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

  // Before the reveal, nothing on a card tells the sources apart.
  const cards = [...page.matchAll(/<section class="panel item"[\s\S]*?<\/section>/g)].map((m) => m[0]);
  assert.equal(cards.length, 8);
  for (const card of cards) {
    const visible = card.replace(/data-reveal="[^"]*"/, '');
    assert.doesNotMatch(visible, /Gutter asked|Baseline|popular-near|recent|followedUp|notFollowedUp|Automatic outcome|95% CI/);
    assert.match(visible, /Should this PR also have changed/);
    assert.match(visible, /<div class="reveal" data-revealed hidden><\/div>/);
  }
  // The reveal payload carries source, evidence, and outcome.
  const payloads = cards.map((c) => JSON.parse(Buffer.from(/data-reveal="([^"]*)"/.exec(c)![1]!, 'base64').toString('utf8')));
  assert.deepEqual(new Set(payloads.map((p) => p.source)), new Set(['gutter', 'recent', 'popular-near']));
  const gutterPayload = payloads.find((p) => p.source === 'gutter');
  assert.match(gutterPayload.html, /Gutter asked:/);
  assert.match(gutterPayload.html, /Automatic outcome/);
  assert.ok(!payloads.some((p) => /<svg onload|<script>alert/.test(p.html)), 'reveal HTML is escaped server-side');

  // Links point at the PR, the file at head, and the confirming commit.
  assert.match(page, /href="https:\/\/github\.com\/example\/widget\/pull\/\d+"/);
  assert.match(page, /href="https:\/\/github\.com\/example\/widget\/blob\/[0-9a-f]{40}\/src\//);
  assert.ok(payloads.some((p) => /href="https:\/\/github\.com\/example\/widget\/commit\/f{40}"/.test(p.html)));
});

test('CLI: gutter label --compare writes the page; without --compare it exits 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gutter-label-cli-'));
  try {
    const benchPath = join(dir, 'bench.json');
    writeFileSync(benchPath, JSON.stringify(benchModel(labelFixturePrs(40))));
    const cli = (args: string[]) =>
      spawnSync(process.execPath, ['--experimental-strip-types', resolve('src/cli.ts'), ...args], { encoding: 'utf8' });

    const plain = cli(['label', benchPath]);
    assert.equal(plain.status, 2);
    assert.match(plain.stderr, /only --compare/);

    const ok = cli(['label', '--compare', benchPath, '--seed', '3']);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stderr, /60 blinded item\(s\): 30\/30 gutter/);
    assert.ok(existsSync(join(dir, 'label-compare.html')));

    const small = cli(['label', '--compare', benchPath, '--sample', '8', '--out', join(dir, 'x', 'small.html')]);
    assert.equal(small.status, 0, small.stderr);
    assert.match(small.stderr, /8 blinded item\(s\): 4\/4 gutter.*2\/2 recent.*2\/2 popular-near/);

    writeFileSync(join(dir, 'broken.json'), JSON.stringify({ schemaVersion: 1 }));
    const broken = cli(['label', '--compare', join(dir, 'broken.json')]);
    assert.equal(broken.status, 2);
    assert.match(broken.stderr, /not a valid bench\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stage0-report: STOP when lift fails regardless of labels; INCOMPLETE then CONTINUE when lift passes; regenerates the STAGE0 block', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gutter-stage0-'));
  try {
    const writeRuns = (root: string, prs: BenchPrRecord[]) => {
      for (const v of ['default', 'v1-floor', 'v2-two-signals', 'v3-breadth-not-full']) {
        mkdirSync(join(root, v), { recursive: true });
        writeFileSync(join(root, v, 'bench.json'), JSON.stringify(benchModel(prs)));
      }
    };
    const report = (args: string[]) => spawnSync(process.execPath, [resolve('bench/stage0-report.mjs'), ...args], { encoding: 'utf8' });

    // Losing fixture: baselines follow up by the PR author more often than Gutter.
    const losing = labelFixturePrs(10);
    for (const p of losing) {
      p.policies.production.baselines.recent.targets = [target({ file: 'src/busy.ts', followedUp: true, sameAuthor: true, raSignal: true })];
    }
    writeRuns(join(dir, 'lose'), losing);
    const lose = report(['--runs', join(dir, 'lose'), '--write-results', join(dir, 'lose.json')]);
    assert.equal(lose.status, 0, lose.stderr);
    assert.match(lose.stderr, /stage0: STOP/);
    assert.match(lose.stdout, /\*\*Lift condition:\*\*.*\*\*NOT MET\.\*\*/);
    const results = JSON.parse(readFileSync(join(dir, 'lose.json'), 'utf8'));
    assert.equal(results.runs.length, 4);

    // Winning fixture: Gutter's targets are followed up by the author; baselines never are.
    const winning = labelFixturePrs(10);
    for (const [i, p] of winning.entries()) {
      p.policies.production.questions[0]!.targets[0] = target({ file: p.policies.production.questions[0]!.targets[0]!.targetFile, followedUp: true, sameAuthor: true, raSignal: true });
      p.policies.production.baselines.recent.targets = [target({ file: 'src/busy.ts', followedUp: true })];
      p.policies.production.baselines['popular-near'].targets = [target({ file: 'src/near.ts', followedUp: true, sameAuthor: i % 2 === 0 })];
      p.policies.production.baselines.popular.targets = [target({ file: 'src/pop.ts', followedUp: false })];
    }
    writeRuns(join(dir, 'win'), winning);
    const noLabels = report(['--runs', join(dir, 'win'), '--write-results', join(dir, 'win.json')]);
    assert.match(noLabels.stderr, /stage0: INCOMPLETE/);

    const winModel = benchModel(winning);
    const labelsDoc = (labels: { source: string; label: string }[]) => ({
      schemaVersion: 1,
      kind: 'gutter-labels',
      mode: 'compare',
      sampleId: 'abc',
      seed: 1,
      bench: { headSha: winModel.repo.headSha, settingsHash: winModel.runIdentity.settingsHash },
      total: labels.length,
      labels: labels.map((l, i) => ({ questionId: `q${i}`, itemId: `c${i}`, labeler: 'ana', labeledAt: '2026-11-10T00:00:00Z', note: '', ...l })),
    });
    const full = [
      ...Array.from({ length: 6 }, (_, i) => ({ source: 'gutter', label: i < 5 ? 'useful' : 'wrong' })),
      ...Array.from({ length: 3 }, (_, i) => ({ source: 'recent', label: i < 1 ? 'useful' : 'irrelevant' })),
      ...Array.from({ length: 3 }, () => ({ source: 'popular-near', label: 'irrelevant' })),
    ];
    writeFileSync(join(dir, 'labels.json'), JSON.stringify(labelsDoc(full)));
    const cont = report(['--results', join(dir, 'win.json'), '--labels', join(dir, 'labels.json')]);
    assert.match(cont.stderr, /stage0: CONTINUE/, cont.stdout + cont.stderr);
    assert.match(cont.stdout, /\| `gutter` \| 6 \| 5 \| 0 \| 1 \| 0\.83 \[/);
    assert.match(cont.stdout, /Gutter 0\.83 vs better baseline `recent` 0\.33 \+ 0\.15 = 0\.48\. \*\*MET\.\*\*/);

    // Partial labels -> INCOMPLETE; labels from another run are rejected.
    const partial = labelsDoc(full);
    partial.labels = partial.labels.slice(0, 5);
    writeFileSync(join(dir, 'partial.json'), JSON.stringify(partial));
    assert.match(report(['--results', join(dir, 'win.json'), '--labels', join(dir, 'partial.json')]).stderr, /stage0: INCOMPLETE/);
    const foreign = labelsDoc(full);
    foreign.bench.settingsHash = 'ffffffffffffffff';
    writeFileSync(join(dir, 'foreign.json'), JSON.stringify(foreign));
    assert.match(report(['--results', join(dir, 'win.json'), '--labels', join(dir, 'foreign.json')]).stdout, /different bench run/);

    // --update replaces only the generated block.
    const doc = join(dir, 'STAGE0.md');
    writeFileSync(
      doc,
      '# keep\n\n<!-- stage0:results:start (generated by bench/stage0-report.mjs; do not edit by hand) -->\nold\n<!-- stage0:results:end -->\n\ntail\n',
    );
    const upd = report(['--results', join(dir, 'win.json'), '--labels', join(dir, 'labels.json'), '--update', doc]);
    assert.equal(upd.status, 0, upd.stderr);
    const updated = readFileSync(doc, 'utf8');
    assert.match(updated, /^# keep\n/);
    assert.match(updated, /\ntail\n$/);
    assert.doesNotMatch(updated, /\nold\n/);
    assert.match(updated, /Rule outcome: CONTINUE/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('committed Stage 0 artifacts: results.json regenerates the STAGE0.md block byte for byte, and the label page matches its bench.json', () => {
  const stage0 = 'docs/benchmark/data/honojs__hono/stage0';
  const res = spawnSync(process.execPath, [resolve('bench/stage0-report.mjs'), '--results', join(stage0, 'results.json')], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  const doc = readFileSync('docs/benchmark/STAGE0.md', 'utf8').replace(/\r\n/g, '\n');
  const start = doc.indexOf('<!-- stage0:results:start');
  const end = doc.indexOf('<!-- stage0:results:end -->') + '<!-- stage0:results:end -->'.length;
  if (!existsSync(join(stage0, 'labels.json'))) {
    assert.equal(doc.slice(start, end), res.stdout.trimEnd());
  }

  const model = JSON.parse(readFileSync(join(stage0, 'default', 'bench.json'), 'utf8'));
  const page = renderCompareLabelHtml(sampleCompare(model, { seed: 1 }));
  assert.equal(page, readFileSync(join(stage0, 'label-compare.html'), 'utf8').replace(/\r\n/g, '\n'));
});
