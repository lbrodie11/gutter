import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const cliPath = resolve(import.meta.dirname, '../src/cli.ts');

function runCli(args: string[]) {
  return spawnSync(process.execPath, ['--experimental-strip-types', cliPath, ...args], { encoding: 'utf8' });
}

test('CLI: --help after a subcommand prints usage and exits 0 instead of rejecting the option', () => {
  for (const args of [['bench', '--help'], ['brief', '-h'], ['render', '--help'], ['bench', '--prs', '5', '--help']]) {
    const res = runCli(args);
    assert.equal(res.status, 0, `${args.join(' ')}: ${res.stderr}`);
    assert.match(res.stdout, /^gutter \d+\.\d+\.\d+/);
    assert.match(res.stdout, /bench options/);
  }
});

test('CLI: unknown subcommand options are still rejected', () => {
  const res = runCli(['bench', '--no-such-flag']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /--no-such-flag/);
});
