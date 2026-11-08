import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBrief } from '../src/brief.ts';
import { GUTTER_VERSION } from '../src/version.ts';
import { TempRepo, lines, raBacktestFixture, raDiffFixture } from './helpers.ts';

test('GUTTER_VERSION in src/version.ts matches package.json version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  assert.equal(GUTTER_VERSION, pkg.version);
});

/**
 * A dependency-free conformance check: every `required` key in the published
 * schema is present in a real brief, at every nested object level we can reach.
 * Keeps schema/gutter.schema.json and src/contract.ts from drifting apart.
 */
type Schema = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  maxItems?: number;
  $ref?: string;
};
const root = JSON.parse(readFileSync(new URL('../schema/gutter.schema.json', import.meta.url), 'utf8')) as Schema & { $defs: Record<string, Schema> };
const deref = (s: Schema): Schema => (s.$ref ? root.$defs[s.$ref.replace('#/$defs/', '')]! : s);

function check(schema: Schema, value: unknown, path: string, problems: string[]): void {
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

const r = new TempRepo()
  .write({ 'src/a.ts': 'export const a = 1;\n', 'src/b.ts': "import './a';\n", 'src/a.test.ts': "import './a';\n" })
  .commit('init').branch('f')
  .write({ 'src/a.ts': `export const a = 2;\n${lines(20)}` }).commit('change');
after(() => r.cleanup());

test('a real brief satisfies every required field, enum, and maxItems constraint in schema/gutter.schema.json', () => {
  const brief = buildBrief({ cwd: r.dir, base: 'main', raDiff: raDiffFixture({ families: [{ id: 'x', label: 'l', why: 'w', members: [{ path: 'src/a.ts' }, { path: 'src/z.ts' }, { path: 'src/y.ts' }], changedMembers: ['src/a.ts'] }] }), raBacktest: raBacktestFixture(0.5) });
  const problems: string[] = [];
  check(root, brief, '$', problems);
  assert.deepEqual(problems, []);
  assert.equal(brief.dependents.coverage, 'full');
  assert.deepEqual(brief.dependents.unresolved, { count: 0, samples: [] });
  assert.ok(brief.forgotten.families.length && brief.forgotten.items.length && brief.tests.length && brief.dependents.entries.length, 'fixture should exercise every layer');

  // Also check schema conformance when coverage is partial with >5 unresolved imports (capped to 5 samples).
  const imp = (s: string) => `imp${'ort'} '${s}';\n`;
  const partialRepo = new TempRepo()
    .write({
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': [1, 2, 3, 4, 5, 6, 7].map((i) => imp(`@/mod${i}`)).join(''),
    })
    .commit('init')
    .branch('p')
    .write({ 'src/a.ts': `export const a = 2;\n${lines(15)}` })
    .commit('edit a');
  try {
    const partialBrief = buildBrief({ cwd: partialRepo.dir, base: 'main', noHistory: true });
    const partialProblems: string[] = [];
    check(root, partialBrief, '$', partialProblems);
    assert.deepEqual(partialProblems, []);
    assert.equal(partialBrief.dependents.coverage, 'partial');
    assert.equal(partialBrief.dependents.unresolved.count, 7);
    assert.equal(partialBrief.dependents.unresolved.samples.length, 5);
  } finally {
    partialRepo.cleanup();
  }
});
