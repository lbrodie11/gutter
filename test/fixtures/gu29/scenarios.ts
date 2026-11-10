/**
 * GU-29 fixture scenarios: deterministic inputs for the pure `assembleBrief` pipeline.
 *
 * Type-only imports, so the same file runs against the pre-GU-29 commit (to write the
 * legacy goldens in `legacy/`) and against today's code (to prove `legacyPredictions: true`
 * reproduces them byte for byte, and to render every scenario in default mode).
 */
import type { ChangedFile, ChangeStructure, DependentsEntry, DependentsLayer, TestLink } from '../../../src/contract.ts';
import type { RaBacktest, RaDiff, RaSuggestion } from '../../../src/sources/archaeology.ts';
import type { GutterConfig } from '../../../src/config.ts';

export interface Scenario {
  name: string;
  /** Plain-language purpose, for test messages. */
  about: string;
  base: string;
  head: string;
  baseSha: string;
  headSha: string;
  title?: string;
  intent?: string;
  repoUrl?: string;
  prNumber?: number;
  changes: ChangeStructure;
  commits: { sha: string; subject: string }[];
  dependents: DependentsLayer;
  tests: TestLink[];
  raDiff?: RaDiff;
  raBacktest?: RaBacktest;
  unavailable?: string;
  noHistory?: boolean;
  noCalibration?: boolean;
  config?: GutterConfig;
  now: Date;
}

const NOW = new Date('2026-11-10T12:00:00.000Z');
const SHA = (n: number) => n.toString(16).padStart(40, '0');
const BASE_SHA = 'b'.repeat(40);
const HEAD_SHA = 'c'.repeat(40);
const REPO = 'https://github.com/example/widgets';

function moduleOf(path: string): string {
  const parts = path.split('/');
  if (parts.length === 1) return '(root)';
  if (parts[0] === 'src' && parts.length >= 3) return `src/${parts[1]}`;
  return parts[0]!;
}

function file(path: string, additions: number, deletions = 0, status: ChangedFile['status'] = 'modified'): ChangedFile {
  const isTest = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|\/)(__tests__|tests?)\//.test(path);
  const language = /\.[cm]?tsx?$/.test(path) ? 'typescript' : /\.[cm]?jsx?$/.test(path) ? 'javascript' : /\.sql$/.test(path) ? 'sql' : null;
  return { path, status, additions, deletions, binary: false, module: moduleOf(path), isTest, language };
}

function structure(files: ChangedFile[]): ChangeStructure {
  const mods = new Map<string, { name: string; files: number; additions: number; deletions: number }>();
  for (const f of files) {
    const m = mods.get(f.module) ?? { name: f.module, files: 0, additions: 0, deletions: 0 };
    m.files++;
    m.additions += f.additions;
    m.deletions += f.deletions;
    mods.set(f.module, m);
  }
  const modules = [...mods.values()].sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions) || a.name.localeCompare(b.name));
  return {
    files,
    modules,
    totals: {
      files: files.length,
      additions: files.reduce((s, f) => s + f.additions, 0),
      deletions: files.reduce((s, f) => s + f.deletions, 0),
      modules: modules.length,
    },
  };
}

function deps(entries: DependentsEntry[], over: Partial<DependentsLayer> = {}): DependentsLayer {
  return {
    analyzers: ['ts-js-relative-imports'],
    entries,
    unchecked: [],
    coverage: 'full',
    unresolved: { count: 0, samples: [] },
    scannedFiles: 120,
    ...over,
  };
}

function dep(file: string, untouched: string[], changed: string[] = [], deleted = false): DependentsEntry {
  return { id: `deps:${file}`, file, deleted, changedImporters: changed, untouchedImporters: untouched };
}

function testLink(source: string, candidates: { path: string; changed: boolean }[]): TestLink {
  const status: TestLink['status'] = candidates.some((c) => c.changed) ? 'test-changed' : candidates.length ? 'test-untouched' : 'no-test-found';
  return { id: `tests:${source}`, source, status, candidates };
}

function suggestion(over: Partial<RaSuggestion> & Pick<RaSuggestion, 'from' | 'to' | 'shared' | 'fromChanges'>, firstSha: number, n = 3): RaSuggestion {
  return {
    relationship: 'unknown',
    why: 'no import link detected in the current code',
    toChanges: over.fromChanges + 4,
    confidence: over.shared / over.fromChanges,
    score: over.shared / (over.fromChanges + 4),
    lastTogether: '2026-10-01',
    evidence: Array.from({ length: n }, (_, i) => ({
      hash: SHA(firstSha + i),
      date: `2026-${String(10 - i).padStart(2, '0')}-0${(i % 9) + 1}`,
      author: i === 2 ? 'Bea' : 'Ada',
      subject: `widgets: change ${firstSha + i}`,
    })),
    alsoLinkedFrom: [],
    ...over,
  };
}

function raDiff(suggestions: RaSuggestion[], over: Partial<RaDiff> = {}): RaDiff {
  return {
    schemaVersion: 1,
    tool: { name: 'repo-archaeology', version: '0.10.0' },
    meta: { commitsAnalyzed: 640, warnings: [] },
    totalSuggestions: suggestions.length,
    suggestions,
    families: [],
    ...over,
  };
}

function backtest(precision: number, hitRate = Math.min(1, precision + 0.15)): RaBacktest {
  return {
    schemaVersion: 1,
    tool: { name: 'repo-archaeology', version: '0.10.0' },
    test: { commits: 300, from: '2026-03-01', to: '2026-11-01' },
    strategies: [
      { name: 'co-change', fired: 200, precision, hitRate },
      { name: 'popularity, same changes', fired: 200, precision: 0.04, hitRate: 0.1 },
    ],
  };
}

const common = {
  base: 'main',
  head: 'feature',
  baseSha: BASE_SHA,
  headSha: HEAD_SHA,
  repoUrl: REPO,
  now: NOW,
} as const;

/** Normal PR: a strong ghost companion, a test pair from co-change, a parallel family, dependents. */
function normal(): Scenario {
  const files = [file('src/orders/a.ts', 30, 2), file('src/orders/b.ts', 4, 1)];
  return {
    ...common,
    name: 'normal',
    about: 'co-change partner + ghost wire + family + naming-convention test',
    title: 'orders: add status filter',
    intent: 'Lets callers filter orders by status.',
    prNumber: 42,
    changes: structure(files),
    commits: [{ sha: SHA(900), subject: 'orders: add status filter' }],
    dependents: deps([dep('src/orders/a.ts', ['src/api/orders.ts', 'src/api/admin.ts'])]),
    tests: [
      testLink('src/orders/a.ts', [{ path: 'src/orders/a.test.ts', changed: false }]),
      testLink('src/orders/b.ts', []),
    ],
    raDiff: raDiff(
      [
        suggestion({ from: 'src/orders/a.ts', to: 'src/orders/a.test.ts', relationship: 'test', why: 'a test and the code it covers', shared: 17, fromChanges: 20 }, 1),
        suggestion({ from: 'src/orders/a.ts', to: 'db/schema.sql', relationship: 'ghost', why: 'shared table name "orders"', shared: 14, fromChanges: 19 }, 10),
        suggestion({ from: 'src/orders/b.ts', to: 'src/legacy/b.ts', relationship: 'unknown', why: 'no import link detected in the current code', shared: 4, fromChanges: 19 }, 20),
      ],
      {
        totalSuggestions: 5,
        families: [
          {
            id: 'fam-1',
            label: 'b.ts across src/*',
            why: 'parallel implementations',
            members: [{ path: 'src/orders/b.ts' }, { path: 'src/billing/b.ts' }, { path: 'src/refunds/b.ts' }],
            changedMembers: ['src/orders/b.ts'],
          },
        ],
      },
    ),
    raBacktest: backtest(0.6),
  };
}

/** Quiet: one small file, analyzed history, nothing to say. */
function quiet(): Scenario {
  const files = [file('src/util/format.ts', 3, 1)];
  return {
    ...common,
    name: 'quiet',
    about: 'small change, analyzed history, nothing to flag',
    title: 'util: tidy format()',
    changes: structure(files),
    commits: [{ sha: SHA(901), subject: 'util: tidy format()' }],
    dependents: deps([dep('src/util/format.ts', ['src/a.ts'])]),
    tests: [testLink('src/util/format.ts', [{ path: 'src/util/format.test.ts', changed: false }])],
    raDiff: raDiff([], { totalSuggestions: 0, silence: { primaryReason: 'no_cochange_partners' } }),
    raBacktest: backtest(0.6),
  };
}

/** Partial: dependents coverage is partial (aliases), with a co-change partner. */
function partial(): Scenario {
  const files = [file('src/core/router.ts', 12, 3), file('src/core/types.ts', 2, 0), file('docs/router.md', 5, 1)];
  return {
    ...common,
    name: 'partial',
    about: 'unresolved alias imports make dependents partial',
    title: 'core: router tweaks',
    changes: structure(files),
    commits: [{ sha: SHA(902), subject: 'core: router tweaks' }],
    dependents: deps([dep('src/core/router.ts', ['src/app.ts'])], {
      coverage: 'partial',
      unresolved: { count: 7, samples: ['src/app.ts → @/core', 'src/b.ts → @/x', 'src/c.ts → @/y', 'src/d.ts → @/z', 'src/e.ts → @/w'] },
    }),
    tests: [
      testLink('src/core/router.ts', [{ path: 'src/core/router.test.ts', changed: false }]),
      testLink('src/core/types.ts', []),
    ],
    raDiff: raDiff([
      suggestion({ from: 'src/core/router.ts', to: 'src/core/compose.ts', relationship: 'direct', why: 'router.ts imports compose.ts', shared: 11, fromChanges: 16 }, 30),
    ]),
    raBacktest: backtest(0.5),
  };
}

/** Huge PR: breadth, a broken import, wide surface, high-churn source with an untouched test. */
function huge(): Scenario {
  const files: ChangedFile[] = [];
  for (const mod of ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']) {
    for (let i = 0; i < 6; i++) files.push(file(`src/${mod}/f${i}.ts`, 10 + i * 3, i));
  }
  files.push(file('src/alpha/old.ts', 0, 40, 'deleted'));
  files.push(file('src/alpha/f0.test.ts', 5, 0));
  return {
    ...common,
    name: 'huge',
    about: '38 files across 6 modules, one broken import, a wide surface',
    title: 'refactor: split the widget engine',
    prNumber: 77,
    changes: structure(files),
    commits: [
      { sha: SHA(903), subject: 'refactor: move alpha' },
      { sha: SHA(904), subject: 'refactor: move beta' },
    ],
    dependents: deps([
      dep('src/alpha/old.ts', ['src/legacy/uses-old.ts'], [], true),
      dep('src/beta/f0.ts', ['src/x1.ts', 'src/x2.ts', 'src/x3.ts', 'src/x4.ts', 'src/x5.ts', 'src/x6.ts']),
    ]),
    tests: [
      testLink('src/alpha/f0.ts', [{ path: 'src/alpha/f0.test.ts', changed: true }]),
      testLink('src/zeta/f5.ts', [{ path: 'src/zeta/f5.test.ts', changed: false }]),
      testLink('src/gamma/f4.ts', [{ path: 'src/gamma/f4.test.ts', changed: false }]),
      testLink('src/delta/f1.ts', []),
    ],
    raDiff: raDiff([
      suggestion({ from: 'src/zeta/f5.ts', to: 'src/zeta/f5.test.ts', relationship: 'test', why: 'a test and the code it covers', shared: 9, fromChanges: 12 }, 40),
      suggestion({ from: 'src/gamma/f4.ts', to: 'src/gamma/index.ts', relationship: 'direct', why: 'index.ts imports f4.ts', shared: 8, fromChanges: 10 }, 50),
    ]),
    raBacktest: backtest(0.55),
  };
}

/** History unavailable: Repo Archaeology did not run. */
function historyUnavailable(): Scenario {
  const files = [file('src/orders/a.ts', 22, 4), file('src/orders/c.ts', 3, 0)];
  return {
    ...common,
    name: 'history-unavailable',
    about: 'Repo Archaeology did not run',
    title: 'orders: rework totals',
    changes: structure(files),
    commits: [{ sha: SHA(905), subject: 'orders: rework totals' }],
    dependents: deps([dep('src/orders/a.ts', ['src/api/orders.ts'])]),
    tests: [
      testLink('src/orders/a.ts', [{ path: 'src/orders/a.test.ts', changed: false }]),
      testLink('src/orders/c.ts', []),
    ],
    unavailable: 'Co-change history needs feature checked out; it was skipped.',
  };
}

/** Insufficient history: RA ran but the files are too new. */
function insufficientHistory(): Scenario {
  const files = [file('src/fresh/new.ts', 25, 0, 'added'), file('src/fresh/other.ts', 14, 2)];
  return {
    ...common,
    name: 'insufficient-history',
    about: 'Repo Archaeology ran but the changed files have too little history',
    title: 'fresh: new module',
    changes: structure(files),
    commits: [{ sha: SHA(906), subject: 'fresh: new module' }],
    dependents: deps([]),
    tests: [
      testLink('src/fresh/new.ts', []),
      testLink('src/fresh/other.ts', [{ path: 'src/fresh/other.test.ts', changed: false }]),
    ],
    raDiff: raDiff([], { totalSuggestions: 0, silence: { primaryReason: 'no_history_for_changed_files' } }),
    raBacktest: backtest(0.6),
  };
}

/** Two broken imports, small PR: full under both salience rules. */
function brokenTwo(): Scenario {
  const files = [file('src/io/read.ts', 0, 30, 'deleted'), file('src/io/write.ts', 0, 25, 'deleted')];
  return {
    ...common,
    name: 'broken-two',
    about: 'two deleted files that are still imported',
    title: 'io: drop old readers',
    changes: structure(files),
    commits: [{ sha: SHA(907), subject: 'io: drop old readers' }],
    dependents: deps([
      dep('src/io/read.ts', ['src/cli.ts'], [], true),
      dep('src/io/write.ts', ['src/cli.ts', 'src/server.ts'], [], true),
    ]),
    tests: [],
    raDiff: raDiff([], { totalSuggestions: 0, silence: { primaryReason: 'all_companions_touched' } }),
    raBacktest: backtest(0.6),
  };
}

/** Co-change only: small PR whose only signal is a strong companion + ghost wire. */
function cochangeOnly(): Scenario {
  const files = [file('src/pay/charge.ts', 6, 2), file('src/pay/refund.ts', 2, 1)];
  return {
    ...common,
    name: 'cochange-only',
    about: 'only co-change evidence, no other signal',
    title: 'pay: rename a field',
    changes: structure(files),
    commits: [{ sha: SHA(908), subject: 'pay: rename a field' }],
    dependents: deps([]),
    tests: [testLink('src/pay/charge.ts', []), testLink('src/pay/refund.ts', [])],
    raDiff: raDiff([
      suggestion({ from: 'src/pay/charge.ts', to: 'db/payments.sql', relationship: 'ghost', why: 'shared table name "payments"', shared: 15, fromChanges: 18 }, 60),
      suggestion({ from: 'src/pay/charge.ts', to: 'src/pay/ledger.ts', relationship: 'unknown', why: 'no import link detected in the current code', shared: 12, fromChanges: 18 }, 70),
    ]),
    raBacktest: backtest(0.6),
  };
}

/** A co-change test partner that the naming heuristics missed. */
function cochangeTestMissed(): Scenario {
  const files = [file('src/parse/lexer.ts', 18, 6)];
  return {
    ...common,
    name: 'cochange-test-missed',
    about: 'test partner found by co-change only',
    title: 'parse: faster lexer',
    changes: structure(files),
    commits: [{ sha: SHA(909), subject: 'parse: faster lexer' }],
    dependents: deps([]),
    tests: [testLink('src/parse/lexer.ts', [])],
    raDiff: raDiff([
      suggestion({ from: 'src/parse/lexer.ts', to: 'test/integration/parse-roundtrip.test.ts', relationship: 'test', why: 'a test that changes with this code', shared: 11, fromChanges: 14 }, 80),
    ]),
    raBacktest: backtest(0.6),
  };
}

/** Poor calibration: legacy suppresses companion questions; history still renders. */
function poorCalibration(): Scenario {
  const s = normal();
  return { ...s, name: 'poor-calibration', about: 'measured precision below the gate', raBacktest: backtest(0.1, 0.2) };
}

/** Hostile text everywhere a PR can put text. */
function hostile(): Scenario {
  const evilPath = 'src/x/<script>alert(1)</script>|`[a](javascript:x)`.ts';
  const evilTest = 'src/x/</details><img src=x onerror=alert(2)>.test.ts';
  const files = [file(evilPath, 20, 3), file('src/x/ok.ts', 2, 0)];
  return {
    ...common,
    name: 'hostile',
    about: 'paths, subjects and titles carry HTML, Markdown and table syntax',
    title: '<script>alert("t")</script> </details> | `x` [y](javascript:z) @here',
    intent: '<iframe src=//evil></iframe> </details> | [y](javascript:z)',
    changes: structure(files),
    commits: [{ sha: SHA(910), subject: '</details><script>alert(3)</script> | `c` [l](javascript:q)' }],
    dependents: deps([dep(evilPath, ['src/x/<b>imp</b>|`t`.ts'])]),
    tests: [testLink(evilPath, [{ path: evilTest, changed: false }])],
    raDiff: raDiff([
      {
        ...suggestion({ from: evilPath, to: evilTest, relationship: 'test', why: '</details><script>w</script>', shared: 9, fromChanges: 10 }, 90),
        evidence: [{ hash: SHA(90), date: '2026-10-01', author: 'Ada', subject: '</details><script>alert(4)</script> | `s` [k](javascript:v)' }],
      },
      {
        ...suggestion({ from: evilPath, to: 'src/x/[z](javascript:p)|</details>.ts', relationship: 'ghost', why: '<b>w</b>', shared: 8, fromChanges: 10 }, 95),
        evidence: [{ hash: SHA(95), date: '2026-10-02', author: 'Ada', subject: 'pipe | and `tick` and </details>' }],
      },
    ]),
    raBacktest: backtest(0.6),
  };
}

export function scenarios(): Scenario[] {
  return [
    normal(),
    quiet(),
    partial(),
    huge(),
    historyUnavailable(),
    insufficientHistory(),
    brokenTwo(),
    cochangeOnly(),
    cochangeTestMissed(),
    poorCalibration(),
    hostile(),
  ];
}

/** Drop the fields a legacy comparison ignores: provenance timing and versions. */
export function normalizeForLegacyCompare(brief: unknown): string {
  const b = JSON.parse(JSON.stringify(brief)) as { tool: { version: string }; provenance: { generatedAt: string; engines: { name: string; version: string }[] } };
  b.tool.version = '<version>';
  b.provenance.generatedAt = '<time>';
  b.provenance.engines = b.provenance.engines.map((e) => ({ ...e, version: '<version>' }));
  return JSON.stringify(b, null, 2) + '\n';
}
