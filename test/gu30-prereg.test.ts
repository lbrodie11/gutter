/**
 * GU-30 preregistration: the corpus is schema-valid, and docs/benchmark/CORPUS.md §1–§5 (with the ROADMAP
 * amendment and bench/corpus.json) were committed before any result and are unchanged since.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// @ts-expect-error: plain .mjs module without type declarations
import { validateCorpus } from '../bench/corpus.mjs';

const HEADING = '# GU-30 · Gate A′ corpus run (preregistration)';
const AMENDMENT = 'When real PRs in the corpus produce fewer than 20 `broken-import` items, (b) is evaluated on the preregistered seeded mutations in `CORPUS.md`.';
/** Paths written by the corpus run; the first commit touching each must come after the preregistration. */
const RESULT_PATHS = ['docs/benchmark/results.json', 'docs/benchmark/README.md', ':(glob)docs/benchmark/data/*/corpus/**'];

const corpus = () => JSON.parse(readFileSync('bench/corpus.json', 'utf8'));

test('corpus.json: valid; 20 pinned repositories covering every required category', () => {
  const doc = corpus();
  assert.deepEqual(validateCorpus(doc), []);
  assert.equal(doc.repos.length, 20);
  const by = (k: string) => doc.repos.filter((r: { category: string }) => r.category === k).length;
  assert.equal(doc.repos[0].url, 'https://github.com/honojs/hono');
  assert.equal(doc.repos[0].pinnedSha, 'eb754bd5ef22c63f1634a4c374a86be086f85710');
  assert.ok(by('ts-library') >= 5 && by('ts-app-paths') >= 3 && by('ts-monorepo') >= 3 && by('go') >= 3 && by('python') >= 3);
  assert.ok(doc.repos.filter((r: { expected: string }) => r.expected === 'hard').length >= 2);
  assert.ok(doc.repos.filter((r: { botShare?: number }) => (r.botShare ?? 0) >= 0.2).length >= 2);
  assert.ok(new Set(doc.repos.map((r: { mergeStyle: string }) => r.mergeStyle)).size >= 2, 'a mix of merge styles');
});

test('corpus.json: a missing pinnedSha or why, a bad SHA, or an unknown field is rejected', () => {
  const base = corpus();
  const variant = (f: (r: Record<string, unknown>) => void) => {
    const d = structuredClone(base);
    f(d.repos[1]);
    return validateCorpus(d).join('\n');
  };
  assert.match(variant((r) => delete r.pinnedSha), /pinnedSha: missing/);
  assert.match(variant((r) => delete r.why), /why: missing/);
  assert.match(variant((r) => (r.pinnedSha = 'main')), /pinnedSha: does not match/);
  assert.match(variant((r) => (r.mergeStyle = 'rebase')), /mergeStyle/);
  assert.match(variant((r) => (r.extra = 1)), /extra: unknown property/);
  const dup = structuredClone(base);
  dup.repos.push(dup.repos[0]);
  assert.match(validateCorpus(dup).join('\n'), /duplicate/);
});

const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const shallow = (() => {
  try {
    return git(['rev-parse', '--is-shallow-repository']) === 'true';
  } catch {
    return true;
  }
})();
const preregCommit = () => git(['log', '--reverse', '--format=%H', '-S', HEADING, '--', 'docs/benchmark/CORPUS.md']).split('\n')[0] || undefined;
/** §1–§5 of CORPUS.md: normalize line endings first, then take both offsets from the normalized text. */
const sections = (doc: string) => {
  const lf = doc.replace(/\r\n/g, '\n');
  return lf.slice(lf.indexOf('## 1. Corpus'), lf.indexOf('## Results'));
};

test('sections(): a CRLF checkout (Windows) gives the same §1–§5 as LF', () => {
  const lf = '# Title\n\nIntro line\n\n## 1. Corpus\n\nA\nB\n\n## 5. Verdict rule\n\nC\n\n## Results\n\nD\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  assert.equal(sections(crlf), sections(lf));
  assert.equal(sections(lf), '## 1. Corpus\n\nA\nB\n\n## 5. Verdict rule\n\nC\n\n');
});

test('preregistration: §1–§5, the ROADMAP amendment and corpus.json came in one commit before every result, unchanged since', { skip: shallow && process.env.CI !== 'true' ? 'shallow clone: no history to check' : false }, () => {
  assert.equal(shallow, false, 'CI must check out full history (fetch-depth: 0) for this test');
  const prereg = preregCommit();
  assert.ok(prereg, 'preregistration commit found');
  const show = (path: string) => git(['show', `${prereg}:${path}`]);
  assert.ok(show('docs/ROADMAP.md').includes(AMENDMENT), 'ROADMAP amendment is in the preregistration commit');
  assert.deepEqual(JSON.parse(show('bench/corpus.json')), corpus(), 'corpus.json unchanged since preregistration');
  const atPrereg = sections(show('docs/benchmark/CORPUS.md'));
  assert.ok(atPrereg.includes('## 5. Verdict rule'), 'sections 1–5 present');
  assert.equal(sections(readFileSync('docs/benchmark/CORPUS.md', 'utf8')), atPrereg, 'sections 1–5 unchanged since preregistration');
  for (const path of RESULT_PATHS) {
    const first = git(['log', '--reverse', '--format=%H', '--', path]).split('\n')[0];
    if (!first) continue;
    assert.notEqual(first, prereg, `${path}: results must not be in the preregistration commit`);
    assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', prereg!, first]).status, 0, `${path}: ${prereg!.slice(0, 7)} must precede ${first.slice(0, 7)}`);
  }
});
