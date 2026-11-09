import { posix } from 'node:path';
import type { ChangeStructure, TestLink } from '../contract.ts';
import type { SourceReader } from '../source/reader.ts';
import { WorkingTreeReader } from '../source/reader.ts';
import { isTestPath } from './changes.ts';

/**
 * Link changed source files to conventional test files.
 * Conventions covered: a.test.ts / a.spec.ts beside the file, in __tests__/,
 * and in a mirrored top-level test/ or tests/ tree; Go _test.go; Python test_a.py.
 */
export function candidateTestNames(source: string): string[] {
  const dir = posix.dirname(source);
  const file = posix.basename(source);
  const m = /^(.*?)\.([a-z0-9]+)$/i.exec(file);
  if (!m) return [];
  const [, stem, ext] = m as unknown as [string, string, string];
  const out = new Set<string>();
  const exts = /^[cm]?[jt]sx?$/.test(ext) ? ['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs', 'cts', 'cjs'] : [ext];
  const inDir = (d: string, name: string) => (d === '.' ? name : `${d}/${name}`);
  for (const e of exts) {
    for (const kind of ['test', 'spec']) {
      out.add(inDir(dir, `${stem}.${kind}.${e}`));
      out.add(inDir(dir, `__tests__/${stem}.${kind}.${e}`));
      out.add(inDir(dir, `__tests__/${stem}.${e}`));
      // mirrored trees: src/a/b.ts -> test/a/b.test.ts, tests/a/b.test.ts
      const rest = dir.split('/').slice(1).join('/');
      for (const top of ['test', 'tests']) {
        out.add(inDir(rest ? `${top}/${rest}` : top, `${stem}.${kind}.${e}`));
        if (/(^|\/)src(\/|$)/.test(dir)) {
          out.add(inDir(dir.replace(/(^|\/)src(?=\/|$)/, `$1${top}`), `${stem}.${kind}.${e}`));
        }
      }
    }
  }
  if (ext === 'go') out.add(inDir(dir, `${stem}_test.go`));
  if (ext === 'py') {
    out.add(inDir(dir, `test_${stem}.py`));
    out.add(inDir(dir, `${stem}_test.py`));
    out.add(`tests/test_${stem}.py`);
  }
  out.delete(source);
  return [...out];
}

const SOURCE_EXT = /\.([cm]?[jt]sx?|go|py)$/;

export function linkTests(
  root: string,
  changes: ChangeStructure,
  reader: SourceReader = new WorkingTreeReader(root),
): TestLink[] {
  const tracked = new Set(reader.listFiles());
  const changed = new Set(changes.files.map((f) => f.path));
  const links: TestLink[] = [];
  for (const f of changes.files) {
    if (f.isTest || f.status === 'deleted' || !SOURCE_EXT.test(f.path) || /\.d\.[cm]?ts$/.test(f.path)) continue;
    const candidates = candidateTestNames(f.path)
      .filter((p) => tracked.has(p) || changed.has(p))
      .map((p) => ({ path: p, changed: changed.has(p) }));
    const status: TestLink['status'] = candidates.some((c) => c.changed)
      ? 'test-changed'
      : candidates.length
        ? 'test-untouched'
        : 'no-test-found';
    links.push({ id: `tests:${f.path}`, source: f.path, status, candidates });
  }
  return links;
}

export { isTestPath };
