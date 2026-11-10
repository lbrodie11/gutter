import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TempRepo, lines } from './helpers.ts';
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

test('action.yml shell wrapper fails open when dist/action/main.js is missing, Node < 22, or node output is non-numeric', { skip: process.platform === 'win32' }, () => {
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

    // 2. Real older Node major version (20) hits the numeric `-lt 22` branch and fails open.
    const stubNode20Dir = mkdtempSync(join(scratch, 'stub-node20-'));
    const fakeNode20 = join(stubNode20Dir, 'node');
    writeFileSync(fakeNode20, '#!/bin/sh\nif [ "$1" = "-v" ]; then echo "v20.19.0"; else echo "20"; fi\n');
    chmodSync(fakeNode20, 0o755);
    const outNode20 = join(scratch, 'out-node20.txt');
    writeFileSync(outNode20, '');
    const resNode20 = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${stubNode20Dir}:${process.env.PATH ?? ''}`,
        GITHUB_ACTION_PATH: scratch,
        GITHUB_OUTPUT: outNode20,
      },
    });
    assert.equal(resNode20.status, 0);
    assert.equal(resNode20.stderr, '');
    assert.match(resNode20.stdout, /::warning::Gutter needs Node\.js >= 22 on PATH \(found v20\.19\.0\)/);
    assert.match(readFileSync(outNode20, 'utf8'), /status=error/);

    // 3. Non-numeric `node -p` output is sanitized by `case "$NODE_MAJOR"` without bash `[ -lt ]` stderr.
    const stubBadDir = mkdtempSync(join(scratch, 'stub-node-bad-'));
    const fakeNodeBad = join(stubBadDir, 'node');
    writeFileSync(fakeNodeBad, '#!/bin/sh\nif [ "$1" = "-v" ]; then echo "custom-node"; else echo "not-a-number"; fi\n');
    chmodSync(fakeNodeBad, 0o755);
    const outBad = join(scratch, 'out-bad.txt');
    writeFileSync(outBad, '');
    const resBad = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${stubBadDir}:${process.env.PATH ?? ''}`,
        GITHUB_ACTION_PATH: scratch,
        GITHUB_OUTPUT: outBad,
      },
    });
    assert.equal(resBad.status, 0);
    assert.equal(resBad.stderr, '');
    assert.match(resBad.stdout, /::warning::Gutter needs Node\.js >= 22/);
    assert.match(readFileSync(outBad, 'utf8'), /status=error/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('action.yml installs each requested repo-archaeology version into its own prefix (review P2)', { skip: process.platform === 'win32' }, () => {
  const actionYml = readFileSync(join(ROOT, 'action.yml'), 'utf8');
  const runMatch = /run:\s*\|\n([\s\S]*?)\n\n\s*- name: Upload/.exec(actionYml);
  const prefixMatch = /id: ra-prefix[\s\S]*?\n      run: (.*)\n/.exec(actionYml);
  assert.ok(runMatch?.[1] && prefixMatch?.[1], 'extracted the brief script and the prefix step');
  const script = runMatch[1].split('\n').map((line) => line.replace(/^ {8}/, '')).join('\n');
  const scratch = mkdtempSync(join(tmpdir(), 'gutter-ra-prefix-'));
  try {
    const bin = join(scratch, 'bin');
    const actionPath = join(scratch, 'action');
    const temp = join(scratch, 'temp');
    mkdirSync(bin);
    mkdirSync(join(actionPath, 'dist', 'action'), { recursive: true });
    mkdirSync(temp);
    writeFileSync(join(actionPath, 'dist', 'action', 'main.js'), '');
    // Fake node: version checks pass; running main.js reports the library dir and its installed version.
    writeFileSync(join(bin, 'node'), '#!/bin/sh\ncase "$1" in -v) echo v24.0.0;; -p) echo 24;; *) echo "LIB=$GUTTER_RA_LIB VERSION=$(sed -n \'s/.*"version":"\\([^"]*\\)".*/\\1/p\' "$GUTTER_RA_LIB/package.json")";; esac\n');
    // Fake npm: "installs" exactly the requested version into --prefix.
    writeFileSync(join(bin, 'npm'), '#!/bin/sh\nfor a; do if [ "$n" = 1 ]; then p="$a"; n=; fi; [ "$a" = --prefix ] && n=1; case "$a" in repo-archaeology@*) v="${a#repo-archaeology@}";; esac; done\nmkdir -p "$p/node_modules/repo-archaeology" && printf \'{"name":"repo-archaeology","version":"%s"}\' "$v" > "$p/node_modules/repo-archaeology/package.json"\n');
    chmodSync(join(bin, 'node'), 0o755);
    chmodSync(join(bin, 'npm'), 0o755);
    const run = (spec: string) => {
      const out = join(scratch, 'prefix.txt');
      writeFileSync(out, '');
      spawnSync('bash', ['-c', prefixMatch[1]!], { env: { ...process.env, SPEC: spec, RUNNER_TEMP: temp, GITHUB_OUTPUT: out } });
      const dir = /^dir=(.*)$/m.exec(readFileSync(out, 'utf8'))?.[1] ?? '';
      const res = spawnSync('bash', ['-c', script], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, GITHUB_ACTION_PATH: actionPath, RUNNER_TEMP: temp, INPUT_ARCHAEOLOGY_VERSION: spec, INPUT_RA_PREFIX: dir, GITHUB_OUTPUT: join(scratch, 'o.txt') },
      });
      return { dir, line: res.stdout.trim().split('\n').pop() ?? '' };
    };
    const a = run('0.4.0');
    const b = run('0.10.0');
    const c = run('^0.10.0');
    const d = run('~0.10.0');
    assert.match(a.line, /VERSION=0\.4\.0$/);
    assert.match(b.line, /VERSION=0\.10\.0$/, 'a second version is installed, not the first one reused');
    assert.equal(new Set([a.dir, b.dir, c.dir, d.dir]).size, 4, 'one prefix per spec, including ^ vs ~');
    for (const x of [a, b, c, d]) assert.ok(x.dir.startsWith(join(temp, 'gutter-ra')) && x.line.includes(`LIB=${x.dir}/node_modules/repo-archaeology`));
    assert.match(run('0.4.0').line, /VERSION=0\.4\.0$/, 'a repeated spec reuses its own install');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('resolveRaCommand resolves both Windows npx-cli.js candidates with win32 paths or throws an actionable error', () => {
  // 1. Windows candidate #1: sibling of npm_execpath (`C:\npm\bin\npx-cli.js`) wins when present.
  const fromNpmExec = resolveRaCommand(
    {},
    {
      platform: 'win32',
      execPath: 'C:\\Program Files\\nodejs\\node.exe',
      env: { npm_execpath: 'C:\\npm\\bin\\npm-cli.js' },
      exists: (p) => p === 'C:\\npm\\bin\\npx-cli.js',
    },
  );
  assert.equal(fromNpmExec.file, 'C:\\Program Files\\nodejs\\node.exe');
  assert.deepEqual(fromNpmExec.pre, ['C:\\npm\\bin\\npx-cli.js', '--yes', 'repo-archaeology@^0.10.0']);

  // 2. Windows candidate #2: bundled npm next to node.exe (`C:\Program Files\nodejs\node_modules\npm\bin\npx-cli.js`) wins when npm_execpath is unset.
  const fromNodeDir = resolveRaCommand(
    {},
    {
      platform: 'win32',
      execPath: 'C:\\Program Files\\nodejs\\node.exe',
      env: {},
      exists: (p) => p === 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js',
    },
  );
  assert.equal(fromNodeDir.file, 'C:\\Program Files\\nodejs\\node.exe');
  assert.deepEqual(fromNodeDir.pre, [
    'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js',
    '--yes',
    'repo-archaeology@^0.10.0',
  ]);

  // 3. Windows when neither candidate exists throws a clear error mentioning GUTTER_RA_BIN.
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

  // 4. POSIX fallback uses npx directly.
  const posix = resolveRaCommand({}, { platform: 'linux', env: {} });
  assert.deepEqual(posix, { file: 'npx', pre: ['--yes', 'repo-archaeology@^0.10.0'] });
});
