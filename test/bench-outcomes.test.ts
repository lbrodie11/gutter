import { test } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { replayBrief } from '../src/brief.ts';
import { runBench } from '../src/bench/runner.ts';
import { git, resolveSha } from '../src/git.ts';
import { lines, TempRepo } from './helpers.ts';

function commitWithMeta(
  repo: TempRepo,
  msg: string,
  opts: { dateIso: string; authorName?: string; authorEmail?: string },
): void {
  repo.git('add', '-A');
  const name = opts.authorName ?? 'Alice';
  const email = opts.authorEmail ?? 'alice@example.com';
  childProcess.execFileSync('git', ['commit', '-q', '-m', msg], {
    cwd: repo.dir,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: name,
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: name,
      GIT_COMMITTER_EMAIL: email,
      GIT_AUTHOR_DATE: opts.dateIso,
      GIT_COMMITTER_DATE: opts.dateIso,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
}

test('planted signal: A and B co-change 10 times; squash PR #11 changes A only; 1 day later B changes -> followedUp under ungated and production matches truncated clone', async () => {
  const repo = new TempRepo();
  const truncDir = mkdtempSync(join(tmpdir(), 'gutter-planted-trunc-'));
  try {
    repo.write({
      'src/a.ts': 'export const a = 0;\n',
      'src/b.ts': 'export const b = 0;\n',
    });
    commitWithMeta(repo, 'init', { dateIso: '2026-01-01T00:00:00Z' });

    for (let i = 1; i <= 10; i++) {
      const day = String(i + 1).padStart(2, '0');
      repo.write({
        'src/a.ts': `export const a = ${i};\n`,
        'src/b.ts': `export const b = ${i};\n`,
      });
      commitWithMeta(repo, `feat: co-change A and B ${i}`, { dateIso: `2026-01-${day}T12:00:00Z` });
    }

    // Squash PR #11 changes A only
    const pr11Base = resolveSha(repo.dir, 'HEAD')!;
    repo.write({
      'src/a.ts': `export const a = 11;\n${lines(15)}`,
    });
    commitWithMeta(repo, 'feat: update A only (#11)', { dateIso: '2026-01-20T12:00:00Z' });
    const pr11Head = resolveSha(repo.dir, 'HEAD')!;

    // Truncated clone at PR #11
    git(truncDir, ['clone', '-q', repo.dir, '.']);
    git(truncDir, ['checkout', '-q', pr11Head]);

    // 1 day later, B changes in a follow-up PR (#12)
    repo.write({
      'src/b.ts': 'export const b = 11;\n',
    });
    commitWithMeta(repo, 'fix: follow up B (#12)', { dateIso: '2026-01-21T12:00:00Z' });

    // One commit 10 days later so the 7-day window of PR #11 (and #12) is fully observed (not censored)
    repo.write({
      'README.md': '# Done\n',
    });
    commitWithMeta(repo, 'docs: readme (#13)', { dateIso: '2026-02-05T12:00:00Z' });

    const bench = await runBench({ cwd: repo.dir, windowDays: 7 });
    const pr11 = bench.prs.find((p) => p.prNumber === 11)!;
    assert.ok(pr11);

    // Under ungated: one followedUp forgotten-companion for src/b.ts
    const ungatedCompanions = pr11.policies.ungated.questions.filter((q) => q.kind === 'forgotten-companion');
    assert.equal(ungatedCompanions.length, 1);
    assert.equal(ungatedCompanions[0]!.status, 'followedUp');
    assert.equal(ungatedCompanions[0]!.targets[0]!.targetFile, 'src/b.ts');
    assert.equal(ungatedCompanions[0]!.targets[0]!.status, 'followedUp');
    assert.equal(ungatedCompanions[0]!.targets[0]!.delayHours, 24);
    assert.equal(ungatedCompanions[0]!.targets[0]!.sameAuthor, true);
    assert.equal(ungatedCompanions[0]!.targets[0]!.matchesRaFollowUp, true);

    // Under production: must match brief computed on clone truncated at PR #11
    const truncBrief = await replayBrief({
      cwd: truncDir,
      base: pr11Base,
      head: pr11Head,
    });
    assert.equal(pr11.policies.production.calibrationStatus, truncBrief.calibration.status);
    assert.deepEqual(
      pr11.policies.production.questions.map((q) => q.id),
      truncBrief.checklist.map((c) => c.id),
    );
  } finally {
    repo.cleanup();
    rmSync(truncDir, { recursive: true, force: true });
  }
});

test('calibration equivalence: present-day poor measured calibration (< 0.25) never suppresses PR #11 when as-of calibration at PR #11 is thin/unavailable', async () => {
  const repo = new TempRepo();
  try {
    repo.write({
      'src/a.ts': 'export const a = 0;\n',
      'src/b.ts': 'export const b = 0;\n',
      'src/noise1.ts': 'export const n1 = 0;\n',
      'src/noise2.ts': 'export const n2 = 0;\n',
    });
    commitWithMeta(repo, 'init', { dateIso: '2026-01-01T00:00:00Z' });

    // 10 co-changes of A and B before PR #11 (total commits = 11 < 30, so as-of calibration is unavailable/thin)
    for (let i = 1; i <= 10; i++) {
      const day = String(i + 1).padStart(2, '0');
      repo.write({
        'src/a.ts': `export const a = ${i};\n`,
        'src/b.ts': `export const b = ${i};\n`,
      });
      commitWithMeta(repo, `feat: pair ${i}`, { dateIso: `2026-01-${day}T00:00:00Z` });
    }

    // PR #11 touches A only
    repo.write({ 'src/a.ts': 'export const a = 99;\n' });
    commitWithMeta(repo, 'feat: touch A (#11)', { dateIso: '2026-01-15T00:00:00Z' });

    // After PR #11, add 180 training commits (including 35 co-changes of noise1.ts + noise2.ts)
    // followed by 55 held-out lone commits to noise1.ts so present-day backtest has >= 50 test commits,
    // >= 20 fired predictions, and precision 0 (< 0.25) -> status: 'measured'.
    const fastImportLines: string[] = [];
    let ts = Math.floor(Date.parse('2026-02-01T00:00:00Z') / 1000);
    const parentSha = resolveSha(repo.dir, 'HEAD')!;
    let firstFromWritten = false;
    const emitCommit = (msg: string, files: Record<string, string>) => {
      ts += 3600;
      fastImportLines.push('commit refs/heads/main');
      fastImportLines.push(`author Alice <alice@example.com> ${ts} +0000`);
      fastImportLines.push(`committer Alice <alice@example.com> ${ts} +0000`);
      const msgBuf = Buffer.from(msg, 'utf8');
      fastImportLines.push(`data ${msgBuf.length}`);
      fastImportLines.push(msg);
      if (!firstFromWritten) {
        fastImportLines.push(`from ${parentSha}`);
        firstFromWritten = true;
      }
      for (const [p, content] of Object.entries(files)) {
        const b = Buffer.from(content, 'utf8');
        fastImportLines.push(`M 100644 inline ${p}`);
        fastImportLines.push(`data ${b.length}`);
        fastImportLines.push(content);
      }
      fastImportLines.push('');
    };

    for (let i = 1; i <= 155; i++) {
      emitCommit(`feat: post-pr11 setup ${i}`, {
        'src/filler.ts': `export const filler = ${i};\n`,
      });
    }
    for (let i = 1; i <= 35; i++) {
      emitCommit(`feat: noise pair ${i}`, {
        'src/noise1.ts': `export const n1 = ${i};\n`,
        'src/noise2.ts': `export const n2 = ${i};\n`,
      });
    }
    for (let i = 1; i <= 55; i++) {
      emitCommit(`chore: lone noise ${i}`, {
        'src/noise1.ts': `export const n1 = ${1000 + i};\n`,
      });
    }
    childProcess.execFileSync('git', ['fast-import', '--quiet'], {
      cwd: repo.dir,
      input: fastImportLines.join('\n') + '\n',
    });
    git(repo.dir, ['reset', '--hard', 'refs/heads/main']);

    // Verify that at HEAD, backtest is 'measured' with precision < 0.25 (so present-day calibration WOULD suppress co-change)
    const headBase = resolveSha(repo.dir, 'HEAD~1')!;
    const headSha = resolveSha(repo.dir, 'HEAD')!;
    const headBrief = await replayBrief({ cwd: repo.dir, base: headBase, head: headSha });
    assert.equal(headBrief.calibration.status, 'measured');
    assert.ok((headBrief.calibration.precision ?? 1) < 0.25);

    // Run bench including PR #11: PR #11 must use its as-of calibration ('unavailable'), NOT the full-history 'measured' < 0.25 calibration!
    const bench = await runBench({ cwd: repo.dir, prs: 20 });
    const pr11 = bench.prs.find((p) => p.prNumber === 11)!;
    assert.ok(pr11);
    assert.equal(pr11.policies.production.calibrationStatus, 'unavailable');
    assert.ok(
      pr11.policies.production.questions.some((q) => q.kind === 'forgotten-companion' && q.id === 'check:companion:src/b.ts'),
      'PR #11 under production policy must not be suppressed by future poor calibration',
    );
  } finally {
    repo.cleanup();
  }
});

test('baseline leakage: a file that becomes popular only after PR #11 never appears in PR #11 baseline proposals', async () => {
  const repo = new TempRepo();
  try {
    repo.write({
      'src/a.ts': 'export const a = 0;\n',
      'src/b.ts': 'export const b = 0;\n',
      'src/early-pop.ts': 'export const ep = 0;\n',
      'src/future-pop.ts': 'export const fp = 0;\n',
    });
    commitWithMeta(repo, 'init', { dateIso: '2026-01-01T00:00:00Z' });

    // Before PR #11: early-pop.ts changes 8 times; future-pop.ts has 0 changes after init
    for (let i = 1; i <= 8; i++) {
      repo.write({
        'src/a.ts': `export const a = ${i};\n`,
        'src/b.ts': `export const b = ${i};\n`,
        'src/early-pop.ts': `export const ep = ${i};\n`,
      });
      commitWithMeta(repo, `feat: early ${i}`, { dateIso: `2026-01-0${i + 1}T00:00:00Z` });
    }

    // PR #11 changes src/a.ts (suggesting src/b.ts, k = 1)
    repo.write({ 'src/a.ts': 'export const a = 99;\n' });
    commitWithMeta(repo, 'feat: change A (#11)', { dateIso: '2026-01-15T00:00:00Z' });

    // After PR #11: future-pop.ts changes 30 times!
    for (let i = 1; i <= 30; i++) {
      repo.write({ 'src/future-pop.ts': `export const fp = ${i};\n` });
      commitWithMeta(repo, `feat: future popular ${i}`, {
        dateIso: new Date(Date.UTC(2026, 1, 1) + i * 86400_000).toISOString(),
      });
    }

    const bench = await runBench({ cwd: repo.dir, prs: 10 });
    const pr11 = bench.prs.find((p) => p.prNumber === 11)!;
    assert.ok(pr11);

    for (const bName of ['popular', 'popular-near', 'recent'] as const) {
      const targets = pr11.policies.production.baselines[bName].targets.map((t) => t.targetFile);
      assert.ok(
        !targets.includes('src/future-pop.ts'),
        `Baseline ${bName} at PR #11 leaked future popular file: ${targets.join(', ')}`,
      );
    }
  } finally {
    repo.cleanup();
  }
});

test('outcomes: unrelated author (sameAuthor: false), .mailmap author mapping, rename tracking, deletion outcome, censoring, overlapping windows, and zero-question N/A', async () => {
  const repo = new TempRepo();
  try {
    repo.write({
      '.mailmap': 'Alice Mapped <alice@canonical.example> <alice-alt@work.example>\n',
      'src/a.ts': 'export const a = 0;\n',
      'src/b.ts': 'export const b = 0;\n',
      'src/c.ts': 'export const c = 0;\n',
      'src/d.ts': 'export const d = 0;\n',
    });
    commitWithMeta(repo, 'init', { dateIso: '2026-01-01T00:00:00Z' });

    for (let i = 1; i <= 8; i++) {
      repo.write({
        'src/a.ts': `export const a = ${i};\n`,
        'src/b.ts': `export const b = ${i};\n`,
        'src/c.ts': `export const c = ${i};\n`,
        'src/d.ts': `export const d = ${i};\n`,
      });
      commitWithMeta(repo, `feat: cochange ${i}`, { dateIso: `2026-01-0${i + 1}T00:00:00Z` });
    }

    // PR #21 (by Alice): touches a, c, d -> suggests b (and only b is untouched)
    // Wait: let's test overlapping windows + different author on b:
    // PR #21 (day 10) by Alice: touches a, c, d (leaves b untouched)
    repo.write({
      'src/a.ts': 'export const a = 21;\n',
      'src/c.ts': 'export const c = 21;\n',
      'src/d.ts': 'export const d = 21;\n',
    });
    commitWithMeta(repo, 'feat: PR 21 touches a,c,d (#21)', {
      dateIso: '2026-01-10T00:00:00Z',
      authorName: 'Alice',
      authorEmail: 'alice@canonical.example',
    });

    // PR #22 (day 11) by Alice (using alt email mapped by .mailmap!): also touches a, c, d (leaves b untouched)
    repo.write({
      'src/a.ts': 'export const a = 22;\n',
      'src/c.ts': 'export const c = 22;\n',
      'src/d.ts': 'export const d = 22;\n',
    });
    commitWithMeta(repo, 'feat: PR 22 touches a,c,d (#22)', {
      dateIso: '2026-01-11T00:00:00Z',
      authorName: 'Alice Work',
      authorEmail: 'alice-alt@work.example',
    });

    // Follow-up commit on day 12 by Bob (different author!) modifying b -> falls in window of BOTH PR #21 and PR #22!
    repo.write({ 'src/b.ts': 'export const b = 22;\n' });
    commitWithMeta(repo, 'feat: Bob edits b', {
      dateIso: '2026-01-12T00:00:00Z',
      authorName: 'Bob',
      authorEmail: 'bob@other.example',
    });

    // PR #23 (day 20) by Alice: touches a, b, d (leaves c untouched). Then day 21: c is DELETED -> targetDeleted!
    repo.write({
      'src/a.ts': 'export const a = 23;\n',
      'src/b.ts': 'export const b = 23;\n',
      'src/d.ts': 'export const d = 23;\n',
    });
    commitWithMeta(repo, 'feat: PR 23 leaves c untouched (#23)', {
      dateIso: '2026-01-20T00:00:00Z',
      authorName: 'Alice',
      authorEmail: 'alice@canonical.example',
    });
    repo.rm('src/c.ts');
    commitWithMeta(repo, 'chore: delete c.ts', {
      dateIso: '2026-01-21T00:00:00Z',
      authorName: 'Alice',
      authorEmail: 'alice@canonical.example',
    });

    // PR #24 (day 30) by Alice: touches a, b (leaves d untouched). Day 31: d is renamed to d-renamed.ts and edited by Alice's alt email!
    repo.write({
      'src/a.ts': 'export const a = 24;\n',
      'src/b.ts': 'export const b = 24;\n',
    });
    commitWithMeta(repo, 'feat: PR 24 leaves d untouched (#24)', {
      dateIso: '2026-01-30T00:00:00Z',
      authorName: 'Alice',
      authorEmail: 'alice@canonical.example',
    });
    repo.mv('src/d.ts', 'src/d-renamed.ts');
    commitWithMeta(repo, 'refactor: rename d to d-renamed', {
      dateIso: '2026-01-31T00:00:00Z',
      authorName: 'Alice',
      authorEmail: 'alice-alt@work.example',
    });
    repo.write({ 'src/d-renamed.ts': 'export const d = 240;\n' });
    commitWithMeta(repo, 'fix: update d-renamed after rename', {
      dateIso: '2026-02-01T00:00:00Z',
      authorName: 'Alice Alt',
      authorEmail: 'alice-alt@work.example',
    });

    // PR #25 (day 50, newest commit on branch): touches a (leaves b untouched) -> window extends past newest commit -> censored!
    repo.write({ 'src/a.ts': 'export const a = 25;\n' });
    commitWithMeta(repo, 'feat: PR 25 at tip of branch (#25)', {
      dateIso: '2026-02-20T00:00:00Z',
      authorName: 'Alice',
      authorEmail: 'alice@canonical.example',
    });

    const bench = await runBench({ cwd: repo.dir, windowDays: 7 });

    // Check PR #21 & PR #22: both followedUp by Bob (sameAuthor: false) and sharedWithOtherPrs: true
    const pr21 = bench.prs.find((p) => p.prNumber === 21)!;
    const pr22 = bench.prs.find((p) => p.prNumber === 22)!;
    const t21 = pr21.policies.production.questions[0]!.targets[0]!;
    const t22 = pr22.policies.production.questions[0]!.targets[0]!;
    assert.equal(t21.status, 'followedUp');
    assert.equal(t21.sameAuthor, false);
    assert.equal(t21.sharedWithOtherPrs, true);
    assert.equal(t22.status, 'followedUp');
    assert.equal(t22.sameAuthor, false);
    assert.equal(t22.sharedWithOtherPrs, true);
    assert.ok(bench.aggregates.production.outcomes.sharedFollowUpOutcomes >= 2);

    // Check PR #23: deletion is targetDeleted, never a hit
    const pr23 = bench.prs.find((p) => p.prNumber === 23)!;
    const t23 = pr23.policies.production.questions.find((q) => q.id === 'check:companion:src/c.ts')!.targets[0]!;
    assert.equal(t23.status, 'targetDeleted');

    // Check PR #24: rename tracked to src/d-renamed.ts, followedUp: true, targetRenamed: true, and .mailmap resolves Alice's alt email to sameAuthor: true!
    const pr24 = bench.prs.find((p) => p.prNumber === 24)!;
    const t24 = pr24.policies.production.questions.find((q) => q.id === 'check:companion:src/d.ts')!.targets[0]!;
    assert.equal(t24.status, 'followedUp');
    assert.equal(t24.targetRenamed, true);
    assert.equal(t24.renamedTo, 'src/d-renamed.ts');
    assert.equal(t24.sameAuthor, true, '.mailmap should map alice-alt@work.example to Alice');

    // Check PR #25: right-censored at tip of branch
    const pr25 = bench.prs.find((p) => p.prNumber === 25)!;
    const t25 = pr25.policies.production.questions[0]!.targets[0]!;
    assert.equal(t25.status, 'censored');

    // Check zero-denominator slices give rate: null (N/A), never 0 or 1
    assert.equal(bench.aggregates.production.breakdowns.byKind['broken-import'].fileFollowUpPrecision.denominator, 0);
    assert.equal(bench.aggregates.production.breakdowns.byKind['broken-import'].fileFollowUpPrecision.rate, null);
    assert.equal(bench.aggregates.production.breakdowns.byKind['broken-import'].fileFollowUpPrecision.interval, null);
  } finally {
    repo.cleanup();
  }
});

test('cache equivalence and resumability: cache on vs off produces identical results; crash + --resume recovers truncated lines and refuses mismatched settings', async () => {
  const repo = new TempRepo();
  const outCacheOn = mkdtempSync(join(tmpdir(), 'gutter-bench-cache-on-'));
  const outCacheOff = mkdtempSync(join(tmpdir(), 'gutter-bench-cache-off-'));
  const outResume = mkdtempSync(join(tmpdir(), 'gutter-bench-resume-'));
  try {
    repo.write({
      'src/a.ts': 'export const a = 0;\n',
      'src/b.ts': 'export const b = 0;\n',
    });
    commitWithMeta(repo, 'init', { dateIso: '2026-01-01T00:00:00Z' });

    for (let i = 1; i <= 8; i++) {
      repo.write({
        'src/a.ts': `export const a = ${i};\n`,
        'src/b.ts': `export const b = ${i};\n`,
      });
      commitWithMeta(repo, `feat: pair ${i}`, { dateIso: `2026-01-0${i + 1}T00:00:00Z` });
    }

    repo.write({ 'src/a.ts': 'export const a = 10;\n' });
    commitWithMeta(repo, 'feat: pr 1 (#1)', { dateIso: '2026-01-12T00:00:00Z' });
    repo.write({ 'src/b.ts': 'export const b = 10;\n' });
    commitWithMeta(repo, 'fix: pr 2 (#2)', { dateIso: '2026-01-13T00:00:00Z' });
    repo.write({ 'src/a.ts': 'export const a = 11;\n' });
    commitWithMeta(repo, 'feat: pr 3 (#3)', { dateIso: '2026-01-25T00:00:00Z' });

    const fixedNow = new Date('2026-11-08T12:00:00Z');
    const resCacheOn = await runBench({
      cwd: repo.dir,
      outDir: outCacheOn,
      raCache: true,
      now: fixedNow,
    });
    const resCacheOff = await runBench({
      cwd: repo.dir,
      outDir: outCacheOff,
      raCache: false,
      now: fixedNow,
    });

    // Compare everything except timings and settings.raCacheEnabled
    assert.deepEqual(resCacheOn.prs, resCacheOff.prs);
    assert.deepEqual(resCacheOn.aggregates, resCacheOff.aggregates);
    assert.deepEqual(resCacheOn.funnel, resCacheOff.funnel);

    // Simulate crash after 1 PR
    await assert.rejects(
      () =>
        runBench({
          cwd: repo.dir,
          outDir: outResume,
          failAfterPrs: 1,
          now: fixedNow,
        }),
      /Simulated crash after 1 PR/,
    );

    // Append a truncated corrupt line to bench.partial.jsonl to test recovery
    const partialFile = join(outResume, 'bench.partial.jsonl');
    appendFileSync(partialFile, '{"type":"pr","bucket":"pr","record":{"id":"#truncated', 'utf8');

    // Refuses to resume when a setting changes (e.g. windowDays: 14 instead of 7)
    await assert.rejects(
      () =>
        runBench({
          cwd: repo.dir,
          outDir: outResume,
          windowDays: 14,
          resume: true,
          now: fixedNow,
        }),
      /Refusing to --resume: run identity mismatch on settingsHash/,
    );

    // Resumes cleanly with matching settings, recovering from the truncated last line and producing identical results
    const resResumed = await runBench({
      cwd: repo.dir,
      outDir: outResume,
      resume: true,
      now: fixedNow,
    });
    assert.deepEqual(resResumed.prs, resCacheOn.prs);
    assert.deepEqual(resResumed.aggregates, resCacheOn.aggregates);

    // Verify no duplicate PR records exist in bench.partial.jsonl
    const partialLines = readFileSync(partialFile, 'utf8')
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => JSON.parse(l) as { record: { id: string } });
    const ids = partialLines.map((l) => l.record.id);
    assert.equal(ids.length, new Set(ids).size);
  } finally {
    repo.cleanup();
    rmSync(outCacheOn, { recursive: true, force: true });
    rmSync(outCacheOff, { recursive: true, force: true });
    rmSync(outResume, { recursive: true, force: true });
  }
});
