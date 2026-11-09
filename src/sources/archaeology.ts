/**
 * Adapter for Repo Archaeology's v1 JSON contract (repo-archaeology >= 0.3.0).
 *
 * Gutter does not re-implement co-change mining. Repo Archaeology owns the
 * statistics (directional confidence, Wilson ranking, sweep filtering, rename
 * following, backtests); Gutter owns comprehension: gating, wording, layout.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { win32 } from 'node:path';
import type { Calibration, CommitRef, FamilyItem, ForgottenItem, ForgottenLayer } from '../contract.ts';
import { wilsonInterval, pct } from '../stats/wilson.ts';
import { isAutomatedAuthor } from '../evidence/automation.ts';

// ---- Minimal v1 shapes (consumers must ignore unknown fields) ---------------

export interface RaEvidence { hash: string; date: string; author: string; subject: string }

export interface RaSuggestion {
  from: string;
  to: string;
  relationship: ForgottenItem['relationship'];
  why: string;
  shared: number;
  fromChanges: number;
  toChanges: number;
  confidence: number;
  score: number;
  lastTogether?: string;
  evidence: RaEvidence[];
  alsoLinkedFrom?: string[];
}

export interface RaFamily {
  id: string;
  label: string;
  why: string;
  members: { path: string }[];
  changedMembers?: string[];
  suggestedMembers?: string[];
}

export interface RaDiff {
  schemaVersion: 1;
  tool: { name: string; version: string };
  meta: { commitsAnalyzed: number; warnings: string[]; shallow?: boolean };
  totalSuggestions?: number;
  suggestions: RaSuggestion[];
  families?: RaFamily[];
  silence?: { primaryReason: string; details?: string[] };
}

export interface RaStrategy {
  name: string;
  fired: number;
  precision: number;
  hitRate: number;
  followUpPrecision?: number;
  followUpHitRate?: number;
}

export interface RaBacktest {
  schemaVersion: 1;
  tool: { name: string; version: string };
  test: { commits: number; from: string; to: string };
  strategies: RaStrategy[];
}

// ---- Running the engine -------------------------------------------------------

export interface RaRunner {
  /** Path to a repo-archaeology binary or its dist/cli.js. */
  bin?: string;
  /** npm version spec used when falling back to npx. */
  spec?: string;
}

export const DEFAULT_RA_SPEC = '^0.3.0';

export interface RaCommandContext {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  execPath?: string;
  exists?: (path: string) => boolean;
}

export function resolveRaCommand(runner: RaRunner, ctx: RaCommandContext = {}): { file: string; pre: string[] } {
  const env = ctx.env ?? process.env;
  const platform = ctx.platform ?? process.platform;
  const execPath = ctx.execPath ?? process.execPath;
  const exists = ctx.exists ?? existsSync;

  const bin = runner.bin ?? env.GUTTER_RA_BIN;
  if (bin) return /\.[cm]?js$/.test(bin) ? { file: execPath, pre: [bin] } : { file: bin, pre: [] };
  const spec = runner.spec ?? DEFAULT_RA_SPEC;
  if (!/^[\w.^~<>=*| -]+$/.test(spec)) throw new Error(`invalid repo-archaeology version spec: ${spec}`);
  if (platform === 'win32') {
    const candidates = [
      env.npm_execpath ? win32.join(win32.dirname(env.npm_execpath), 'npx-cli.js') : '',
      win32.join(win32.dirname(execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    ].filter(Boolean);
    for (const c of candidates) {
      if (exists(c)) return { file: execPath, pre: [c, '--yes', `repo-archaeology@${spec}`] };
    }
    throw new Error(
      'Could not locate npx-cli.js for this Windows Node.js installation; set GUTTER_RA_BIN or pass --ra-bin pointing to repo-archaeology/dist/cli.js.',
    );
  }
  return { file: 'npx', pre: ['--yes', `repo-archaeology@${spec}`] };
}

function runJson<T>(root: string, runner: RaRunner, args: string[]): T {
  const { file, pre } = resolveRaCommand(runner);
  const out = execFileSync(file, [...pre, ...args, '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out) as T;
}

export function loadJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`file not found: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function runDiff(root: string, base: string, runner: RaRunner): RaDiff {
  return runJson<RaDiff>(root, runner, ['diff', '--base', base, '--limit', '25']);
}

export function runBacktest(root: string, runner: RaRunner): RaBacktest {
  return runJson<RaBacktest>(root, runner, ['backtest']);
}

function assertV1(doc: { schemaVersion?: unknown }, what: string): void {
  if (doc.schemaVersion !== 1) {
    throw new Error(`${what}: expected Repo Archaeology schemaVersion 1, got ${String(doc.schemaVersion)}`);
  }
}

// ---- Mapping into gutter.json -------------------------------------------------

const SILENCE_NOTES: Record<string, string> = {
  no_changed_files: 'No changed files to check.',
  limited_repo_history: 'Too little history in this repository to say anything yet.',
  no_history_for_changed_files: 'The changed files are new or have too little history.',
  no_cochange_partners: 'These files have no files that usually change with them.',
  all_companions_touched: 'Every file that usually changes with these files was changed here too.',
  filtered_by_thresholds: 'Some files co-change occasionally, but not often enough to flag.',
  filtered_by_kinds: 'Companions exist but are outside the configured relationship kinds.',
};

export interface ForgottenOptions { maxItems: number; maxEvidence: number }

export function toForgotten(diff: RaDiff | undefined, opts: ForgottenOptions, unavailableNote?: string): ForgottenLayer {
  if (!diff) {
    return {
      status: 'unavailable',
      note: unavailableNote ?? 'Repo Archaeology did not run, so co-change history was not checked.',
      items: [], total: 0, families: [], commitsAnalyzed: 0, warnings: [],
    };
  }
  assertV1(diff, 'diff JSON');

  const items: ForgottenItem[] = diff.suggestions.slice(0, opts.maxItems).map((s, i) => {
    const evidence: CommitRef[] = s.evidence.slice(0, opts.maxEvidence).map((e) => ({
      sha: e.hash, date: e.date, author: e.author, subject: e.subject, automated: isAutomatedAuthor(e.author),
    }));
    const automated = evidence.filter((e) => e.automated).length;
    return {
      id: `forgotten:${i}`,
      changed: s.from,
      file: s.to,
      relationship: s.relationship,
      why: s.why,
      shared: s.shared,
      changedTotal: s.fromChanges,
      confidence: s.confidence,
      interval: wilsonInterval(s.shared, s.fromChanges),
      ...(s.lastTogether ? { lastTogether: s.lastTogether } : {}),
      evidence,
      automationShare: evidence.length ? automated / evidence.length : 0,
      alsoLinkedFrom: s.alsoLinkedFrom ?? [],
    };
  });

  const families: FamilyItem[] = (diff.families ?? []).map((f, i) => {
    const members = f.members.map((m) => m.path);
    const changed = new Set(f.changedMembers ?? []);
    return {
      id: `family:${i}`,
      label: f.label,
      why: f.why,
      members,
      changedMembers: members.filter((m) => changed.has(m)),
      untouchedMembers: members.filter((m) => !changed.has(m)),
    };
  });

  const reason = diff.silence?.primaryReason;
  const insufficient = reason === 'limited_repo_history' || reason === 'no_history_for_changed_files';
  return {
    status: insufficient ? 'insufficient-history' : 'analyzed',
    ...(items.length === 0 && reason ? { note: SILENCE_NOTES[reason] ?? reason } : {}),
    items,
    total: diff.totalSuggestions ?? diff.suggestions.length,
    families,
    commitsAnalyzed: diff.meta.commitsAnalyzed,
    warnings: diff.meta.warnings ?? [],
  };
}

/** Thresholds for calling calibration "measured" rather than "thin". */
const MIN_TEST_COMMITS = 50;
const MIN_FIRED = 20;

export function toCalibration(bt: RaBacktest | undefined, skipped = false): Calibration {
  if (skipped) return { status: 'skipped', note: 'Calibration was turned off for this run.' };
  if (!bt) return { status: 'unavailable', note: 'No backtest ran, so warning accuracy on this repository is unknown.' };
  assertV1(bt, 'backtest JSON');
  const main = bt.strategies.find((s) => s.name === 'co-change');
  const baseline = bt.strategies.find((s) => s.name === 'popularity, same changes');
  if (!main) return { status: 'unavailable', note: 'Backtest output had no co-change strategy.' };
  // Lift uses hit rate, the same definition Repo Archaeology prints, so the two tools never disagree.
  const lift = baseline && baseline.hitRate > 0 ? main.hitRate / baseline.hitRate : undefined;
  const thin = bt.test.commits < MIN_TEST_COMMITS || main.fired < MIN_FIRED;
  const note = thin
    ? `Only ${bt.test.commits} recent commits to test against, so accuracy here is not yet known.`
    : `Replayed on the last ${bt.test.commits} commits: when it flagged files, at least one really did change ${pct(main.hitRate)} of the time` +
      (lift ? ` (${lift.toFixed(1)}× better than guessing busy files)` : '') +
      `, and ${pct(main.precision)} of all flagged files did.`;
  return {
    status: thin ? 'thin' : 'measured',
    note,
    precision: main.precision,
    hitRate: main.hitRate,
    ...(lift !== undefined ? { lift } : {}),
    testCommits: bt.test.commits,
    fired: main.fired,
    window: { from: bt.test.from, to: bt.test.to },
  };
}
