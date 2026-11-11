/**
 * GU-31 Rerun 1 preregistration: CORPUS.md §6 was committed before any Rerun 1 data and is unchanged since; it
 * keeps the same corpus, quotas and §5 rule (verbatim) with a new seed. Line endings are normalized BEFORE any
 * section is sliced (GU-30's Windows failure came from offsets taken on a CRLF file before normalization).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { NEGATIVES, POSITIVES, HOSTS, SEED } from '../bench/seeded.ts';

const HEADING = '## 6. Rerun 1 (preregistration)';
export const RERUN_SEED = 20261111;
/** Paths written by Rerun 1; the first commit touching each must come after the preregistration. */
const RERUN_PATHS = ['docs/benchmark/results-rerun1.json', 'docs/benchmark/data/rerun1-run.json', ':(glob)docs/benchmark/data/*/rerun1/**'];

const lf = (doc: string) => doc.replace(/\r\n?/g, '\n');
/** A `## ` section of an LF-normalized document, from its heading to the next `## ` heading (or the end). */
export function section(doc: string, heading: string): string {
  const text = lf(doc);
  const start = text.indexOf(`${heading}\n`);
  if (start < 0) return '';
  const next = text.indexOf('\n## ', start + heading.length);
  return text.slice(start, next < 0 ? text.length : next + 1);
}
/** The quoted §5 rule inside a section (the `> * PASS` block). */
const ruleOf = (sec: string) => {
  const i = sec.indexOf('> * PASS');
  return i < 0 ? '' : sec.slice(i, sec.indexOf('\n\n', i));
};

test('section(): CRLF and LF checkouts give the same §6, sliced after normalization', () => {
  const doc = `# T\n\n## 5. Verdict rule\n\n> * PASS: x\n> * FAIL: y\n\n## Errata\n\n- e\n\n${HEADING}\n\n**Status:** P\n\n### 6.1 Corpus\n\nSame.\n\n## Rerun 1 results\n\nR\n`;
  const crlf = doc.replace(/\n/g, '\r\n');
  assert.equal(section(crlf, HEADING), section(doc, HEADING));
  assert.equal(section(doc, HEADING), `${HEADING}\n\n**Status:** P\n\n### 6.1 Corpus\n\nSame.\n\n`);
  assert.equal(section(crlf, '## 5. Verdict rule'), '## 5. Verdict rule\n\n> * PASS: x\n> * FAIL: y\n\n');
  // §6 last in the file (before results exist) runs to the end.
  assert.equal(section(`${HEADING}\r\n\r\nX\r\n`, HEADING), `${HEADING}\n\nX\n`);
  assert.equal(ruleOf(section(crlf, '## 5. Verdict rule')), '> * PASS: x\n> * FAIL: y');
});

test('§6 content: same corpus, same quotas and oracle (plus erratum 2), a new seed, §5 rule verbatim', () => {
  const doc = readFileSync('docs/benchmark/CORPUS.md', 'utf8');
  const s6 = section(doc, HEADING);
  assert.ok(s6, '§6 exists');
  assert.equal(ruleOf(s6), ruleOf(section(doc, '## 5. Verdict rule (preregistered; applied mechanically)')), '§5 rule copied verbatim');
  assert.ok(ruleOf(s6).startsWith('> * PASS: all three hold:'));
  assert.match(s6, new RegExp(`Seed: \`${RERUN_SEED}\``));
  assert.notEqual(RERUN_SEED, SEED, 'a new seed');
  assert.match(s6, /The \*\*same\*\* 20 repositories and pins/);
  assert.match(s6, new RegExp(`${HOSTS} hosts; ${POSITIVES} positives .* and ${NEGATIVES} negative controls`));
  assert.match(s6, /erratum 2/);
  assert.match(s6, new RegExp(`--rerun rerun1 --seed ${RERUN_SEED}`));
});

const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const shallow = (() => {
  try {
    return git(['rev-parse', '--is-shallow-repository']) === 'true';
  } catch {
    return true;
  }
})();

test('preregistration: §6 came in a commit before every Rerun 1 data commit, and is unchanged since', { skip: shallow && process.env.CI !== 'true' ? 'shallow clone: no history to check' : false }, () => {
  assert.equal(shallow, false, 'CI must check out full history (fetch-depth: 0) for this test');
  const prereg = git(['log', '--reverse', '--format=%H', '-S', HEADING, '--', 'docs/benchmark/CORPUS.md']).split('\n')[0];
  assert.ok(prereg, 'preregistration commit found');
  const atPrereg = section(git(['show', `${prereg}:docs/benchmark/CORPUS.md`]), HEADING);
  assert.ok(atPrereg.includes('### 6.5 Verdict rule'), '§6 complete in the preregistration commit');
  assert.equal(section(readFileSync('docs/benchmark/CORPUS.md', 'utf8'), HEADING), atPrereg, '§6 unchanged since preregistration');
  // The corpus is GU-30's, unchanged.
  assert.deepEqual(JSON.parse(git(['show', `${prereg}:bench/corpus.json`])), JSON.parse(readFileSync('bench/corpus.json', 'utf8')));
  for (const path of RERUN_PATHS) {
    const first = git(['log', '--reverse', '--format=%H', '--', path]).split('\n')[0];
    if (!first) continue;
    assert.notEqual(first, prereg, `${path}: Rerun 1 data must not be in the preregistration commit`);
    assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', prereg!, first]).status, 0, `${path}: ${prereg!.slice(0, 7)} must precede ${first.slice(0, 7)}`);
  }
});
