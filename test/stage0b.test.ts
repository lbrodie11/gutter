import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { replayBriefWithMeta } from '../src/brief.ts';
import { parseGutterConfigObject, validateRaRepoConfig } from '../src/config.ts';
import type { ChecklistItem, ForgottenItem } from '../src/contract.ts';
import { buildChecklist, passesProvenPairGate } from '../src/evidence/checklist.ts';
import { attachTrackRecords } from '../src/bench/runner.ts';
import { normalizeTrackRecord, toForgotten, trackRecordsByTarget, type CompanionTrackRecord, type RaDiff } from '../src/sources/archaeology.ts';
import { question, target } from './bench-fixtures.ts';
import { raDiffFixture, TempRepo } from './helpers.ts';

// ---- RA 0.10.0 `trackRecord` shapes (docs/json.md 5.2.1, schema/common.schema.json#/$defs/TrackRecord) ----

const FIRED = {
  fired: 5, confirmed: 4, triggers: 7, coChanged: 7, precision: 0.8,
  interval: { low: 0.3755, high: 0.9638 }, windowHours: 48,
  evaluated: { from: '2026-03-01', to: '2026-11-01', commits: 400, trainingCommits: 1600 },
  excluded: { censored: 1, targetDeleted: 0, clockSkew: 0 },
};
const NEVER_FIRED = {
  fired: 0, reason: 'never_fired', triggers: 2, coChanged: 0, windowHours: 48,
  evaluated: { from: '2026-03-01', to: '2026-11-01', commits: 400, trainingCommits: 1600 },
  excluded: { censored: 2, targetDeleted: 0, clockSkew: 0 },
};
const LIMITED = { reason: 'limited_history' };

test('adapter: RA 0.10 trackRecord shapes normalize to fired / never_fired / limited_history; malformed shapes are dropped', () => {
  assert.deepEqual(normalizeTrackRecord(FIRED), { fired: 5, confirmed: 4, precision: 0.8, reason: null });
  assert.deepEqual(normalizeTrackRecord(NEVER_FIRED), { fired: 0, confirmed: null, precision: null, reason: 'never_fired' });
  assert.deepEqual(normalizeTrackRecord({ fired: 0, reason: 'never_fired' }), { fired: 0, confirmed: null, precision: null, reason: 'never_fired' });
  assert.deepEqual(normalizeTrackRecord(LIMITED), { fired: null, confirmed: null, precision: null, reason: 'limited_history' });

  // Hostile or future shapes never pass as "fired".
  for (const bad of [
    undefined, null, [], 'x', 7,
    { fired: 3, confirmed: 4 },
    { fired: '3', confirmed: 1 },
    { fired: 3.5, confirmed: 1 },
    { fired: 0, confirmed: 0 },
    { fired: 4, reason: 'never_fired' },
    { fired: 9, confirmed: 2, reason: 'something_new' },
  ]) {
    assert.equal(normalizeTrackRecord(bad), undefined, JSON.stringify(bad));
  }
  // An out-of-range precision is kept out, but the counts still stand.
  assert.deepEqual(normalizeTrackRecord({ ...FIRED, precision: 1.7 }), { fired: 5, confirmed: 4, precision: null, reason: null });
});

function diff010(): RaDiff {
  const d = raDiffFixture({ tool: { name: 'repo-archaeology', version: '0.10.0' } });
  d.suggestions[0]!.trackRecord = FIRED;
  d.suggestions[1]!.trackRecord = LIMITED;
  return d;
}

test('adapter: trackRecordsByTarget keys by suggested file; toForgotten (gutter.json) never carries trackRecord', () => {
  const d = diff010();
  const map = trackRecordsByTarget(d);
  assert.deepEqual(map.get('db/schema.sql'), { fired: 5, confirmed: 4, precision: 0.8, reason: null });
  assert.equal(map.get('src/legacy.ts')?.reason, 'limited_history');
  assert.equal(trackRecordsByTarget(undefined).size, 0);
  assert.equal(trackRecordsByTarget(raDiffFixture()).size, 0, 'RA < 0.10 has no track records');

  const layer = toForgotten(d, { maxItems: 3, maxEvidence: 5 });
  assert.ok(!JSON.stringify(layer).includes('trackRecord'), 'gutter.json schema v1 stays frozen');
  assert.ok(!JSON.stringify(layer).includes('limited_history'));
});

// ---- V4 gate -----------------------------------------------------------------------------

const V4 = parseGutterConfigObject({ minIntervalLow: 0.3, companionRequireGhost: true, companionMinTrackRecordFired: 3 });
const fired = (n: number): CompanionTrackRecord => ({ fired: n, confirmed: Math.min(1, n), precision: n ? Math.min(1, n) / n : null, reason: null });

test('V4 gate: ghost + fired >= 3 + interval.low >= 0.3 keeps the question; each missing condition drops it', () => {
  assert.deepEqual(V4, { minIntervalLow: 0.3, companionRequireGhost: true, companionMinTrackRecordFired: 3 });

  assert.equal(passesProvenPairGate({ relationship: 'ghost' }, fired(3), V4), true);
  assert.equal(passesProvenPairGate({ relationship: 'ghost' }, fired(12), V4), true);
  assert.equal(passesProvenPairGate({ relationship: 'unknown' }, fired(12), V4), false, 'not ghost');
  assert.equal(passesProvenPairGate({ relationship: 'indirect' }, fired(12), V4), false, 'not ghost');
  assert.equal(passesProvenPairGate({ relationship: 'ghost' }, fired(2), V4), false, 'fired < 3');
  assert.equal(passesProvenPairGate({ relationship: 'ghost' }, { fired: 0, confirmed: null, precision: null, reason: 'never_fired' }, V4), false);
  assert.equal(passesProvenPairGate({ relationship: 'ghost' }, { fired: null, confirmed: null, precision: null, reason: 'limited_history' }, V4), false);
  assert.equal(passesProvenPairGate({ relationship: 'ghost' }, undefined, V4), false, 'no track record (RA < 0.10)');

  // Defaults: the gate is off, so nothing changes.
  assert.equal(passesProvenPairGate({ relationship: 'unknown' }, undefined, {}), true);
  assert.equal(passesProvenPairGate({ relationship: 'unknown' }, undefined, undefined), true);
});

function forgottenItem(file: string, relationship: ForgottenItem['relationship'], low: number): ForgottenItem {
  return {
    id: `forgotten:${file}`, changed: 'src/a.ts', file, relationship, why: 'w', shared: 8, changedTotal: 10,
    confidence: 0.8, interval: { low, high: 0.95 }, evidence: [], automationShare: 0, alsoLinkedFrom: [],
  };
}

test('V4 gate inside buildChecklist: only the proven ghost pair above the interval floor becomes a question', () => {
  const items = [
    forgottenItem('src/proven.ts', 'ghost', 0.45),
    forgottenItem('src/low.ts', 'ghost', 0.25),
    forgottenItem('src/unknown.ts', 'unknown', 0.6),
    forgottenItem('src/young.ts', 'ghost', 0.6),
    forgottenItem('src/thin.ts', 'ghost', 0.6),
  ];
  const trackRecords = new Map<string, CompanionTrackRecord>([
    ['src/proven.ts', fired(4)],
    ['src/low.ts', fired(9)],
    ['src/unknown.ts', fired(9)],
    ['src/young.ts', fired(2)],
    ['src/thin.ts', { fired: null, confirmed: null, precision: null, reason: 'limited_history' }],
  ]);
  const input = {
    changes: { files: [], modules: [], totals: { files: 1, additions: 1, deletions: 0, modules: 1 } },
    dependents: { analyzers: ['ts'], entries: [], unchecked: [], coverage: 'full' as const, unresolved: { count: 0, samples: [] }, scannedFiles: 0 },
    forgotten: { status: 'analyzed' as const, items, total: items.length, families: [], commitsAnalyzed: 100, warnings: [] },
    tests: [],
    calibration: { status: 'thin' as const, note: 'n' },
    trackRecords,
  };
  const companions = (list: ChecklistItem[]) => list.filter((c) => c.kind === 'forgotten-companion').map((c) => c.id);

  assert.deepEqual(companions(buildChecklist({ ...input, config: { ...V4, maxCompanionQuestions: 5 } })), ['check:companion:src/proven.ts']);
  // Default config: the gate is off, the 0.3 floor and the 2-question cap apply as before.
  assert.deepEqual(companions(buildChecklist({ ...input, config: {} })), ['check:companion:src/proven.ts', 'check:companion:src/unknown.ts']);
});

test('config: V4 and skipReverts parse exactly; invalid values are dropped or rejected', () => {
  assert.deepEqual(parseGutterConfigObject({ companionMinTrackRecordFired: 2.5, companionRequireGhost: 'yes' }), {});
  assert.deepEqual(parseGutterConfigObject({ companionMinTrackRecordFired: 0 }), {});
  assert.deepEqual(validateRaRepoConfig('{"skipReverts": false, "minShared": 3}'), { valid: true, config: { minShared: 3, skipReverts: false } });
  assert.equal(validateRaRepoConfig('{"skipReverts": "no"}').valid, false);
});

test('bench: attachTrackRecords copies track records onto forgotten-companion records only', () => {
  const q = [
    question('forgotten-companion', target({ file: 'src/b.ts', followedUp: true })),
    question('forgotten-companion', target({ file: 'src/none.ts', followedUp: false })),
    question('family-drift', target({ file: 'src/b.ts', followedUp: true }), null),
  ];
  const out = attachTrackRecords(q, new Map([['src/b.ts', fired(6)]]));
  assert.deepEqual(out[0]!.trackRecord, fired(6));
  assert.equal(out[1]!.trackRecord, undefined);
  assert.equal(out[2]!.trackRecord, undefined, 'family-drift targets are not pairs');
});

test('consumer: the installed repo-archaeology 0.10 library returns a track record that the V4 gate reads, and gutter.json omits it', async () => {
  const repo = new TempRepo();
  try {
    // One commit per day, so every 48 h track-record window can complete.
    const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString();
    const commitOn = (i: number, msg: string) => {
      repo.git('add', '-A');
      execFileSync('git', ['commit', '-q', '-m', msg], {
        cwd: repo.dir,
        env: { ...process.env, GIT_AUTHOR_NAME: 'Ana', GIT_AUTHOR_EMAIL: 'ana@example.com', GIT_COMMITTER_NAME: 'Ana',
          GIT_COMMITTER_EMAIL: 'ana@example.com', GIT_AUTHOR_DATE: day(i), GIT_COMMITTER_DATE: day(i),
          GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
      });
    };
    repo.write({ 'src/a.ts': 'export const a = 0;\n', 'src/b.ts': 'export const b = 0;\n' });
    commitOn(0, 'init');
    for (let i = 1; i <= 40; i++) {
      repo.write({ 'src/a.ts': `export const a = ${i};\n`, 'src/b.ts': `export const b = ${i};\n` });
      commitOn(i, `feat: a and b ${i}`);
    }
    // Episodes for the replay window: a changes alone, then b follows a day later.
    for (let i = 41; i <= 72; i++) {
      const file = i % 2 === 1 ? 'src/a.ts' : 'src/b.ts';
      repo.write({ [file]: `export const ${file.includes('a.ts') ? 'a' : 'b'} = ${i};\n` });
      commitOn(i, `chore: touch ${file} ${i}`);
    }
    const base = repo.git('rev-parse', 'HEAD').trim();
    repo.branch('feature');
    repo.write({ 'src/a.ts': 'export const a = 999;\n' });
    commitOn(80, 'feat: a only');
    const head = repo.git('rev-parse', 'HEAD').trim();

    const res = await replayBriefWithMeta({ cwd: repo.dir, base, head, title: 'feat: a only', noCalibration: true });
    assert.match(res.meta.raVersion ?? '', /^0\.10\./, 'bench runs on the pinned repo-archaeology 0.10.x');
    const suggestion = res.meta.raDiff?.suggestions.find((s) => s.to === 'src/b.ts');
    assert.ok(suggestion, 'b is suggested');
    const tr = normalizeTrackRecord(suggestion.trackRecord);
    assert.ok(tr && tr.reason === null && (tr.fired ?? 0) >= 3, `expected a measured track record, got ${JSON.stringify(suggestion.trackRecord)}`);
    assert.ok(!JSON.stringify(res.brief).includes('trackRecord'), 'gutter.json schema v1 is unchanged');

    // Default brief asks about b; with V4 the answer depends only on the relationship (RA calls this pair "unknown":
    // both files are plain constants with no shared signal), so V4 drops it.
    assert.ok(res.brief.checklist.some((c) => c.id === 'check:companion:src/b.ts'));
    const gated = await replayBriefWithMeta({ cwd: repo.dir, base, head, title: 'feat: a only', noCalibration: true, config: V4 });
    const rel = gated.brief.forgotten.items.find((f) => f.file === 'src/b.ts')?.relationship;
    assert.equal(
      gated.brief.checklist.some((c) => c.id === 'check:companion:src/b.ts'),
      rel === 'ghost',
      `V4 keeps the question only for a ghost pair (relationship: ${rel})`,
    );

    // The fired threshold alone, against the real library's numbers.
    const at = async (n: number) =>
      (await replayBriefWithMeta({ cwd: repo.dir, base, head, title: 'x', noCalibration: true, config: { companionMinTrackRecordFired: n } }))
        .brief.checklist.some((c) => c.id === 'check:companion:src/b.ts');
    assert.equal(await at(tr.fired!), true, `fired = ${tr.fired} meets a threshold of ${tr.fired}`);
    assert.equal(await at(tr.fired! + 1), false, 'one more than fired drops it');
  } finally {
    repo.cleanup();
  }
});
