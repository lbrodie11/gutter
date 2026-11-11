/**
 * GU-29 Gate A′ (docs/ROADMAP.md, M0 exit test): is Gutter quiet, true and non-predictive?
 * Checkable without human labels.
 *
 *   (a) Quiet enough: full share <= 1/3 (from the default-mode bench.json).
 *   (b) Facts are true: every PR is replayed in default mode and each fact is re-checked against git
 *       at that PR's SHAs, independently of Gutter's own analyzers:
 *       - broken-import (needs >= 95% confirmed): TypeScript's own `ts.resolveModuleName`, with the
 *         repo's tsconfig at head, must resolve one of the importer's specifiers to the removed file
 *         at base and fail to resolve it at head. Non-TS/JS files: existence is re-checked instead.
 *       - untested-change (needs 100%): `git diff --numstat` gives the stated +/− for the source, the
 *         test file exists at head, and the PR doesn't change it.
 *       - test history (needs 100%): the test file exists at head and is unchanged in the PR, every
 *         receipt commit is in base's history and touched both files (under any earlier name, by
 *         `git log --follow`), and together <= sourceCommits. The counts themselves come from Repo
 *         Archaeology's filtered history (sweeps, bots, reverts), so raw `git log` cannot re-derive them.
 *   (c) No predictions: every replayed brief renders (HTML, Markdown, comment, CLI line) with no
 *       banned word in Gutter's own wording. PR-derived free text (titles, branch names, subjects,
 *       authors, RA `why`, family labels) is replaced with placeholders, and repository paths are
 *       removed from the rendered text (code spans, tag attributes, link targets, module names), so
 *       a file named `forgot-password.ts` is not counted. Raw hits, PR text and paths included, are
 *       counted separately for transparency.
 *
 *   node --experimental-strip-types bench/gate-a-prime.ts <repo dir> <default bench.json> [--out gate.json]
 *
 * Dev-only tooling: it imports `typescript` (a devDependency), so it lives outside src/.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import { replayBriefWithMeta } from '../src/brief.ts';
import type { GutterBrief } from '../src/contract.ts';
import { renderComic } from '../src/render/comic.ts';
import { renderMarkdown } from '../src/render/markdown.ts';
import { summaryLine } from '../src/output.ts';
import { importSpecifiers } from './seeded.ts';

export const BANNED = /forgot|likely forgotten|you may have missed|untested|not covered/i;
export const FULL_SHARE_BUDGET = 1 / 3;
export const BROKEN_IMPORT_MIN = 0.95;

const git = (cwd: string, args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const gitOk = (cwd: string, args: string[]): boolean => {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/** A git tree as a read-only TypeScript host rooted at "/repo". */
export class TreeHost {
  readonly files: Set<string>;
  readonly dirs: Set<string>;
  private cache = new Map<string, string | undefined>();
  private readonly cwd: string;
  private readonly sha: string;
  constructor(cwd: string, sha: string) {
    this.cwd = cwd;
    this.sha = sha;
    this.files = new Set(git(cwd, ['ls-tree', '-r', '-z', '--name-only', sha]).split('\0').filter(Boolean));
    this.dirs = new Set(['']);
    for (const f of this.files) {
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) this.dirs.add(parts.slice(0, i).join('/'));
    }
  }
  static rel(abs: string): string {
    // TypeScript also probes directories with a trailing slash (`import '.'`); GU-30 erratum 1.
    return abs.replace(/^\/repo\/?/, '').replace(/\/+$/, '');
  }
  read(rel: string): string | undefined {
    if (!this.files.has(rel)) return undefined;
    if (!this.cache.has(rel)) {
      try {
        this.cache.set(rel, git(this.cwd, ['show', `${this.sha}:${rel}`]));
      } catch {
        this.cache.set(rel, undefined);
      }
    }
    return this.cache.get(rel);
  }
  moduleHost(): ts.ModuleResolutionHost {
    return {
      fileExists: (p) => this.files.has(TreeHost.rel(p)),
      readFile: (p) => this.read(TreeHost.rel(p)),
      directoryExists: (p) => this.dirs.has(TreeHost.rel(p)),
      getCurrentDirectory: () => '/repo',
      realpath: (p) => p,
      useCaseSensitiveFileNames: true,
    };
  }
  /** The repo's compiler options at this tree: tsconfig.build.json, else tsconfig.json (with `extends`). */
  compilerOptions(): ts.CompilerOptions {
    const fallback: ts.CompilerOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: true };
    for (const name of ['tsconfig.build.json', 'tsconfig.json']) {
      const text = this.read(name);
      if (text === undefined) continue;
      const parsed = ts.parseConfigFileTextToJson(name, text);
      if (parsed.error) continue;
      const host: ts.ParseConfigHost = {
        useCaseSensitiveFileNames: true,
        readDirectory: () => [],
        fileExists: (p) => this.files.has(TreeHost.rel(p)),
        readFile: (p) => this.read(TreeHost.rel(p)),
      };
      const cfg = ts.parseJsonConfigFileContent(parsed.config, host, '/repo', undefined, `/repo/${name}`);
      const opts = { ...cfg.options, allowJs: true };
      if (opts.moduleResolution === undefined) opts.moduleResolution = ts.ModuleResolutionKind.Bundler;
      return opts;
    }
    return fallback;
  }
}

const TS_JS = /\.([cm]?[jt]sx?)$/;

/** Resolve every import specifier of `importer` (read at `from`) in `tree`; returns specifier -> resolved rel path. */
export function resolveSpecifiers(importerText: string, importer: string, tree: TreeHost, opts: ts.CompilerOptions): Map<string, string | undefined> {
  // GU-31 erratum 2: the AST walk, so `export * as ns from` and deep `import()` calls are seen.
  const out = new Map<string, string | undefined>();
  const host = tree.moduleHost();
  for (const spec of importSpecifiers(importerText, importer)) {
    const r = ts.resolveModuleName(spec, `/repo/${importer}`, opts, host);
    const resolved = r.resolvedModule?.resolvedFileName;
    out.set(spec, resolved ? TreeHost.rel(resolved) : undefined);
  }
  return out;
}

const namesCache = new Map<string, Set<string>>();
/** Every name `path` had in `sha`'s history, by `git log --follow`. */
export function historicalNames(cwd: string, sha: string, path: string): Set<string> {
  const key = `${sha}\0${path}`;
  let names = namesCache.get(key);
  if (!names) {
    names = new Set([path, ...git(cwd, ['log', '--follow', '--name-only', '--format=', sha, '--', path]).split('\n').filter(Boolean)]);
    namesCache.set(key, names);
  }
  return names;
}

export interface FactCheck {
  kind: 'broken-import' | 'untested-change' | 'test-history';
  pr: string;
  fact: string;
  confirmed: boolean;
  why?: string;
}

/** Re-check one replayed brief's facts against git. */
export function checkFacts(cwd: string, prId: string, brief: GutterBrief, baseSha: string, headSha: string, trees: { base: TreeHost; head: TreeHost }): FactCheck[] {
  const out: FactCheck[] = [];
  const mergeBase = git(cwd, ['merge-base', baseSha, headSha]).trim();
  const numstat = new Map<string, { add: number; del: number }>();
  const changed = new Set<string>();
  // Same rename detection as Gutter's diff reader (-M), parsed from -z output: a rename is
  // "add\tdel\t" followed by two NUL-separated paths; every path involved counts as changed.
  const parts = git(cwd, ['diff', '--no-color', '--numstat', '-M', '-z', `${baseSha}...${headSha}`]).split('\0');
  for (let i = 0; i < parts.length; i++) {
    const m = /^(\d+|-)\t(\d+|-)\t(.*)$/.exec(parts[i]!);
    if (!m) continue;
    const stat = { add: m[1] === '-' ? 0 : Number(m[1]), del: m[2] === '-' ? 0 : Number(m[2]) };
    if (m[3]) {
      changed.add(m[3]);
      numstat.set(m[3], stat);
    } else {
      const from = parts[++i]!;
      const to = parts[++i]!;
      changed.add(from);
      changed.add(to);
      numstat.set(to, stat);
    }
  }
  let baseOpts: ts.CompilerOptions | undefined;
  let headOpts: ts.CompilerOptions | undefined;

  for (const item of brief.checklist) {
    if (item.kind === 'broken-import') {
      const entry = brief.dependents.entries.find((d) => d.id === item.evidence[0]);
      if (!entry) {
        out.push({ kind: 'broken-import', pr: prId, fact: item.id, confirmed: false, why: 'evidence missing' });
        continue;
      }
      for (const importer of [...entry.untouchedImporters, ...entry.changedImporters]) {
        const fact = `${importer} imports removed ${entry.file}`;
        if (trees.head.files.has(entry.file)) {
          out.push({ kind: 'broken-import', pr: prId, fact, confirmed: false, why: 'file still exists at head' });
          continue;
        }
        const text = trees.head.read(importer);
        if (text === undefined) {
          out.push({ kind: 'broken-import', pr: prId, fact, confirmed: false, why: 'importer missing at head' });
          continue;
        }
        if (!TS_JS.test(importer) || !TS_JS.test(entry.file)) {
          out.push({ kind: 'broken-import', pr: prId, fact, confirmed: trees.base.files.has(entry.file), why: 'existence re-check (non-TS/JS)' });
          continue;
        }
        baseOpts ??= trees.base.compilerOptions();
        headOpts ??= trees.head.compilerOptions();
        const atBase = resolveSpecifiers(text, importer, trees.base, baseOpts);
        const atHead = resolveSpecifiers(text, importer, trees.head, headOpts);
        const hit = [...atBase].find(([spec, resolved]) => resolved === entry.file && atHead.get(spec) === undefined);
        out.push({ kind: 'broken-import', pr: prId, fact, confirmed: Boolean(hit), ...(hit ? {} : { why: 'TypeScript resolves no specifier to the removed file at base, unresolved at head' }) });
      }
    }
    if (item.kind === 'untested-change') {
      const link = brief.tests.find((t) => t.id === item.evidence[0]);
      const m = /\(\+(\d+)\/−(\d+)\)/.exec(item.question);
      const testPath = link?.candidates[0]?.path;
      const stat = link ? numstat.get(link.source) : undefined;
      const problems: string[] = [];
      if (!link || !testPath || !m) problems.push('cannot parse the fact');
      else {
        if (!stat || stat.add !== Number(m[1]) || stat.del !== Number(m[2])) problems.push(`numstat ${JSON.stringify(stat)} vs +${m[1]}/−${m[2]}`);
        if (!trees.head.files.has(testPath)) problems.push('test file missing at head');
        if (changed.has(testPath)) problems.push('test file changed in the PR');
      }
      out.push({ kind: 'untested-change', pr: prId, fact: item.question, confirmed: problems.length === 0, ...(problems.length ? { why: problems.join('; ') } : {}) });
    }
  }

  for (const link of brief.tests) {
    if (!link.history) continue;
    const items = link.history.evidence.map((id) => brief.forgotten.items.find((f) => f.id === id));
    const problems: string[] = [];
    if (items.some((f) => !f)) problems.push('history evidence missing');
    if (link.history.together > link.history.sourceCommits) problems.push('together > sourceCommits');
    for (const f of items) {
      if (!f) continue;
      if (!trees.head.files.has(f.file)) problems.push(`${f.file} missing at head`);
      if (changed.has(f.file)) problems.push(`${f.file} changed in the PR`);
      for (const e of f.evidence) {
        if (!gitOk(cwd, ['merge-base', '--is-ancestor', e.sha, mergeBase])) {
          problems.push(`${e.sha.slice(0, 7)} not in base history`);
          continue;
        }
        const touched = new Set(git(cwd, ['show', '--no-renames', '--name-only', '--format=', e.sha]).split('\n').filter(Boolean));
        // A file's earlier names count (git's own rename following, as Repo Archaeology follows renames).
        const hits = (path: string) => [...historicalNames(cwd, mergeBase, path)].some((n) => touched.has(n));
        if (!hits(f.file) || !hits(f.changed)) problems.push(`${e.sha.slice(0, 7)} does not touch both files`);
      }
    }
    const fact = `${link.source} ↔ ${items[0]?.file ?? '?'} together ${link.history.together}/${link.history.sourceCommits}`;
    out.push({ kind: 'test-history', pr: prId, fact, confirmed: problems.length === 0, ...(problems.length ? { why: problems.join('; ') } : {}) });
  }
  return out;
}

/** Replace PR-derived free text with placeholders so only Gutter's own wording is judged. */
export function neutralize(brief: GutterBrief): GutterBrief {
  const b = structuredClone(brief);
  b.change.title = 'PR title';
  b.change.base = 'base';
  b.change.head = 'head';
  if (b.change.intent !== undefined) b.change.intent = 'PR body';
  b.change.commits = b.change.commits.map((c) => ({ ...c, subject: 'commit subject' }));
  for (const f of b.forgotten.items) {
    f.why = 'why';
    f.evidence = f.evidence.map((e) => ({ ...e, subject: 'commit subject', author: 'author' }));
  }
  for (const fam of b.forgotten.families) {
    fam.label = 'family';
    fam.why = 'why';
  }
  return b;
}

/**
 * Gutter's own words in a rendered page: drop everything that carries a repository path. Renderers put
 * every path in a code span (`<code>` in HTML, backticks in Markdown) or a link target, and module names
 * in `<span class="mod">`; tags go too, which removes ids and hrefs built from paths.
 */
export function ownWords(rendered: string): string {
  return rendered
    .replace(/<code[^>]*>[\s\S]*?<\/code>/g, ' ')
    .replace(/<span class="mod">[^<]*<\/span>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/(`+)[\s\S]*?\1/g, ' ')
    .replace(/\]\([^)\s]*\)/g, '] ');
}

/** Banned-word hits in Gutter's own words (`neutralize` first for PR text); `raw` skips the path stripping. */
export function bannedHits(brief: GutterBrief, opts: { raw?: boolean } = {}): string[] {
  const pages = [renderComic(brief), renderMarkdown(brief), renderMarkdown(brief, { pageUrl: 'https://example.invalid/run' }), summaryLine(brief)];
  const texts = opts.raw ? pages : pages.map(ownWords);
  return texts.flatMap((t) => {
    const m = BANNED.exec(t);
    return m ? [t.slice(Math.max(0, m.index - 40), m.index + 30)] : [];
  });
}

interface BenchPr { id: string; base: string; head: string; subject: string; prNumber: number | null; policies: { production: { salience: string; questions: { kind: string }[] } } }

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } });
  const [repo, benchPath] = positionals;
  if (!repo || !benchPath) throw new Error('usage: gate-a-prime.ts <repo dir> <default bench.json> [--out gate.json]');
  const bench = JSON.parse(readFileSync(benchPath, 'utf8')) as { repo: { name: string; headSha: string }; tools: Record<string, string>; settings: { configOverrides?: Record<string, unknown> }; prs: BenchPr[] };
  if (bench.settings.configOverrides && Object.keys(bench.settings.configOverrides).length) {
    throw new Error('Gate A′ is defined on the default policy; this bench.json ran with config overrides');
  }
  const facts: FactCheck[] = [];
  let salienceMismatches = 0;
  let checklistMismatches = 0;
  let rawHits = 0;
  const ownWordHits: { pr: string; text: string }[] = [];
  let full = 0;
  for (const pr of bench.prs) {
    const res = await replayBriefWithMeta({ cwd: repo, base: pr.base, head: pr.head, title: pr.subject, ...(pr.prNumber ? { prNumber: pr.prNumber } : {}), noCalibration: true });
    const b = res.brief;
    if (pr.policies.production.salience === 'full') full++;
    if (b.salience.level !== pr.policies.production.salience) salienceMismatches++;
    if (b.checklist.map((c) => c.kind).join() !== pr.policies.production.questions.map((q) => q.kind).join()) checklistMismatches++;
    const trees = { base: new TreeHost(repo, pr.base), head: new TreeHost(repo, pr.head) };
    facts.push(...checkFacts(repo, pr.id, b, pr.base, pr.head, trees));
    for (const text of bannedHits(neutralize(b))) ownWordHits.push({ pr: pr.id, text });
    rawHits += bannedHits(b, { raw: true }).length;
  }
  const n = bench.prs.length;
  const tally = (kind: FactCheck['kind']) => {
    const all = facts.filter((f) => f.kind === kind);
    const ok = all.filter((f) => f.confirmed).length;
    return { checked: all.length, confirmed: ok, rate: all.length ? ok / all.length : null, failures: all.filter((f) => !f.confirmed) };
  };
  const broken = tally('broken-import');
  const unchanged = tally('untested-change');
  const history = tally('test-history');
  const fullShare = n ? full / n : 0;
  const result = {
    schemaVersion: 1,
    kind: 'gutter-gate-a-prime',
    repo: bench.repo.name,
    headSha: bench.repo.headSha,
    tools: { ...bench.tools, typescript: ts.version },
    prsEvaluated: n,
    replayParity: { salienceMismatches, checklistKindMismatches: checklistMismatches },
    a: { full, evaluated: n, share: fullShare, budget: FULL_SHARE_BUDGET, met: fullShare <= FULL_SHARE_BUDGET },
    b: {
      brokenImport: { ...broken, needs: BROKEN_IMPORT_MIN, met: broken.checked === 0 ? null : (broken.rate ?? 0) >= BROKEN_IMPORT_MIN },
      untestedChange: { ...unchanged, needs: 1, met: unchanged.rate === null ? null : unchanged.rate === 1 },
      testHistory: { ...history, needs: 1, met: history.rate === null ? null : history.rate === 1 },
    },
    c: { pagesChecked: n, ownWordingHits: ownWordHits, rawHits: rawHits, met: ownWordHits.length === 0 },
  };
  const json = JSON.stringify(result, null, 2) + '\n';
  if (values.out) writeFileSync(values.out, json);
  else process.stdout.write(json);
  process.stderr.write(
    `Gate A′ ${bench.repo.name}: (a) full ${full}/${n} · (b) broken-import ${broken.confirmed}/${broken.checked}, ` +
      `untested-change ${unchanged.confirmed}/${unchanged.checked}, test history ${history.confirmed}/${history.checked} · ` +
      `(c) own-wording hits ${ownWordHits.length} (raw hits incl. PR text and paths: ${rawHits})\n`,
  );
}

if (posix.basename(process.argv[1] ?? '') === 'gate-a-prime.ts') {
  main().catch((err: unknown) => {
    process.stderr.write(`gate-a-prime: ${(err as Error).message}\n`);
    process.exitCode = 1;
  });
}
