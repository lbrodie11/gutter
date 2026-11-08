import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
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

test('release.yml MOVE_MAJOR shell snippet exports EXISTING_TAGS into the Node subprocess', { skip: process.platform === 'win32' }, () => {
  const snippet = `
    export EXISTING_TAGS=$(printf "v0.1.0\\nv0.2.0\\nv0\\n")
    export TAG="v0.1.5"
    node --experimental-strip-types --input-type=module -e '
      import { shouldMoveMajorTag } from "./scripts/release-notes.ts";
      const tag = process.env.TAG ?? "";
      const existing = (process.env.EXISTING_TAGS ?? "").split(/\\r?\\n/).filter(Boolean);
      process.stdout.write(shouldMoveMajorTag(tag, existing) ? "true" : "false");
    '
  `;
  const res = spawnSync('bash', ['-c', snippet], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, 'false', 'v0.1.5 backport after v0.2.0 must not move v0 backwards');
});
