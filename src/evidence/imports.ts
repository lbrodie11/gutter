import { isBuiltin } from 'node:module';
import { posix } from 'node:path';
import type { ChangeStructure, DependentsEntry, DependentsLayer } from '../contract.ts';
import type { SourceReader } from '../source/reader.ts';
import { MAX_FILE_BYTES, WorkingTreeReader } from '../source/reader.ts';
import { relevantTargets, scopeTargets } from './coverage-scope.ts';

/**
 * Static dependents for TS/JS via relative-import scanning.
 *
 * Deliberately small and honest: it resolves relative specifiers only (no
 * tsconfig paths / package exports yet). Non-relative specifiers that are
 * aliases or repo-local / workspace packages mark `dependents.coverage` as
 * unresolved, with sample `<file> → <specifier>` receipts. GU-32: only those
 * that could reach the PR's files (`unresolved.relevant`, the rule in
 * `coverage-scope.ts`: an alias by its last segment, a workspace package when it
 * holds a changed file) make `dependents.coverage` `'partial'`. Changed files in
 * languages without an analyzer are listed as `unchecked`, never as "no
 * dependents".
 */

const SCRIPT_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const RESOLVE_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const STATIC_IMPORT_EXPORT =
  /(?:^|[;{}\r\n])[ \t]*(?:import|export)(?:\s+|\s*(?=[{*'"]))(?:type(?:\s+|\s*(?=[{*])))?(?:(?:\*\s*as\s+[A-Za-z0-9_$]+|[A-Za-z0-9_$]+(?:\s*,\s*(?:\*\s*as\s+[A-Za-z0-9_$]+|\{[^{};'"`]*\}))?|\{[^{};'"`]*\}|\*)(?:\s+|(?<=[}*]))from\s*)?(['"])([^'"\r\n]+)\1/gm;
const DYNAMIC_IMPORT_REQUIRE = /(?<![.\w$'"`])\b(?:import|require)\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g;
const ALIAS_SPECIFIER = /^(?:@\/|~~?\/|#|\$lib\/)/;
const EXTERNAL_PROTOCOL = /^(?:node|bun|deno|npm|jsr|cloudflare|virtual|https?|data):|^\$(?:app|env|service-worker)(?:\/|$)/;
const VALID_SPECIFIER =
  /^(?:\.\.?\/[A-Za-z0-9._/@~$()[\]-]*|#[A-Za-z0-9._/@$()[\]-]+|(?:~|~~|\$[A-Za-z0-9_-]*)\/[A-Za-z0-9._/@$()[\]-]+|@[A-Za-z0-9._-]*\/[A-Za-z0-9._/@$()[\]-]+|[A-Za-z0-9._-]+:[A-Za-z0-9._/@$()[\]-]+|[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._/@$()[\]-]+)*)$/;
const STRING_OR_COMMENT =
  /'(?:\\[\s\S]|[^'\\\r\n])*'|"(?:\\[\s\S]|[^"\\\r\n])*"|`(?:\\[\s\S]|[^`\\])*`|(\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)/g;
const MAX_SPECIFIER_LEN = 160;
const MAX_SAMPLE_LEN = 200;
const MAX_FILES = 25_000;
const MAX_UNRESOLVED_SAMPLES = 5;

/** Check whether a raw string looks like a genuine module specifier (no control chars or code fragments). */
export function isValidSpecifier(spec: string): boolean {
  if (!spec || spec.length > MAX_SPECIFIER_LEN) return false;
  if (/[\0-\x1f\r\n]/.test(spec)) return false;
  if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') return true;
  if (/\s/.test(spec)) return false;
  return VALID_SPECIFIER.test(spec);
}

/** Strip block and line comments while preserving string literals (such as `'packages/*'`) and line structure. */
function stripComments(source: string): string {
  return source.replace(STRING_OR_COMMENT, (match, comment: string | undefined) =>
    comment ? comment.replace(/[^\r\n]/g, ' ') : match,
  );
}

/** True when `linePrefix` ends inside an unclosed single-line quote (`'` or `"`). */
function isInsideQuote(linePrefix: string): boolean {
  let quote: string | null = null;
  for (let i = 0; i < linePrefix.length; i++) {
    const ch = linePrefix[i]!;
    if (ch === '\\') {
      i++;
      continue;
    }
    if (quote === null) {
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    } else if (ch === quote) {
      quote = null;
    }
  }
  return quote !== null;
}

export function extractSpecifiers(source: string): string[] {
  const cleaned = stripComments(source);
  const out: string[] = [];
  for (const m of cleaned.matchAll(STATIC_IMPORT_EXPORT)) {
    const spec = m[2];
    const idx = m.index ?? 0;
    const lineStart = cleaned.lastIndexOf('\n', idx) + 1;
    const linePrefix = cleaned.slice(lineStart, idx);
    if (isInsideQuote(linePrefix)) continue;
    if (spec && isValidSpecifier(spec)) out.push(spec);
  }
  for (const m of cleaned.matchAll(DYNAMIC_IMPORT_REQUIRE)) {
    const spec = m[2];
    const idx = m.index ?? 0;
    const lineStart = cleaned.lastIndexOf('\n', idx) + 1;
    const linePrefix = cleaned.slice(lineStart, idx);
    if (isInsideQuote(linePrefix)) continue;
    if (spec && isValidSpecifier(spec)) out.push(spec);
  }
  return out;
}

/** True when `spec` looks like an internal path alias / subpath import rather than an npm package or relative path. */
export function isAliasSpecifier(spec: string, customPrefixes: readonly string[] = []): boolean {
  if (spec.startsWith('.')) return false;
  if (ALIAS_SPECIFIER.test(spec)) return true;
  return customPrefixes.some((p) => (p.endsWith('/') ? spec.startsWith(p) : spec === p || spec.startsWith(`${p}/`)));
}

/** Read custom path-alias prefixes from tsconfig/jsconfig `compilerOptions.paths`, if present. */
export function readTsconfigAliasPrefixes(
  root: string,
  trackedConfigs?: readonly string[],
  reader: SourceReader = new WorkingTreeReader(root),
): string[] {
  const prefixes = new Set<string>();
  const candidates = trackedConfigs
    ? trackedConfigs.filter((f) => /(?:^|\/)(?:tsconfig(?:\.[^/]+)?|jsconfig)\.json$/.test(f))
    : ['tsconfig.json', 'tsconfig.base.json', 'jsconfig.json'];
  for (const name of candidates) {
    try {
      const content = reader.readText(name, MAX_FILE_BYTES);
      if (content === undefined) continue;
      const raw = stripComments(content);
      const pathsBlock = /"paths"\s*:\s*\{([\s\S]*?)\}/.exec(raw)?.[1];
      if (!pathsBlock) continue;
      for (const m of pathsBlock.matchAll(/^\s*"([^"]+)"\s*:/gm)) {
        const key = m[1]?.replace(/\*+$/, '').trim();
        if (key && !key.startsWith('.')) prefixes.add(key);
      }
    } catch {
      // Malformed or unreadable config: fall back to standard alias conventions.
    }
  }
  return [...prefixes];
}

/** Extract the npm package name (`react` or `@scope/pkg`) from a bare specifier, or undefined if not a valid package specifier. */
export function extractPackageName(spec: string): string | undefined {
  if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('#') || spec.startsWith('~') || spec.startsWith('$')) {
    return undefined;
  }
  if (spec.startsWith('@')) {
    const m = /^(@[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)(?:\/.*)?$/.exec(spec);
    return m?.[1];
  }
  const m = /^([a-zA-Z0-9._-]+)(?:\/.*)?$/.exec(spec);
  return m?.[1];
}

/**
 * Classify a non-relative specifier as `'external'` (Node builtin, runtime protocol,
 * or external package) or `'unresolved'` (path alias or workspace/local package).
 */
export function classifyNonRelativeSpecifier(
  spec: string,
  declaredPackages: ReadonlySet<string>,
  aliasPrefixes: readonly string[] = [],
  workspacePackages?: ReadonlySet<string>,
): 'external' | 'unresolved' {
  if (!isValidSpecifier(spec)) return 'external';
  if (isAliasSpecifier(spec, aliasPrefixes)) return 'unresolved';
  if (EXTERNAL_PROTOCOL.test(spec) || isBuiltin(spec)) return 'external';
  const pkg = extractPackageName(spec);
  if (pkg && workspacePackages?.has(pkg)) return 'unresolved';
  if (pkg && declaredPackages.has(pkg)) return 'external';
  if (workspacePackages) return 'external';
  return 'unresolved';
}

interface RepoPackageInfo {
  declaredExternal: Set<string>;
  workspacePackages: Set<string>;
}

/** Collect declared external dependencies and repo-local/workspace package names across all tracked `package.json` files. */
function readRepoPackageInfo(
  trackedAll: readonly string[],
  reader: SourceReader,
): RepoPackageInfo {
  const declaredExternal = new Set<string>();
  const workspacePackages = new Set<string>();
  const pkgFiles = trackedAll.filter((rel) => rel === 'package.json' || rel.endsWith('/package.json'));
  if (!pkgFiles.includes('package.json') && reader.hasFile('package.json')) {
    pkgFiles.push('package.json');
  }

  const parsedFiles: Record<string, unknown>[] = [];
  for (const rel of pkgFiles) {
    try {
      const content = reader.readText(rel, MAX_FILE_BYTES);
      if (content === undefined) continue;
      const parsed = JSON.parse(content) as Record<string, unknown>;
      parsedFiles.push(parsed);
      if (typeof parsed.name === 'string' && parsed.name.trim()) {
        workspacePackages.add(parsed.name.trim());
      }
    } catch {
      // Ignore unreadable or malformed package.json
    }
  }

  for (const parsed of parsedFiles) {
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const section = parsed[field];
      if (section && typeof section === 'object' && !Array.isArray(section)) {
        for (const [name, range] of Object.entries(section as Record<string, unknown>)) {
          if (typeof range === 'string' && /^(?:workspace|link|file):/.test(range.trim())) {
            workspacePackages.add(name);
            continue;
          }
          if (!workspacePackages.has(name)) {
            declaredExternal.add(name);
          }
        }
      }
    }
  }

  return { declaredExternal, workspacePackages };
}

/** Resolve a relative specifier from `fromFile` against a set of known repo files. */
export function resolveRelative(fromFile: string, spec: string, known: Set<string>, deleted: Set<string>): string | undefined {
  if (!spec.startsWith('.')) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const has = (p: string) => known.has(p) || deleted.has(p);
  if (SCRIPT_EXT.test(base) && has(base)) return base;
  // TS ESM convention: "./a.js" in source refers to "./a.ts"
  const stripped = base.replace(/\.(js|jsx|mjs|cjs)$/, '');
  for (const ext of RESOLVE_EXTS) if (has(stripped + ext)) return stripped + ext;
  for (const ext of RESOLVE_EXTS) {
    const idx = posix.join(base, `index${ext}`);
    if (has(idx)) return idx;
  }
  return undefined;
}

export function buildDependents(
  root: string,
  changes: ChangeStructure,
  reader: SourceReader = new WorkingTreeReader(root),
): DependentsLayer {
  const trackedAll = reader.listFiles();
  const tracked = trackedAll.filter((p) => SCRIPT_EXT.test(p));
  const known = new Set(tracked);
  const changedPaths = new Set(changes.files.map((f) => f.path));
  const deleted = new Set(changes.files.filter((f) => f.status === 'deleted').map((f) => f.path));
  const targets = changes.files.filter((f) => SCRIPT_EXT.test(f.path));
  const aliasPrefixes = readTsconfigAliasPrefixes(root, trackedAll, reader);
  const { declaredExternal, workspacePackages } = readRepoPackageInfo(trackedAll, reader);

  const importersOf = new Map<string, Set<string>>();
  for (const t of targets) importersOf.set(t.path, new Set());
  // A renamed file's old path no longer exists: anything still importing it is broken.
  for (const f of changes.files) if (f.oldPath && SCRIPT_EXT.test(f.oldPath)) {
    deleted.add(f.oldPath);
    importersOf.set(f.oldPath, new Set());
  }

  let scanned = 0;
  let unresolvedCount = 0;
  const unresolvedSamples = new Set<string>();
  const scope = importersOf.size > 0 ? scopeTargets(changes, reader) : [];
  let relevantCount = 0;
  const relevantSamples = new Set<string>();
  const reached = new Set<string>();

  if (importersOf.size > 0) {
    for (const file of tracked.slice(0, MAX_FILES)) {
      const src = reader.readText(file, MAX_FILE_BYTES);
      if (src === undefined) continue;
      scanned++;
      for (const spec of extractSpecifiers(src)) {
        if (spec.startsWith('.')) {
          const hit = resolveRelative(file, spec, known, deleted);
          if (hit && hit !== file) {
            importersOf.get(hit)?.add(file);
          }
          continue;
        }
        if (classifyNonRelativeSpecifier(spec, declaredExternal, aliasPrefixes, workspacePackages) === 'unresolved') {
          unresolvedCount++;
          const raw = `${file} → ${spec}`;
          const sample = raw.length > MAX_SAMPLE_LEN ? `${raw.slice(0, MAX_SAMPLE_LEN - 1)}…` : raw;
          unresolvedSamples.add(sample);
          // The scanner resolves neither aliases nor workspace packages: an alias is judged like Repo
          // Archaeology's `alias-unmatched`, a workspace package like `unknown-package` (its package.json name).
          const reasonCode = isAliasSpecifier(spec, aliasPrefixes) ? 'alias-unmatched' : 'unknown-package';
          const hits = relevantTargets({ from: file, specifier: spec, reasonCode }, scope);
          if (hits.length) {
            relevantCount++;
            relevantSamples.add(sample);
            for (const h of hits) reached.add(h);
          }
        }
      }
    }
  }

  const entries: DependentsEntry[] = [];
  for (const [file, importers] of importersOf) {
    const list = [...importers].sort();
    const isDeleted = deleted.has(file);
    const entry: DependentsEntry = {
      id: `deps:${file}`,
      file,
      deleted: isDeleted,
      changedImporters: list.filter((p) => changedPaths.has(p)),
      untouchedImporters: list.filter((p) => !changedPaths.has(p)),
      coverage: reached.has(file) ? 'partial' : 'full',
    };
    if (entry.changedImporters.length + entry.untouchedImporters.length > 0) entries.push(entry);
  }
  entries.sort((a, b) => Number(b.deleted) - Number(a.deleted) || b.untouchedImporters.length - a.untouchedImporters.length);

  const unchecked = changes.files
    .filter((f) => !SCRIPT_EXT.test(f.path) && f.language !== null && !['markdown', 'json', 'yaml', 'toml'].includes(f.language))
    .map((f) => f.path);

  const samples = [...unresolvedSamples].sort().slice(0, MAX_UNRESOLVED_SAMPLES);

  return {
    analyzers: ['ts-js-relative-imports'],
    entries,
    unchecked,
    coverage: relevantCount > 0 ? 'partial' : 'full',
    unresolved: {
      count: unresolvedCount,
      samples,
      relevant: { count: relevantCount, samples: [...relevantSamples].sort().slice(0, MAX_UNRESOLVED_SAMPLES) },
    },
    scannedFiles: scanned,
    method: 'relative-scan',
  };
}
