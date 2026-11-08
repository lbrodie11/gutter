import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractReleaseNotes, shouldMoveMajorTag } from '../scripts/release-notes.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('extractReleaseNotes parses multiline CHANGELOG sections without matching prerelease prefixes', () => {
  const fixture = [
    '# Changelog',
    '',
    '## 0.1.0-rc.1 · 2026-04-19',
    '- Release candidate note',
    '',
    '## 0.1.0 · 2026-04-20',
    '### Added',
    '- First line of 0.1.0',
    '- Second line of 0.1.0',
    '',
    '## 0.0.9 · 2026-04-01',
    '- Older release',
  ].join('\n');

  assert.equal(
    extractReleaseNotes(fixture, 'v0.1.0'),
    '### Added\n- First line of 0.1.0\n- Second line of 0.1.0',
  );
  assert.equal(extractReleaseNotes(fixture, 'v0.1.0-rc.1'), '- Release candidate note');
  assert.equal(extractReleaseNotes(fixture, 'v9.9.9'), 'Release 9.9.9');
});

test('shouldMoveMajorTag advances v0 on newer releases but never on prereleases or older backports', () => {
  assert.equal(shouldMoveMajorTag('v0.1.0', []), true);
  assert.equal(shouldMoveMajorTag('v0.2.0', ['v0.1.0', 'v0']), true);
  assert.equal(shouldMoveMajorTag('v0.2.0-rc.1', ['v0.1.0']), false);
  assert.equal(shouldMoveMajorTag('v0.1.5', ['v0.1.0', 'v0.2.0']), false);
});

test('release.yml exports EXISTING_TAGS and its extracted MOVE_MAJOR block blocks older backports', { skip: process.platform === 'win32' }, () => {
  const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  const exportMatch = /^\s*(export EXISTING_TAGS="\$\(git tag -l\)")/m.exec(workflow);
  assert.ok(exportMatch && exportMatch[1], 'release.yml must export EXISTING_TAGS');

  const moveMajorMatch = /^\s*(MOVE_MAJOR=\$\(node --experimental-strip-types[\s\S]*?\n\s*'\))/m.exec(workflow);
  assert.ok(moveMajorMatch && moveMajorMatch[1], 'extracted MOVE_MAJOR command from release.yml');

  // Stub `git tag -l` via a shell function so the exact `export EXISTING_TAGS="$(git tag -l)"` line from release.yml is executed.
  const script = [
    'git() { printf "v0.1.0\\nv0.2.0\\nv0\\n"; }',
    exportMatch[1],
    moveMajorMatch[1],
    'printf "%s" "$MOVE_MAJOR"',
  ].join('\n');

  const backportRes = spawnSync('bash', ['-c', script], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TAG: 'v0.1.5' },
  });
  assert.equal(backportRes.status, 0, backportRes.stderr);
  assert.equal(backportRes.stdout, 'false', 'v0.1.5 backport after v0.2.0 must not move v0 backwards');

  const newerRes = spawnSync('bash', ['-c', script], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TAG: 'v0.3.0' },
  });
  assert.equal(newerRes.status, 0, newerRes.stderr);
  assert.equal(newerRes.stdout, 'true', 'v0.3.0 after v0.2.0 must move v0 forward');
});
