/**
 * GU-05 · Adopt Repo Archaeology's library API and import resolver.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { NPX_NOTE, buildBriefAsync, replayBriefWithMeta } from '../src/brief.ts';
import type { GutterBrief } from '../src/contract.ts';
import { analyzeWithLibrary, type LoadedRaLibrary, type RaRepositorySession } from '../src/sources/archaeology-lib.ts';
import { TempRepo, lines } from './helpers.ts';

const RA_CLI = resolve('node_modules/repo-archaeology/dist/cli.js');
const repos: TempRepo[] = [];
const dirs: string[] = [];
after(() => {
  repos.forEach((r) => r.cleanup());
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
});

/** A repo whose history couples core.ts with companion.ts, then a PR that changes core.ts only. */
function historyRepo(extra: Record<string, string> = {}): { r: TempRepo; base: string } {
  const r = new TempRepo().write({
    'src/core.ts': 'export const core = () => 1;\n',
    'src/companion.ts': 'export const comp = () => 1;\n',
    'src/consumer.ts': "import { core } from './core.ts';\nexport const use = () => core();\n",
    'src/core.test.ts': "import { core } from './core.ts';\n",
    ...extra,
  }).commit('init');
  for (let i = 1; i <= 8; i++) {
    r.write({ 'src/core.ts': `export const core = () => ${i + 1};\n`, 'src/companion.ts': `export const comp = () => ${i + 1};\n` }).commit(`feat: co-change ${i}`);
  }
  const base = r.git('rev-parse', 'HEAD').trim();
  r.branch('feature');
  r.write({ 'src/core.ts': `export const core = () => 999;\n${lines(20)}` }).commit('feat: core only');
  repos.push(r);
  return { r, base };
}

const NOW = new Date('2026-11-10T12:00:00Z');

/** What GU-05 intentionally changes between paths: provenance and the dependents layer's coverage/analyzer fields. */
function comparable(b: GutterBrief): unknown {
  const c = structuredClone(b) as unknown as Record<string, unknown>;
  delete c.provenance;
  const d = c.dependents as Record<string, unknown>;
  delete d.analyzers;
  delete d.coverage;
  delete d.unresolved;
  delete d.scannedFiles;
  return c;
}

test('parity: library and subprocess briefs agree apart from provenance and dependents coverage fields', async () => {
  const { r, base } = historyRepo();
  const lib = await buildBriefAsync({ cwd: r.dir, base, now: NOW });
  const sub = await buildBriefAsync({ cwd: r.dir, base, now: NOW, raLib: false, runner: { bin: RA_CLI } });
  assert.equal(lib.provenance.engines[1]?.mode, 'library');
  assert.equal(sub.provenance.engines[1]?.mode, 'subprocess');
  assert.deepEqual(comparable(lib), comparable(sub));
  // Documented differences: the analyzer that produced dependents, and the features it adds.
  assert.deepEqual(lib.dependents.analyzers, ['ra-import-graph', 'relative']);
  assert.deepEqual(sub.dependents.analyzers, ['ts-js-relative-imports']);
  assert.ok(lib.provenance.engines[1]!.features!.includes('importGraph'));
  assert.ok(!sub.provenance.engines[1]!.features!.includes('importGraph'));
  for (const f of ['interval', 'origin', 'originShare']) assert.ok(lib.provenance.engines[1]!.features!.includes(f), f);
  // RA's interval and origin are used.
  const item = lib.forgotten.items[0]!;
  assert.ok(item.originShare && item.evidence.every((e) => e.origin === 'human'));
});

test('library: an alias import (@/a) resolves, so coverage is full and the importer is found', async () => {
  const r = new TempRepo()
    .write({
      'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': "import { a } from '@/a';\nexport const b = a;\n",
    })
    .commit('init')
    .branch('f');
  repos.push(r);
  r.write({ 'src/a.ts': `export const a = 2;\n${lines(5)}` }).commit('edit a');
  const b = await buildBriefAsync({ cwd: r.dir, base: 'main', noCalibration: true, now: NOW });
  assert.equal(b.dependents.coverage, 'full');
  assert.deepEqual(b.dependents.entries.map((e) => [e.file, e.untouchedImporters]), [['src/a.ts', ['src/b.ts']]]);
  assert.deepEqual(b.dependents.analyzers, ['ra-import-graph', 'paths']);
  // The fallback scanner could not resolve it.
  const fallback = await buildBriefAsync({ cwd: r.dir, base: 'main', noHistory: true, now: NOW });
  assert.equal(fallback.dependents.coverage, 'partial');
  assert.deepEqual(fallback.dependents.entries, []);
});

test('library: a workspace importer in apps/web of packages/ui/src/button.ts is found', async () => {
  const r = new TempRepo()
    .write({
      'package.json': JSON.stringify({ name: 'root', private: true, workspaces: ['apps/*', 'packages/*'] }),
      'packages/ui/package.json': JSON.stringify({ name: '@acme/ui', version: '1.0.0', exports: { './button': './src/button.ts' } }),
      'packages/ui/src/button.ts': 'export const Button = 1;\n',
      'apps/web/package.json': JSON.stringify({ name: 'web', version: '1.0.0', dependencies: { '@acme/ui': 'workspace:*' } }),
      'apps/web/src/page.ts': "import { Button } from '@acme/ui/button';\nexport const page = Button;\n",
    })
    .commit('init')
    .branch('f');
  repos.push(r);
  r.write({ 'packages/ui/src/button.ts': 'export const Button = 2;\n' }).commit('edit button');
  const b = await buildBriefAsync({ cwd: r.dir, base: 'main', noCalibration: true, now: NOW });
  const entry = b.dependents.entries.find((e) => e.file === 'packages/ui/src/button.ts');
  assert.deepEqual(entry?.untouchedImporters, ['apps/web/src/page.ts']);
  assert.ok(b.dependents.analyzers.some((a) => a === 'workspace' || a === 'exports'), b.dependents.analyzers.join());
});

test('library: importers of a deleted file become a broken import, found through target-missing', async () => {
  const r = new TempRepo()
    .write({ 'src/old.ts': 'export const old = 1;\n', 'src/c.ts': "import { old } from './old.js';\nexport const c = old;\n", 'src/a.ts': 'export const a = 1;\n' })
    .commit('init')
    .branch('f');
  repos.push(r);
  r.rm('src/old.ts');
  r.write({ 'src/a.ts': 'export const a = 2;\n' }).commit('drop old');
  const b = await buildBriefAsync({ cwd: r.dir, base: 'main', noCalibration: true, now: NOW });
  assert.deepEqual(b.dependents.entries.map((e) => [e.file, e.deleted, e.untouchedImporters]), [['src/old.ts', true, ['src/c.ts']]]);
  assert.deepEqual(b.checklist.map((c) => c.kind), ['broken-import']);
  assert.equal(b.dependents.coverage, 'full', 'the dangling import is reported as a broken import, not as a coverage gap');
});

test('fallback chain: no library -> subprocess -> npx (with a note) -> unavailable', { skip: process.platform === 'win32' }, async () => {
  const { r, base } = historyRepo();
  const missing = join(tmpdir(), 'gutter-no-such-ra-lib');
  // 2. --ra-bin subprocess
  const sub = await buildBriefAsync({ cwd: r.dir, base, now: NOW, raLib: missing, runner: { bin: RA_CLI } });
  assert.equal(sub.provenance.engines[1]?.mode, 'subprocess');
  assert.equal(sub.forgotten.status, 'analyzed');
  assert.ok(!(sub.forgotten.note ?? '').includes('npx'));

  // 3. npx: a stand-in `npx` on PATH that runs the local CLI (no network in tests).
  const bin = mkdtempSync(join(tmpdir(), 'gutter-fake-npx-'));
  dirs.push(bin);
  writeFileSync(join(bin, 'npx'), `#!/bin/sh\nshift 2\nexec "${process.execPath}" "${RA_CLI}" "$@"\n`);
  chmodSync(join(bin, 'npx'), 0o755);
  const oldPath = process.env.PATH;
  const oldBin = process.env.GUTTER_RA_BIN;
  delete process.env.GUTTER_RA_BIN;
  process.env.PATH = `${bin}:${oldPath}`;
  try {
    const warnings: string[] = [];
    const viaNpx = await buildBriefAsync({ cwd: r.dir, base, now: NOW, raLib: missing, warn: (m) => warnings.push(m) });
    assert.equal(viaNpx.provenance.engines[1]?.mode, 'npx');
    assert.ok(viaNpx.forgotten.note?.includes(NPX_NOTE), viaNpx.forgotten.note);
    assert.ok(warnings.includes(NPX_NOTE));

    // 4. unavailable: npx fails.
    writeFileSync(join(bin, 'npx'), '#!/bin/sh\necho "npm ERR! network" >&2\nexit 1\n');
    const none = await buildBriefAsync({ cwd: r.dir, base, now: NOW, raLib: missing });
    assert.equal(none.forgotten.status, 'unavailable');
    assert.match(none.forgotten.note ?? '', /Repo Archaeology could not run/);
    assert.equal(none.provenance.engines.length, 1);
    assert.deepEqual(none.dependents.analyzers, ['ts-js-relative-imports'], 'scanner fallback');
  } finally {
    process.env.PATH = oldPath;
    if (oldBin !== undefined) process.env.GUTTER_RA_BIN = oldBin;
  }
});

test('one session: close() runs even when diff throws', async () => {
  let closed = 0;
  const session = {
    root: '/', headSha: 'x',
    diff: async () => { throw new Error('boom'); },
    backtest: async () => { throw new Error('unused'); },
    close: async () => { closed++; },
  } as unknown as RaRepositorySession;
  const lib: LoadedRaLibrary = { openRepository: async () => session, version: '0.10.0' };
  await assert.rejects(
    analyzeWithLibrary(lib, { cwd: '/', head: 'x', base: 'y', changedFiles: [], headFiles: new Set() }),
    /boom/,
  );
  assert.equal(closed, 1);
});

test('one history load per brief: a spy library sees one openRepository, one history phase, then close', async () => {
  const { r, base } = historyRepo();
  const dir = mkdtempSync(join(tmpdir(), 'gutter-ra-spy-'));
  dirs.push(dir);
  const real = resolve('node_modules/repo-archaeology/dist/api/index.js');
  const spy = join(dir, 'spy.mjs');
  writeFileSync(spy, `import * as real from ${JSON.stringify(new URL(`file://${real}`).href)};
export const version = '0.10.0';
export async function openRepository(opts) {
  const log = (globalThis.__gutterRaSpy ??= []);
  log.push('open');
  const repo = await real.openRepository({ ...opts, onProgress: (e) => { log.push('progress:' + e.phase); opts.onProgress?.(e); } });
  const wrap = (name) => async (...args) => { log.push(name); return repo[name](...args); };
  return { root: repo.root, headSha: repo.headSha, diff: wrap('diff'), backtest: wrap('backtest'), importGraph: wrap('importGraph'), close: wrap('close') };
}
`);
  (globalThis as { __gutterRaSpy?: string[] }).__gutterRaSpy = [];
  let sessions = 0;
  const b = await buildBriefAsync({ cwd: r.dir, base, now: NOW, raLib: spy, onSession: (n) => (sessions = n) });
  const log = (globalThis as { __gutterRaSpy?: string[] }).__gutterRaSpy!;
  assert.equal(log.filter((x) => x === 'open').length, 1);
  assert.equal(new Set(log.filter((x) => x === 'progress:history')).size, 1);
  assert.deepEqual(log.filter((x) => !x.startsWith('progress:')), ['open', 'diff', 'backtest', 'importGraph', 'importGraph', 'close']);
  assert.equal(sessions, 1);
  assert.equal(b.provenance.engines[1]?.mode, 'library');
});

test('replay parity: a bench replay at a PR head gives the same dependents as a live brief at that SHA', async () => {
  const { r, base } = historyRepo({
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'src/alias-user.ts': "import { core } from '@/core';\nexport const x = core;\n",
  });
  const head = r.git('rev-parse', 'HEAD').trim();
  const live = await buildBriefAsync({ cwd: r.dir, base, head, now: NOW, noCalibration: true });
  const replay = await replayBriefWithMeta({ cwd: r.dir, base, head, now: NOW, noCalibration: true });
  assert.deepEqual(replay.brief.dependents, live.dependents);
  const importers = live.dependents.entries.find((e) => e.file === 'src/core.ts')?.untouchedImporters ?? [];
  assert.ok(importers.includes('src/alias-user.ts') && importers.includes('src/consumer.ts'), importers.join());
  assert.equal(replay.brief.provenance.engines[1]?.mode, 'library');
});

test('one loader: repo-archaeology is imported only in src/sources/archaeology-lib.ts', () => {
  const sites: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else if (p.endsWith('.ts')) {
        const text = readFileSync(p, 'utf8');
        const hits = text.match(/(?:import\s*\(\s*|from\s+|require(?:\.resolve)?\s*\(\s*|\bresolve\s*\(\s*)['"]repo-archaeology(?:\/[^'"]*)?['"]/g);
        if (hits) sites.push(...hits.map((h) => `${p.replaceAll('\\', '/')}: ${h}`));
      }
    }
  };
  walk('src');
  assert.equal(sites.length, 1, sites.join('\n'));
  assert.match(sites[0]!, /^src\/sources\/archaeology-lib\.ts: /);
});

test('schema: the new additive fields validate on a library brief', async () => {
  const { r, base } = historyRepo();
  const b = await buildBriefAsync({ cwd: r.dir, base, now: NOW });
  const schema = JSON.parse(readFileSync('schema/gutter.schema.json', 'utf8'));
  const engine = schema.properties.provenance.properties.engines.items.properties;
  assert.deepEqual(engine.mode.enum, ['library', 'subprocess', 'npx']);
  assert.equal(engine.features.type, 'array');
  assert.ok(schema.properties.dependents.properties.unresolved.properties.byReason);
  assert.deepEqual(schema.$defs.ForgottenItem.properties.evidence.items.properties.origin.enum, ['human', 'agent', 'bot']);
  assert.ok(schema.$defs.ForgottenItem.properties.originShare);
  // And a real library brief carries them.
  assert.ok(b.forgotten.items[0]?.originShare);
  assert.equal(b.forgotten.items[0]?.evidence[0]?.origin, 'human');
  assert.deepEqual(b.dependents.unresolved.byReason, {});
});
