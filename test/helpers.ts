import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { RaBacktest, RaDiff } from '../src/sources/archaeology.ts';

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
};

export class TempRepo {
  readonly dir: string;
  constructor() {
    this.dir = mkdtempSync(join(tmpdir(), 'gutter-test-'));
    this.git('init', '-q', '-b', 'main');
  }
  git(...args: string[]): string {
    return execFileSync('git', args, { cwd: this.dir, env: ENV, encoding: 'utf8' });
  }
  write(files: Record<string, string>): this {
    for (const [p, content] of Object.entries(files)) {
      const abs = join(this.dir, p);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
    return this;
  }
  rm(path: string): this { this.git('rm', '-q', path); return this; }
  mv(from: string, to: string): this { this.git('mv', from, to); return this; }
  commit(msg: string): this { this.git('add', '-A'); this.git('commit', '-q', '-m', msg); return this; }
  branch(name: string): this { this.git('checkout', '-q', '-b', name); return this; }
  cleanup(): void { rmSync(this.dir, { recursive: true, force: true }); }
}

export const lines = (n: number, prefix = 'line') => Array.from({ length: n }, (_, i) => `// ${prefix} ${i}`).join('\n') + '\n';

const SHA = (n: number) => n.toString(16).padStart(40, 'a');

export function raDiffFixture(over: Partial<RaDiff> = {}): RaDiff {
  return {
    schemaVersion: 1,
    tool: { name: 'repo-archaeology', version: '0.3.0' },
    meta: { commitsAnalyzed: 120, warnings: [] },
    totalSuggestions: 2,
    suggestions: [
      {
        from: 'src/a.ts', to: 'db/schema.sql', relationship: 'ghost', why: 'shared table name "orders"',
        shared: 14, fromChanges: 19, toChanges: 16, confidence: 14 / 19, score: 0.51, lastTogether: '2026-10-01',
        evidence: [
          { hash: SHA(1), date: '2026-10-01', author: 'Alice', subject: 'orders: add status column' },
          { hash: SHA(2), date: '2026-09-02', author: 'Bob', subject: 'orders: index created_at' },
        ],
        alsoLinkedFrom: [],
      },
      {
        from: 'src/a.ts', to: 'src/legacy.ts', relationship: 'unknown', why: 'no shared signal',
        shared: 4, fromChanges: 19, toChanges: 30, confidence: 4 / 19, score: 0.08,
        evidence: [
          { hash: SHA(3), date: '2026-01-01', author: 'dependabot[bot]', subject: 'bump deps' },
          { hash: SHA(4), date: '2026-01-02', author: 'renovate[bot]', subject: 'bump deps' },
        ],
        alsoLinkedFrom: [],
      },
    ],
    families: [],
    ...over,
  };
}

export function raBacktestFixture(precision: number, hitRate = Math.min(1, precision + 0.15)): RaBacktest {
  return {
    schemaVersion: 1,
    tool: { name: 'repo-archaeology', version: '0.3.0' },
    test: { commits: 300, from: '2026-03-01', to: '2026-11-01' },
    strategies: [
      { name: 'co-change', fired: 200, precision, hitRate },
      { name: 'popularity, same changes', fired: 200, precision: 0.04, hitRate: 0.1 },
    ],
  };
}

/**
 * A dependency-free conformance check: every `required` key in the published
 * schema is present in a real brief, at every nested object level we can reach.
 * Keeps schema/gutter.schema.json and src/contract.ts from drifting apart.
 */
export type Schema = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  maxItems?: number;
  $ref?: string;
};
export const root = JSON.parse(readFileSync(new URL('../schema/gutter.schema.json', import.meta.url), 'utf8')) as Schema & { $defs: Record<string, Schema> };
const deref = (s: Schema): Schema => (s.$ref ? root.$defs[s.$ref.replace('#/$defs/', '')]! : s);

export function check(schema: Schema, value: unknown, path: string, problems: string[]): void {
  const s = deref(schema);
  if (s.enum && !s.enum.includes(value)) {
    problems.push(`${path} value ${JSON.stringify(value)} not in enum ${JSON.stringify(s.enum)}`);
  }
  if (Array.isArray(value)) {
    if (s.maxItems !== undefined && value.length > s.maxItems) {
      problems.push(`${path} length ${value.length} exceeds maxItems ${s.maxItems}`);
    }
    if (s.items) value.forEach((v, i) => check(s.items!, v, `${path}[${i}]`, problems));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const key of s.required ?? []) if (!(key in value)) problems.push(`${path}.${key} missing`);
  for (const [key, sub] of Object.entries(s.properties ?? {})) {
    if (key in value) check(sub, (value as Record<string, unknown>)[key], `${path}.${key}`, problems);
  }
}

/** Problems of `value` against schema/gutter.schema.json (required keys, enums, maxItems). */
export const schemaProblems = (value: unknown): string[] => {
  const problems: string[] = [];
  check(root, value, '$', problems);
  return problems;
};
