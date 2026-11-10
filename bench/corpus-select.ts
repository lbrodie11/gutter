/**
 * GU-30 corpus selection (run once, before the preregistration commit). Deterministic given the saved
 * candidate lists: it never looks at outcomes, only at structure and at how many merged PRs Gutter's
 * own discovery funnel can reach.
 *
 *   node --experimental-strip-types bench/corpus-select.ts --search   # query GitHub, save bench/corpus-candidates.json
 *   node --experimental-strip-types bench/corpus-select.ts            # select from the saved candidates
 *
 * Writes bench/corpus.json (the corpus) and bench/corpus-selection.json (every candidate considered and why
 * it was taken or skipped). Clones are blobless, without checkout, into $GUTTER_BENCH_CACHE.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { discoverChangeUnits } from '../src/bench/discover.ts';
import { isBotOrAgentStrings } from '../src/bench/baselines.ts';

export const SELECTION_DATE = '2026-11-10';
/** Pins are the newest first-parent commit at or before this instant, so every 7-day window is complete. */
export const PIN_BEFORE = '2026-11-03T23:59:59Z';
const ACTIVE_SINCE = '2026-08-12'; // 90 days before SELECTION_DATE
const MAX_SIZE_KB = 100_000;
const MIN_PRS = 200;
const BOT_SHARE_HEAVY = 0.2;

interface Category {
  id: string;
  label: string;
  take: number;
  language: 'typescript' | 'go' | 'python';
  expected: 'good' | 'hard';
  /** `gh search repos` arguments (sorted by stars, plus the global filters). */
  search: string[];
  check: (files: string[], read: (p: string) => string | undefined) => string | undefined;
}

const TS_JS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const notVendored = (p: string) => !/(^|\/)(node_modules|vendor|dist|build)\//.test(p);
const count = (files: string[], re: RegExp) => files.filter((f) => re.test(f) && notVendored(f)).length;
const isWorkspace = (files: string[], read: (p: string) => string | undefined) => {
  if (files.includes('pnpm-workspace.yaml')) return true;
  try {
    return Boolean((JSON.parse(read('package.json') ?? '{}') as { workspaces?: unknown }).workspaces);
  } catch {
    return false;
  }
};
const hasPaths = (files: string[], read: (p: string) => string | undefined) =>
  files.filter((f) => /(^|\/)tsconfig[^/]*\.json$/.test(f) && notVendored(f)).some((f) => /"paths"\s*:/.test(read(f) ?? ''));

export const CATEGORIES: Category[] = [
  {
    id: 'ts-library', label: 'TypeScript/JavaScript library', take: 5, language: 'typescript', expected: 'good',
    search: ['--language=typescript', '--topic=library'],
    check: (f, r) => (!f.includes('package.json') ? 'no root package.json' : isWorkspace(f, r) ? 'workspace monorepo (other category)' : count(f, TS_JS) < 20 ? 'fewer than 20 TS/JS files' : undefined),
  },
  {
    id: 'ts-app-paths', label: 'TypeScript app with tsconfig paths aliases', take: 3, language: 'typescript', expected: 'good',
    search: ['--language=typescript', '--topic=nextjs'],
    check: (f, r) => (!hasPaths(f, r) ? 'no tsconfig with compilerOptions.paths' : isWorkspace(f, r) ? 'workspace monorepo (other category)' : undefined),
  },
  {
    id: 'ts-monorepo', label: 'Workspace monorepo', take: 3, language: 'typescript', expected: 'good',
    search: ['--language=typescript', '--topic=monorepo'],
    check: (f, r) => (!isWorkspace(f, r) ? 'no package.json workspaces or pnpm-workspace.yaml' : count(f, TS_JS) < 20 ? 'fewer than 20 TS/JS files' : undefined),
  },
  {
    id: 'go', label: 'Go', take: 3, language: 'go', expected: 'good',
    search: ['--language=go'],
    check: (f) => (!f.includes('go.mod') ? 'no root go.mod' : count(f, /\.go$/) < 50 ? 'fewer than 50 .go files' : undefined),
  },
  {
    id: 'python', label: 'Python', take: 3, language: 'python', expected: 'good',
    search: ['--language=python'],
    check: (f) => (!f.includes('pyproject.toml') && !f.includes('setup.py') ? 'no root pyproject.toml or setup.py' : count(f, /\.py$/) < 50 ? 'fewer than 50 .py files' : undefined),
  },
  {
    id: 'young', label: 'Very young (created within the last 12 months)', take: 1, language: 'typescript', expected: 'hard',
    search: ['--language=typescript', '--created=>=2025-11-10'],
    check: (f) => (count(f, TS_JS) < 20 ? 'fewer than 20 TS/JS files' : undefined),
  },
  {
    id: 'generated', label: 'Generated code (Stainless-generated SDK)', take: 1, language: 'typescript', expected: 'hard',
    search: ['generated with Stainless in:readme', '--language=typescript'],
    check: (f) => (count(f, TS_JS) < 20 ? 'fewer than 20 TS/JS files' : undefined),
  },
];

export const HONO = {
  url: 'https://github.com/honojs/hono',
  pinnedSha: 'eb754bd5ef22c63f1634a4c374a86be086f85710',
  branch: 'main',
  language: 'typescript',
  category: 'continuity',
  expected: 'good',
  why: 'Continuity with Stage 0, GU-29 and GU-05 (same pin and PRs).',
};

export const cacheDir = () => process.env.GUTTER_BENCH_CACHE ?? join(homedir(), '.cache', 'gutter-bench');
export const slug = (fullName: string) => fullName.replace('/', '__');
const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

function search(cat: Category): { fullName: string; stargazersCount: number; size: number; createdAt: string; defaultBranch: string }[] {
  const out = execFileSync('gh', [
    'search', 'repos', ...cat.search, '--archived=false', `--updated=>${ACTIVE_SINCE}`, `--size=<${MAX_SIZE_KB}`,
    '--sort', 'stars', '--order', 'desc', '--limit', '40', '--json', 'fullName,stargazersCount,size,createdAt,defaultBranch',
  ], { encoding: 'utf8' });
  return JSON.parse(out);
}

function evaluate(fullName: string, defaultBranch: string, fixedPin?: string) {
  const dir = join(cacheDir(), slug(fullName));
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(cacheDir(), { recursive: true });
    execFileSync('git', ['clone', '--quiet', '--filter=blob:none', '--no-checkout', `https://github.com/${fullName}.git`, dir], { stdio: 'ignore' });
  }
  const pin = fixedPin ?? git(dir, ['rev-list', '-1', '--first-parent', `--before=${PIN_BEFORE}`, `origin/${defaultBranch}`]).trim();
  if (!pin) return { error: 'no commit before the pin date' };
  const files = git(dir, ['ls-tree', '-r', '--name-only', pin]).split('\n').filter(Boolean);
  const read = (p: string) => {
    try {
      return git(dir, ['show', `${pin}:${p}`]);
    } catch {
      return undefined;
    }
  };
  const d = discoverChangeUnits({ cwd: dir, branch: pin, prs: MIN_PRS });
  const units = d.eligiblePrs;
  const merges = units.filter((u) => u.detection === 'merge-commit').length;
  const style = units.length === 0 ? 'none' : merges / units.length >= 0.8 ? 'merge' : merges / units.length <= 0.2 ? 'squash' : 'mixed';
  const bot = units.filter((u) => isBotOrAgentStrings([...u.authors, ...u.authorNames], [u.subject])).length;
  return { dir, pin, files, read, reachable: d.allEligiblePrs.length, mergeStyle: style, botShare: units.length ? bot / units.length : 0 };
}

async function main() {
  const { values } = parseArgs({ options: { search: { type: 'boolean', default: false } } });
  const candPath = 'bench/corpus-candidates.json';
  if (values.search) {
    const saved = { searchedOn: SELECTION_DATE, filters: { archived: false, updatedAfter: ACTIVE_SINCE, maxSizeKb: MAX_SIZE_KB, sort: 'stars desc', limit: 40 }, categories: Object.fromEntries(CATEGORIES.map((c) => [c.id, { search: c.search, candidates: search(c) }])) };
    writeFileSync(candPath, JSON.stringify(saved, null, 2) + '\n');
    process.stderr.write(`wrote ${candPath}\n`);
    return;
  }
  const saved = JSON.parse(readFileSync(candPath, 'utf8'));
  const taken = new Set<string>(['honojs/hono']);
  // hono is pinned by continuity, not selected; its merge style and bot share are measured the same way.
  const h = evaluate('honojs/hono', HONO.branch, HONO.pinnedSha);
  if ('error' in h) throw new Error(`hono: ${h.error}`);
  const repos: Record<string, unknown>[] = [{ ...HONO, mergeStyle: h.mergeStyle, botShare: Number(h.botShare.toFixed(3)) }];
  const log: Record<string, unknown>[] = [];
  for (const cat of CATEGORIES) {
    let got = 0;
    for (const c of saved.categories[cat.id].candidates as { fullName: string; defaultBranch: string; stargazersCount: number; createdAt: string }[]) {
      if (got >= cat.take) break;
      const entry: Record<string, unknown> = { category: cat.id, fullName: c.fullName, stars: c.stargazersCount };
      if (taken.has(c.fullName)) {
        log.push({ ...entry, decision: 'skip', reason: 'already selected in an earlier category' });
        continue;
      }
      try {
        const e = evaluate(c.fullName, c.defaultBranch);
        if ('error' in e) {
          log.push({ ...entry, decision: 'skip', reason: e.error });
          continue;
        }
        const structural = cat.check(e.files, e.read);
        if (structural) {
          log.push({ ...entry, decision: 'skip', reason: structural });
          continue;
        }
        if (e.reachable < MIN_PRS) {
          log.push({ ...entry, decision: 'skip', reason: `only ${e.reachable} merged PRs reachable by the discovery funnel (needs ${MIN_PRS})` });
          continue;
        }
        got++;
        taken.add(c.fullName);
        log.push({ ...entry, decision: 'take', reachable: e.reachable, pinnedSha: e.pin, mergeStyle: e.mergeStyle, botShare: Number(e.botShare.toFixed(3)) });
        repos.push({
          url: `https://github.com/${c.fullName}`,
          pinnedSha: e.pin,
          branch: c.defaultBranch,
          language: cat.language,
          category: cat.id,
          mergeStyle: e.mergeStyle,
          expected: cat.expected,
          botShare: Number(e.botShare.toFixed(3)),
          why: `${cat.label}: rank ${saved.categories[cat.id].candidates.indexOf(c) + 1} by stars in its category search that passed the structural check and has ${e.reachable} reachable merged PRs.`,
        });
        process.stderr.write(`take ${cat.id} ${c.fullName} (${e.reachable} PRs, ${e.mergeStyle}, bot ${e.botShare.toFixed(2)})\n`);
      } catch (err) {
        log.push({ ...entry, decision: 'skip', reason: `clone or analysis failed: ${(err as Error).message.split('\n')[0]}` });
      }
    }
    if (got < cat.take) log.push({ category: cat.id, decision: 'shortfall', missing: cat.take - got });
  }
  writeFileSync('bench/corpus-selection.json', JSON.stringify({ selectionDate: SELECTION_DATE, pinBefore: PIN_BEFORE, botShareHeavy: BOT_SHARE_HEAVY, log }, null, 2) + '\n');
  writeFileSync('bench/corpus.json', JSON.stringify({ schemaVersion: 1, selectionDate: SELECTION_DATE, repos }, null, 2) + '\n');
  process.stderr.write(`selected ${repos.length} repos; bot-heavy (>= ${BOT_SHARE_HEAVY}): ${repos.filter((r) => Number(r.botShare ?? 0) >= BOT_SHARE_HEAVY).length}\n`);
}

if (process.argv[1]?.endsWith('corpus-select.ts')) await main();
