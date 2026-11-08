import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TempRepo, lines } from './helpers.ts';
import { extractReleaseNotes, shouldMoveMajorTag } from '../src/release-notes.ts';
import { resolveRaCommand } from '../src/sources/archaeology.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface RecordedRequest {
  method: string;
  url: string;
  body: string;
}

let buildDir: string;
let distMain: string;
let repo: TempRepo;
let headSha: string;
let baseSha: string;
let server: Server;
let apiUrl: string;
const comments: { id: number; body: string; html_url: string }[] = [];
const requests: RecordedRequest[] = [];

before(async () => {
  // Compile into an isolated temp directory so `npm test` never dirties the working tree or leaves stale files.
  buildDir = mkdtempSync(join(tmpdir(), 'gutter-dist-build-'));
  const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tsc, '-p', join(ROOT, 'tsconfig.json'), '--outDir', buildDir], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  distMain = join(buildDir, 'action', 'main.js');

  repo = new TempRepo()
    .write({
      'src/a.ts': `export const a = 1;\n${lines(5)}`,
      'src/a.test.ts': `import { a } from './a.js';\n`,
    })
    .commit('init');
  baseSha = repo.git('rev-parse', 'HEAD').trim();
  repo
    .branch('pr-branch')
    .write({ 'src/a.ts': `export const a = 2;\n${lines(20, 'edit')}` })
    .commit('feat: update a without touching test');
  headSha = repo.git('rev-parse', 'HEAD').trim();

  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const bodyStr = Buffer.concat(chunks).toString('utf8');
      requests.push({ method: req.method ?? 'GET', url: req.url ?? '/', body: bodyStr });
      res.setHeader('content-type', 'application/json');

      if (req.method === 'GET' && req.url?.startsWith('/repos/acme/shop/issues/12/comments')) {
        res.writeHead(200);
        res.end(JSON.stringify(comments));
        return;
      }
      if (req.method === 'POST' && req.url === '/repos/acme/shop/issues/12/comments') {
        const parsed = JSON.parse(bodyStr) as { body: string };
        const created = { id: 101, body: parsed.body, html_url: 'https://github.com/acme/shop/pull/12#issuecomment-101' };
        comments.push(created);
        res.writeHead(201);
        res.end(JSON.stringify(created));
        return;
      }
      if (req.method === 'PATCH' && req.url === '/repos/acme/shop/issues/comments/101') {
        const parsed = JSON.parse(bodyStr) as { body: string };
        comments[0]!.body = parsed.body;
        res.writeHead(200);
        res.end(JSON.stringify(comments[0]));
        return;
      }
      res.writeHead(404);
      res.end(JSON.stringify({ message: 'not found' }));
    });
  });

  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  apiUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  repo.cleanup();
  rmSync(buildDir, { recursive: true, force: true });
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});

async function runAction(envOverrides: Record<string, string>): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
  outputs: Record<string, string>;
  summary: string;
  cleanup: () => void;
}> {
  const scratch = mkdtempSync(join(tmpdir(), 'gutter-action-test-'));
  const eventPath = join(scratch, 'event.json');
  const outPath = join(scratch, 'output.txt');
  const summaryPath = join(scratch, 'summary.md');
  const tempDir = join(scratch, 'temp');

  writeFileSync(
    eventPath,
    JSON.stringify({
      pull_request: {
        number: 12,
        title: 'feat: update a',
        body: 'Updates `a` implementation.',
        base: { sha: baseSha, ref: 'main' },
        head: { sha: headSha, repo: { full_name: 'acme/shop' } },
      },
    }),
  );
  writeFileSync(outPath, '');
  writeFileSync(summaryPath, '');

  const res = await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [distMain], {
      cwd: repo.dir,
      env: {
        ...process.env,
        GITHUB_WORKSPACE: repo.dir,
        GITHUB_REPOSITORY: 'acme/shop',
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_OUTPUT: outPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_API_URL: apiUrl,
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_RUN_ID: '999',
        RUNNER_TEMP: tempDir,
        INPUT_GITHUB_TOKEN: 'test-token',
        INPUT_POST: 'auto',
        INPUT_HISTORY: 'false',
        INPUT_CALIBRATE: 'false',
        ...envOverrides,
      },
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectChild(new Error('Action child process timed out after 15s'));
    }, 15_000);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      rejectChild(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveChild({ status: code, stdout, stderr });
    });
  });

  const outputs: Record<string, string> = {};
  for (const line of readFileSync(outPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const idx = line.indexOf('=');
    if (idx > 0) outputs[line.slice(0, idx)] = line.slice(idx + 1);
  }
  const summary = readFileSync(summaryPath, 'utf8');
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    outputs,
    summary,
    cleanup: () => rmSync(scratch, { recursive: true, force: true }),
  };
}

test('built dist/action/main.js writes outputs, summary, and creates then updates sticky PR comment', async () => {
  const first = await runAction({});
  try {
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(first.outputs.status, 'analyzed');
    assert.notEqual(first.outputs.salience, 'quiet');
    assert.ok(Number(first.outputs['question-count']) >= 1);
    assert.equal(first.outputs.comment, 'created');
    assert.ok(first.outputs['json-path'] && existsSync(first.outputs['json-path']));
    assert.ok(first.outputs['html-path'] && existsSync(first.outputs['html-path']));
    assert.match(first.summary, /<!-- gutter:brief -->/);
    assert.equal(comments.length, 1);

    const second = await runAction({});
    try {
      assert.equal(second.status, 0);
      assert.equal(second.outputs.comment, 'updated');
      assert.equal(comments.length, 1, 'sticky comment updated in place rather than duplicated');
      assert.ok(requests.some((r) => r.method === 'PATCH' && r.url === '/repos/acme/shop/issues/comments/101'));
    } finally {
      second.cleanup();
    }
  } finally {
    first.cleanup();
  }
});

test('built dist/action/main.js never exits non-zero on internal errors and records status=error', async () => {
  const run = await runAction({ INPUT_BASE: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' });
  try {
    assert.equal(run.status, 0, 'Action must exit 0 even when analysis fails');
    assert.equal(run.outputs.status, 'error');
    assert.match(run.stdout, /::warning::gutter could not brief this PR:/);
  } finally {
    run.cleanup();
  }
});

test('action.yml shell wrapper fails open when dist/action/main.js is missing or Node < 22', { skip: process.platform === 'win32' }, () => {
  const actionYml = readFileSync(join(ROOT, 'action.yml'), 'utf8');
  const runMatch = /run:\s*\|\n([\s\S]*?)\n\n\s*- name: Upload/.exec(actionYml);
  assert.ok(runMatch && runMatch[1], 'extracted composite shell script from action.yml');
  const script = runMatch[1]
    .split('\n')
    .map((line) => line.replace(/^ {8}/, ''))
    .join('\n');

  const scratch = mkdtempSync(join(tmpdir(), 'gutter-wrapper-test-'));
  try {
    // 1. Missing dist/action/main.js fails open with status=error and exit 0.
    const outMissing = join(scratch, 'out-missing.txt');
    writeFileSync(outMissing, '');
    const resMissing = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_ACTION_PATH: scratch, GITHUB_OUTPUT: outMissing },
    });
    assert.equal(resMissing.status, 0);
    assert.match(resMissing.stdout, /::warning::Gutter's built dist\/action\/main\.js was not found/);
    assert.match(readFileSync(outMissing, 'utf8'), /status=error/);

    // 2. Non-numeric or old Node version fails open without bash [ -lt ] errors.
    const fakeBin = join(scratch, 'bin');
    mkdtempSync(join(scratch, 'bin-'));
    const stubDir = mkdtempSync(join(scratch, 'stub-node-'));
    const fakeNode = join(stubDir, 'node');
    writeFileSync(fakeNode, '#!/bin/sh\nif [ "$1" = "-v" ]; then echo "v20.19.0"; else echo "not-a-number"; fi\n');
    chmodSync(fakeNode, 0o755);
    const outOld = join(scratch, 'out-old.txt');
    writeFileSync(outOld, '');
    const resOld = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${stubDir}:${process.env.PATH ?? ''}`,
        GITHUB_ACTION_PATH: scratch,
        GITHUB_OUTPUT: outOld,
      },
    });
    assert.equal(resOld.status, 0);
    assert.equal(resOld.stderr, '');
    assert.match(resOld.stdout, /::warning::Gutter needs Node\.js >= 22/);
    assert.match(readFileSync(outOld, 'utf8'), /status=error/);
    void fakeBin;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('resolveRaCommand resolves Windows npx-cli.js or throws an actionable error instead of ENOENT', () => {
  // 1. Windows with npm_execpath present
  const fromNpmExec = resolveRaCommand(
    {},
    {
      platform: 'win32',
      execPath: 'C:\\Program Files\\nodejs\\node.exe',
      env: { npm_execpath: 'C:\\npm\\bin\\npm-cli.js' },
      exists: (p) => p.endsWith('npx-cli.js') && p.includes('npm'),
    },
  );
  assert.equal(fromNpmExec.file, 'C:\\Program Files\\nodejs\\node.exe');
  assert.ok(fromNpmExec.pre[0]?.endsWith('npx-cli.js'));
  assert.deepEqual(fromNpmExec.pre.slice(1), ['--yes', 'repo-archaeology@^0.3.0']);

  // 2. Windows when neither candidate exists throws a clear error mentioning GUTTER_RA_BIN
  assert.throws(
    () =>
      resolveRaCommand(
        {},
        {
          platform: 'win32',
          execPath: 'C:\\Program Files\\nodejs\\node.exe',
          env: {},
          exists: () => false,
        },
      ),
    /Could not locate npx-cli\.js.*GUTTER_RA_BIN/,
  );

  // 3. POSIX fallback uses npx directly
  const posix = resolveRaCommand({}, { platform: 'linux', env: {} });
  assert.deepEqual(posix, { file: 'npx', pre: ['--yes', 'repo-archaeology@^0.3.0'] });
});

test('extractReleaseNotes parses multiline CHANGELOG sections without matching prerelease prefixes', () => {
  const realChangelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  const notes010 = extractReleaseNotes(realChangelog, 'v0.1.0');
  assert.match(notes010, /`gutter\.json` v1 contract and JSON Schema/);
  assert.notEqual(notes010, 'Release 0.1.0');

  const multi = [
    '# Changelog',
    '',
    '## 0.1.0-rc.1 · 2026-04-19',
    '- Release candidate note',
    '',
    '## 0.1.0 · 2026-04-20',
    '- First line of 0.1.0',
    '- Second line of 0.1.0',
    '',
    '## 0.0.9 · 2026-04-01',
    '- Older release',
  ].join('\n');

  assert.equal(extractReleaseNotes(multi, 'v0.1.0'), '- First line of 0.1.0\n- Second line of 0.1.0');
  assert.equal(extractReleaseNotes(multi, 'v0.1.0-rc.1'), '- Release candidate note');
  assert.equal(extractReleaseNotes(multi, 'v9.9.9'), 'Release 9.9.9');
});

test('shouldMoveMajorTag advances v0 on newer releases but never on prereleases or older backports', () => {
  assert.equal(shouldMoveMajorTag('v0.1.0', []), true);
  assert.equal(shouldMoveMajorTag('v0.2.0', ['v0.1.0', 'v0']), true);
  assert.equal(shouldMoveMajorTag('v0.2.0-rc.1', ['v0.1.0']), false);
  assert.equal(shouldMoveMajorTag('v0.1.5', ['v0.1.0', 'v0.2.0']), false);
});
