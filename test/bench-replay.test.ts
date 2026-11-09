import { test } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBrief, replayBrief, replayBriefWithMeta } from '../src/brief.ts';
import { validateRaRepoConfig } from '../src/config.ts';
import { analyzeMergeResolution, discoverChangeUnits } from '../src/bench/discover.ts';
import { GitTreeReader, WorkingTreeReader } from '../src/source/reader.ts';
import { loadRaLibrary, RaLibUnavailableError } from '../src/sources/archaeology-lib.ts';
import { git, resolveSha } from '../src/git.ts';
import { lines, TempRepo } from './helpers.ts';

test('discoverChangeUnits: classifies merge-commit, unnumbered merge, squash (#n), rebase series, cherry-pick (#n), octopus, direct push, and --include-unnumbered with exact funnel counts', () => {
  const repo = new TempRepo();
  try {
    // 1. Root commit (not-a-pr / rootCommit)
    repo.write({ 'src/init.ts': 'export const init = 1;\n' }).commit('initial commit');

    // 2. Direct push (not-a-pr unless --include-unnumbered)
    repo.write({ 'src/direct.ts': 'export const direct = 1;\n' }).commit('chore: direct push on main');

    // 3. Rebase-merged series (2 commits without (#n), skipped as not-a-pr)
    repo.write({ 'src/rebase1.ts': 'export const r1 = 1;\n' }).commit('feat: rebase part 1');
    repo.write({ 'src/rebase2.ts': 'export const r2 = 1;\n' }).commit('feat: rebase part 2');

    // 4. Squash PR (#10)
    repo.write({ 'src/squash.ts': 'export const sq = 1;\n' }).commit('feat: add squash feature (#10)');
    const squashSha = resolveSha(repo.dir, 'HEAD')!;

    // 5. Cherry-pick carrying (#10) -> still squash-subject / medium, distinct ID
    repo.write({ 'src/cherry.ts': 'export const cp = 1;\n' }).commit('fix: backport squash feature (#10)');

    // 6. Merge-commit PR (#12) -> merge-commit / high
    repo.branch('pr-12');
    repo.write({ 'src/pr12.ts': 'export const pr12 = 1;\n' }).commit('feat: pr 12 work');
    repo.git('checkout', '-q', 'main');
    repo.git('merge', '--no-ff', 'pr-12', '-m', 'Merge pull request #12 from org/pr-12');

    // 7. Unnumbered merge commit -> merge-commit / medium
    repo.branch('feature-unnumbered');
    repo.write({ 'src/unnum.ts': 'export const un = 1;\n' }).commit('feat: unnumbered branch work');
    repo.git('checkout', '-q', 'main');
    repo.git('merge', '--no-ff', 'feature-unnumbered', '-m', "Merge branch 'feature-unnumbered'");

    // 8. Octopus merge (>2 parents) -> skipped: octopus
    repo.branch('octo-a');
    repo.write({ 'src/octo-a.ts': 'export const oa = 1;\n' }).commit('feat: octo a');
    repo.git('checkout', '-q', 'main');
    repo.branch('octo-b');
    repo.write({ 'src/octo-b.ts': 'export const ob = 1;\n' }).commit('feat: octo b');
    repo.git('checkout', '-q', 'main');
    repo.git('merge', '--no-ff', 'octo-a', 'octo-b', '-m', 'Merge branches octo-a and octo-b');

    const defaultDiscovery = discoverChangeUnits({ cwd: repo.dir });
    assert.equal(defaultDiscovery.funnel.discovered, 9);
    assert.deepEqual(defaultDiscovery.funnel.classified, {
      mergeCommitHigh: 1,
      mergeCommitMedium: 1,
      squashMedium: 2,
      octopus: 1,
      notAPr: 4, // root + direct + 2 rebase commits
      changeUnitLow: 0,
    });
    assert.equal(defaultDiscovery.funnel.eligible, 4);
    assert.equal(defaultDiscovery.funnel.exclusions.octopus, 1);
    assert.equal(defaultDiscovery.funnel.exclusions.notAPr, 4);
    assert.equal(defaultDiscovery.funnel.exclusions.rootCommit, 1);
    assert.equal(defaultDiscovery.eligibleChangeUnits.length, 0);

    // Check cherry-pick carrying (#10) has confidence 'medium' and distinct ID from original (#10)
    const pr10Units = defaultDiscovery.eligiblePrs.filter((u) => u.prNumber === 10);
    assert.equal(pr10Units.length, 2);
    assert.notEqual(pr10Units[0]!.id, pr10Units[1]!.id);
    for (const u of pr10Units) {
      assert.equal(u.detection, 'squash-subject');
      assert.equal(u.confidence, 'medium');
    }
    const origSquash = pr10Units.find((u) => u.head === squashSha)!;
    assert.ok(origSquash);

    // With --include-unnumbered: the 3 1-parent non-PR commits become change-unit / low (reported separately, never pooled with PRs)
    const withUnnumbered = discoverChangeUnits({ cwd: repo.dir, includeUnnumbered: true });
    assert.equal(withUnnumbered.funnel.discovered, 9);
    assert.deepEqual(withUnnumbered.funnel.classified, {
      mergeCommitHigh: 1,
      mergeCommitMedium: 1,
      squashMedium: 2,
      octopus: 1,
      notAPr: 1, // root commit only
      changeUnitLow: 3, // direct + 2 rebase commits
    });
    assert.equal(withUnnumbered.funnel.eligible, 4, 'PR eligible count must never pool change-units');
    assert.equal(withUnnumbered.funnel.changeUnitsEligible, 3);
    assert.equal(withUnnumbered.eligibleChangeUnits.length, 3);
    for (const cu of withUnnumbered.eligibleChangeUnits) {
      assert.equal(cu.detection, 'change-unit');
      assert.equal(cu.confidence, 'low');
    }
  } finally {
    repo.cleanup();
  }
});

test('GitTreeReader: enforces max-bytes cap, binary detection, non-followed symlinks, and path traversal rejection', () => {
  const repo = new TempRepo();
  try {
    repo.write({
      'src/normal.ts': 'export const ok = 1;\n',
      'src/big.ts': 'x'.repeat(2048),
    });
    // Binary file with NUL byte
    writeFileSync(join(repo.dir, 'src/binary.ts'), Buffer.from([0x65, 0x78, 0x00, 0x61]));
    // Symlink inside repo
    symlinkSync('normal.ts', join(repo.dir, 'src/link.ts'));
    repo.commit('add files');

    const headSha = resolveSha(repo.dir, 'HEAD')!;
    const reader = new GitTreeReader(repo.dir, headSha, 1024);
    try {
      assert.equal(reader.hasFile('src/normal.ts'), true);
      assert.equal(reader.readText('src/normal.ts'), 'export const ok = 1;\n');

      // Bounded blob read (2048 > 1024 maxBytes)
      assert.equal(reader.readText('src/big.ts'), undefined);
      assert.equal(reader.readText('src/big.ts', 4096)?.length, 2048);

      // Binary detection (contains NUL byte)
      assert.equal(reader.readText('src/binary.ts', 4096), undefined);

      // Symlink treated as non-followed entry
      assert.equal(reader.isNonRegularEntry('src/link.ts'), true);
      assert.equal(reader.hasFile('src/link.ts'), false);
      assert.equal(reader.readText('src/link.ts'), undefined);
      assert.equal(reader.listFiles().includes('src/link.ts'), false);

      // Path traversal rejected
      assert.equal(reader.hasFile('../package.json'), false);
      assert.equal(reader.readText('../package.json'), undefined);
      assert.equal(reader.readText('src/../../etc/passwd'), undefined);
      assert.equal(reader.readText('/etc/passwd'), undefined);
    } finally {
      reader.close();
    }

    // WorkingTreeReader also rejects symlinks, binary files, and path traversal
    const wtReader = new WorkingTreeReader(repo.dir, 1024);
    assert.equal(wtReader.readText('src/normal.ts'), 'export const ok = 1;\n');
    assert.equal(wtReader.readText('src/big.ts'), undefined);
    assert.equal(wtReader.readText('src/binary.ts', 4096), undefined);
    assert.equal(wtReader.hasFile('src/link.ts'), false);
    assert.equal(wtReader.readText('src/link.ts'), undefined);
    assert.equal(wtReader.readText('../package.json'), undefined);
  } finally {
    repo.cleanup();
  }
});

test('golden equivalence: replayBrief() at HEAD and buildBrief() produce identical checklists and salience', async () => {
  const repo = new TempRepo();
  try {
    repo.write({
      'src/core.ts': 'export const core = () => 1;\n',
      'src/companion.ts': 'export const comp = () => 1;\n',
      'src/consumer.ts': "import { core } from './core.ts';\nexport const use = () => core();\n",
      'test/core.test.ts': "import { core } from '../src/core.ts';\n",
    }).commit('init');

    // Co-change core.ts and companion.ts 8 times so Repo Archaeology finds a strong companion
    for (let i = 1; i <= 8; i++) {
      repo.write({
        'src/core.ts': `export const core = () => ${i + 1};\n`,
        'src/companion.ts': `export const comp = () => ${i + 1};\n`,
      }).commit(`feat: co-change ${i}`);
    }

    const baseSha = resolveSha(repo.dir, 'HEAD')!;
    repo.branch('feature/edit-core');
    repo.write({
      'src/core.ts': `export const core = () => 999;\n${lines(20)}`,
    }).commit('feat: update core only');

    const localRaCli = join(process.cwd(), 'node_modules', 'repo-archaeology', 'dist', 'cli.js');
    const fixedNow = new Date('2026-11-08T12:00:00Z');

    const syncBrief = buildBrief({
      cwd: repo.dir,
      base: baseSha,
      runner: { bin: localRaCli },
      now: fixedNow,
    });
    const replayedBrief = await replayBrief({
      cwd: repo.dir,
      base: baseSha,
      head: 'HEAD',
      now: fixedNow,
    });

    assert.deepEqual(replayedBrief.salience, syncBrief.salience);
    assert.deepEqual(replayedBrief.checklist, syncBrief.checklist);
    assert.deepEqual(replayedBrief.dependents, syncBrief.dependents);
    assert.deepEqual(replayedBrief.tests, syncBrief.tests);
    assert.ok(replayedBrief.checklist.some((c) => c.kind === 'forgotten-companion'));
    assert.ok(replayedBrief.checklist.some((c) => c.kind === 'untested-change'));
  } finally {
    repo.cleanup();
  }
});

test('leakage: later commits, later .gutter.json, later tsconfig, later imports, and later tests do not change PR #11 brief byte-for-byte vs truncated clone', async () => {
  const repo = new TempRepo();
  const truncDir = mkdtempSync(join(tmpdir(), 'gutter-trunc-'));
  try {
    repo.write({
      'package.json': JSON.stringify({ name: 'leak-fixture', dependencies: { lodash: '^4.0.0' } }, null, 2),
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': 'export const b = 1;\n',
      'src/caller.ts': "import { a } from './a.ts';\nexport const call = () => a;\n",
    }).commit('init');

    for (let i = 1; i <= 10; i++) {
      repo.write({
        'src/a.ts': `export const a = ${i + 1};\n`,
        'src/b.ts': `export const b = ${i + 1};\n`,
      }).commit(`feat: pair change ${i}`);
    }

    const pr11BaseSha = resolveSha(repo.dir, 'HEAD')!;
    repo.write({
      'src/a.ts': `export const a = 100;\n${lines(15)}`,
    }).commit('feat: change A in PR (#11)');
    const pr11HeadSha = resolveSha(repo.dir, 'HEAD')!;

    // Create a clone truncated strictly at PR #11
    git(truncDir, ['clone', '-q', repo.dir, '.']);
    git(truncDir, [' remote', 'remove', 'origin'].map((s) => s.trim()));
    git(truncDir, ['checkout', '-q', pr11HeadSha]);

    // Now add future commits on repo after PR #11:
    // - Future co-changes between a.ts and future-partner.ts
    // - Future test file test/a.test.ts
    // - Future importer src/future-importer.ts (would trigger wide-surface if leaked)
    // - Future tsconfig.json with path aliases
    // - Future .gutter.json that disables history and suppresses questions
    // - Future .repo-archaeology.json that sets minShared: 999
    for (let i = 1; i <= 12; i++) {
      repo.write({
        'src/a.ts': `export const a = ${200 + i};\n${lines(15)}`,
        'src/future-partner.ts': `export const fp = ${i};\n`,
      }).commit(`feat: future pair ${i} (#${20 + i})`);
    }
    repo.write({
      'test/a.test.ts': "import { a } from '../src/a.ts';\n",
      'src/future-imp-1.ts': "import { a } from './a.ts';\n",
      'src/future-imp-2.ts': "import { a } from './a.ts';\n",
      'src/future-imp-3.ts': "import { a } from './a.ts';\n",
      'src/future-imp-4.ts': "import { a } from './a.ts';\n",
      'src/future-imp-5.ts': "import { a } from './a.ts';\n",
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@future/*': ['src/*'] } } }),
      '.gutter.json': JSON.stringify({ noHistory: true, maxChecklist: 0, minIntervalLow: 0.99 }),
      '.repo-archaeology.json': JSON.stringify({ minShared: 999, minConfidence: 0.99 }),
    }).commit('chore: future config, tests, and importers (#99)');

    const fixedNow = new Date('2026-11-08T00:00:00.000Z');
    const briefFromFullRepo = await replayBrief({
      cwd: repo.dir,
      base: pr11BaseSha,
      head: pr11HeadSha,
      now: fixedNow,
    });
    const briefFromTruncatedClone = await replayBrief({
      cwd: truncDir,
      base: pr11BaseSha,
      head: pr11HeadSha,
      now: fixedNow,
    });

    assert.equal(
      JSON.stringify(briefFromFullRepo, null, 2),
      JSON.stringify(briefFromTruncatedClone, null, 2),
      'replayBrief on full repo with future commits/configs must match truncated clone byte for byte',
    );
    assert.ok(briefFromFullRepo.checklist.some((c) => c.id === 'check:companion:src/b.ts'));
    assert.ok(!briefFromFullRepo.checklist.some((c) => c.id.includes('future-partner')));
  } finally {
    repo.cleanup();
    rmSync(truncDir, { recursive: true, force: true });
  }
});

test('merge semantics: conflict resolution editing a suggested file sets mergeDiffers and resolvedAtMerge', async () => {
  const repo = new TempRepo();
  try {
    repo.write({
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': 'export const b = 1;\n',
    }).commit('init');

    for (let i = 1; i <= 8; i++) {
      repo.write({
        'src/a.ts': `export const a = ${i + 1};\n`,
        'src/b.ts': `export const b = ${i + 1};\n`,
      }).commit(`feat: pair ${i}`);
    }

    // Create PR branch that edits only src/a.ts
    repo.branch('pr-conflict');
    repo.write({
      'src/a.ts': `export const a = 100;\n${lines(12)}`,
    }).commit('feat: edit a only on branch');

    // Meanwhile on main, make a commit and merge pr-conflict while also resolving/editing src/b.ts in the merge commit
    repo.git('checkout', '-q', 'main');
    repo.write({ 'README.md': '# Main update\n' }).commit('docs: update readme on main');
    repo.git('merge', '--no-ff', '--no-commit', 'pr-conflict');
    repo.write({ 'src/b.ts': 'export const b = 100; // updated during merge conflict resolution\n' });
    repo.git('add', 'src/b.ts');
    repo.git('commit', '-q', '-m', 'Merge pull request #42 from org/pr-conflict');

    const discovery = discoverChangeUnits({ cwd: repo.dir });
    const pr42 = discovery.eligiblePrs.find((p) => p.prNumber === 42)!;
    assert.ok(pr42);
    assert.equal(pr42.detection, 'merge-commit');
    assert.equal(pr42.confidence, 'high');

    const { brief, ungatedBrief } = await replayBriefWithMeta({
      cwd: repo.dir,
      base: pr42.base,
      head: pr42.head,
    });
    const mergeCheck = analyzeMergeResolution(repo.dir, pr42, [brief, ungatedBrief]);
    assert.equal(mergeCheck.mergeDiffers, true);
    assert.ok(mergeCheck.mergeDifferingFiles.includes('src/b.ts'));
    assert.equal(mergeCheck.resolvedAtMergeTargets.has('src/b.ts'), true);
  } finally {
    repo.cleanup();
  }
});

test('edge cases: shallow clone marks history unavailable and timestamp anomaly is flagged', async () => {
  const repo = new TempRepo();
  const shallowDir = mkdtempSync(join(tmpdir(), 'gutter-shallow-'));
  try {
    const commitAt = (msg: string, dateIso: string) => {
      repo.git('add', '-A');
      childProcess.execFileSync('git', ['commit', '-q', '-m', msg], {
        cwd: repo.dir,
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Test',
          GIT_AUTHOR_EMAIL: 't@example.com',
          GIT_COMMITTER_NAME: 'Test',
          GIT_COMMITTER_EMAIL: 't@example.com',
          GIT_AUTHOR_DATE: dateIso,
          GIT_COMMITTER_DATE: dateIso,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
        },
      });
    };

    repo.write({ 'src/a.ts': 'export const a = 1;\n' });
    commitAt('init', '2026-06-10T12:00:00Z');
    // Commit with an earlier committer timestamp than its parent -> timestampAnomaly
    repo.write({ 'src/a.ts': 'export const a = 2;\n' });
    commitAt('feat: backdated squash (#5)', '2026-06-01T12:00:00Z');

    const discovery = discoverChangeUnits({ cwd: repo.dir });
    const pr5 = discovery.eligiblePrs.find((p) => p.prNumber === 5)!;
    assert.ok(pr5);
    assert.equal(pr5.timestampAnomaly, true);

    // Create a shallow clone (--depth 1)
    git(shallowDir, ['clone', '-q', '--depth', '1', `file://${repo.dir}`, '.']);
    const shallowHead = resolveSha(shallowDir, 'HEAD')!;
    const res = await replayBriefWithMeta({
      cwd: shallowDir,
      base: shallowHead,
      head: shallowHead,
    });
    assert.equal(res.meta.history, 'unavailable');
    assert.equal(res.brief.forgotten.status, 'unavailable');
  } finally {
    repo.cleanup();
    rmSync(shallowDir, { recursive: true, force: true });
  }
});

test('offline dependency rule: missing or old repo-archaeology library throws exitCode 2 and never spawns npx', async () => {
  const spawnCalls: string[] = [];
  const origSpawn = childProcess.spawn;
  const origExecFileSync = childProcess.execFileSync;

  (childProcess as unknown as { spawn: typeof origSpawn }).spawn = ((command: string, ...rest: unknown[]) => {
    spawnCalls.push(String(command));
    return (origSpawn as (...args: unknown[]) => unknown)(command, ...rest);
  }) as typeof origSpawn;
  (childProcess as unknown as { execFileSync: typeof origExecFileSync }).execFileSync = ((
    command: string,
    ...rest: unknown[]
  ) => {
    spawnCalls.push(String(command));
    return (origExecFileSync as (...args: unknown[]) => unknown)(command, ...rest);
  }) as typeof origExecFileSync;

  const fakeModDir = mkdtempSync(join(tmpdir(), 'gutter-old-ra-'));
  try {
    // 1. Non-existent --ra-lib path -> exitCode 2, no npx spawn
    await assert.rejects(
      () => loadRaLibrary(join(fakeModDir, 'does-not-exist.js')),
      (err: unknown) => {
        assert.ok(err instanceof RaLibUnavailableError);
        assert.equal(err.exitCode, 2);
        assert.match(err.message, /repo-archaeology >= 0\.4\.0/);
        assert.equal(err.message.split('\n').length, 1);
        return true;
      },
    );

    // 2. Old version (< 0.4.0) -> exitCode 2, no npx spawn
    writeFileSync(
      join(fakeModDir, 'package.json'),
      JSON.stringify({ name: 'repo-archaeology', version: '0.3.0', type: 'module' }),
    );
    writeFileSync(join(fakeModDir, 'index.js'), 'export async function openRepository() { return {}; }\n');
    await assert.rejects(
      () => loadRaLibrary(join(fakeModDir, 'index.js')),
      (err: unknown) => {
        assert.ok(err instanceof RaLibUnavailableError);
        assert.equal(err.exitCode, 2);
        assert.match(err.message, /0\.3\.0/);
        return true;
      },
    );

    assert.equal(
      spawnCalls.some((c) => c.includes('npx')),
      false,
      `Expected zero npx spawns, saw: ${spawnCalls.join(', ')}`,
    );
  } finally {
    (childProcess as unknown as { spawn: typeof origSpawn }).spawn = origSpawn;
    (childProcess as unknown as { execFileSync: typeof origExecFileSync }).execFileSync = origExecFileSync;
    rmSync(fakeModDir, { recursive: true, force: true });
  }
});

test('config safety: replayBrief rejects unsafe .repo-archaeology.json cache.dir / maxFilesPerCommit and never writes outside the repo', async () => {
  const repo = new TempRepo();
  const outsideCacheDir = mkdtempSync(join(tmpdir(), 'gutter-outside-cache-'));
  const targetOutsideSubdir = join(outsideCacheDir, 'pwn-cache');
  try {
    // Unit-check validateRaRepoConfig boundaries
    assert.equal(validateRaRepoConfig(JSON.stringify({ cache: { dir: targetOutsideSubdir } })).valid, false);
    assert.equal(validateRaRepoConfig(JSON.stringify({ cache: { dir: '../escape' } })).valid, false);
    assert.equal(validateRaRepoConfig(JSON.stringify({ maxFilesPerCommit: 5000 })).valid, false);
    assert.equal(validateRaRepoConfig(JSON.stringify({ skipCommitPrefixes: ['a'] })).valid, false);
    assert.equal(validateRaRepoConfig(JSON.stringify({ skipCommitPrefixes: ['merge'] })).valid, false);
    assert.equal(validateRaRepoConfig(JSON.stringify({ unknownKey: true })).valid, false);
    assert.equal(
      validateRaRepoConfig(JSON.stringify({ minShared: 2, cache: { enabled: true, dir: '.ra-cache' } })).valid,
      true,
    );

    repo.write({
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': 'export const b = 1;\n',
    }).commit('init');

    for (let i = 1; i <= 6; i++) {
      repo.write({
        'src/a.ts': `export const a = ${i + 1};\n`,
        'src/b.ts': `export const b = ${i + 1};\n`,
      }).commit(`feat: pair ${i}`);
    }

    const baseSha = resolveSha(repo.dir, 'HEAD')!;
    // PR commits a hostile .repo-archaeology.json pointing cache.dir outside the repo
    repo.write({
      '.repo-archaeology.json': JSON.stringify({
        cache: { enabled: true, dir: targetOutsideSubdir },
        maxFilesPerCommit: 5000,
      }),
      'src/a.ts': `export const a = 999;\n${lines(10)}`,
    }).commit('feat: pr with hostile .repo-archaeology.json (#77)');
    const headSha = resolveSha(repo.dir, 'HEAD')!;

    const res = await replayBriefWithMeta({
      cwd: repo.dir,
      base: baseSha,
      head: headSha,
    });
    assert.equal(res.meta.raSettings, undefined, 'invalid .repo-archaeology.json must be rejected');
    assert.equal(existsSync(targetOutsideSubdir), false, 'must never create cache dir outside repo');
    assert.equal(readdirSync(outsideCacheDir).length, 0, 'outside temp dir must remain completely empty');
  } finally {
    repo.cleanup();
    rmSync(outsideCacheDir, { recursive: true, force: true });
  }
});

test('config precedence: CLI gutter brief matches replayBrief on .gutter.json and Action configRef reads base tree', async () => {
  const repo = new TempRepo();
  try {
    repo.write({
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': 'export const b = 1;\n',
    }).commit('init');

    for (let i = 1; i <= 8; i++) {
      repo.write({
        'src/a.ts': `export const a = ${i + 1};\n`,
        'src/b.ts': `export const b = ${i + 1};\n`,
      }).commit(`feat: co-change ${i}`);
    }

    const baseSha = resolveSha(repo.dir, 'HEAD')!;
    repo.write({
      '.gutter.json': JSON.stringify({ maxForgotten: 0, maxChecklist: 0 }),
      'src/a.ts': `export const a = 100;\n${lines(15)}`,
    }).commit('feat: edit a with .gutter.json (#88)');
    const headSha = resolveSha(repo.dir, 'HEAD')!;

    const localRaCli = join(process.cwd(), 'node_modules', 'repo-archaeology', 'dist', 'cli.js');
    const cliPath = join(process.cwd(), 'src', 'cli.ts');

    // 1. CLI `gutter brief` without --max-forgotten honors `.gutter.json` (`maxForgotten: 0, maxChecklist: 0`), matching `replayBrief`
    const cliOut = childProcess.execFileSync(
      process.execPath,
      ['--experimental-strip-types', cliPath, 'brief', '--base', baseSha, '--ra-bin', localRaCli, '--print', 'json'],
      { cwd: repo.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const cliBrief = JSON.parse(cliOut);
    const replayed = await replayBrief({ cwd: repo.dir, base: baseSha, head: headSha });

    assert.equal(cliBrief.forgotten.items.length, 0, 'CLI brief must honor .gutter.json maxForgotten: 0');
    assert.equal(cliBrief.checklist.length, 0, 'CLI brief must honor .gutter.json maxChecklist: 0');
    assert.deepEqual(cliBrief.checklist, replayed.checklist);
    assert.deepEqual(cliBrief.forgotten.items, replayed.forgotten.items);

    // 2. Explicit CLI `--max-forgotten 2` overrides `.gutter.json` (`maxForgotten: 0`)
    const cliOverrideOut = childProcess.execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        cliPath,
        'brief',
        '--base',
        baseSha,
        '--ra-bin',
        localRaCli,
        '--max-forgotten',
        '2',
        '--print',
        'json',
      ],
      { cwd: repo.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const cliOverrideBrief = JSON.parse(cliOverrideOut);
    assert.equal(cliOverrideBrief.forgotten.items.length, 1, 'Explicit --max-forgotten flag must override .gutter.json');

    // 3. Action `configRef: baseSha` reads `.gutter.json` from `base`, so a PR adding `.gutter.json` cannot silence Gutter on itself
    const actionBrief = buildBrief({
      cwd: repo.dir,
      base: baseSha,
      configRef: baseSha,
      runner: { bin: localRaCli },
    });
    assert.ok(actionBrief.checklist.length > 0, 'Action configRef: base must ignore PR-added .gutter.json');
  } finally {
    repo.cleanup();
  }
});
