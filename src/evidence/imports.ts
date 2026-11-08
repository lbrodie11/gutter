import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { git } from '../git.ts';
import type { ChangeStructure, DependentsEntry, DependentsLayer } from '../contract.ts';

/**
 * Static dependents for TS/JS via relative-import scanning.
 *
 * Deliberately small and honest: it resolves relative specifiers only (no
 * tsconfig paths / package exports yet). Changed files in languages without
 * an analyzer are listed as `unchecked`, never as "no dependents".
 */

const SCRIPT_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const RESOLVE_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const SPECIFIER = /(?:import|export)(?:\s+|\s*(?=[{*]))[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const ALIAS_SPECIFIER = /^(?:@\/|~~?\/|#|\$lib\/)/;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 25_000;

export function extractSpecifiers(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(SPECIFIER)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (spec) out.push(spec);
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
export function readTsconfigAliasPrefixes(root: string): string[] {
  const prefixes = new Set<string>();
  for (const name of ['tsconfig.json', 'tsconfig.base.json', 'jsconfig.json']) {
    const abs = join(root, name);
    if (!existsSync(abs)) continue;
    try {
      const st = statSync(abs);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
      const raw = readFileSync(abs, 'utf8');
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

export function buildDependents(root: string, changes: ChangeStructure): DependentsLayer {
  const tracked = git(root, ['ls-files', '-z']).split('\0').filter((p) => SCRIPT_EXT.test(p));
  const known = new Set(tracked);
  const changedPaths = new Set(changes.files.map((f) => f.path));
  const deleted = new Set(changes.files.filter((f) => f.status === 'deleted').map((f) => f.path));
  const targets = changes.files.filter((f) => SCRIPT_EXT.test(f.path));
  const aliasPrefixes = readTsconfigAliasPrefixes(root);

  const importersOf = new Map<string, Set<string>>();
  for (const t of targets) importersOf.set(t.path, new Set());
  // A renamed file's old path no longer exists: anything still importing it is broken.
  for (const f of changes.files) if (f.oldPath && SCRIPT_EXT.test(f.oldPath)) {
    deleted.add(f.oldPath);
    importersOf.set(f.oldPath, new Set());
  }

  let scanned = 0;
  let unresolvedAliases = 0;
  if (importersOf.size > 0) {
    for (const file of tracked.slice(0, MAX_FILES)) {
      const abs = join(root, file);
      if (!existsSync(abs)) continue;
      const st = statSync(abs);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
      scanned++;
      const src = readFileSync(abs, 'utf8');
      for (const spec of extractSpecifiers(src)) {
        const hit = resolveRelative(file, spec, known, deleted);
        if (!hit) {
          if (isAliasSpecifier(spec, aliasPrefixes)) unresolvedAliases++;
          continue;
        }
        if (hit === file) continue;
        importersOf.get(hit)?.add(file);
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
    };
    if (entry.changedImporters.length + entry.untouchedImporters.length > 0) entries.push(entry);
  }
  entries.sort((a, b) => Number(b.deleted) - Number(a.deleted) || b.untouchedImporters.length - a.untouchedImporters.length);

  const unchecked = changes.files
    .filter((f) => !SCRIPT_EXT.test(f.path) && f.language !== null && !['markdown', 'json', 'yaml', 'toml'].includes(f.language))
    .map((f) => f.path);

  return { analyzers: ['ts-js-relative-imports'], entries, unchecked, unresolvedAliases, scannedFiles: scanned };
}
