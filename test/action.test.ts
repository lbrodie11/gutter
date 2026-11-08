import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TempRepo, lines } from './helpers.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_MAIN = join(ROOT, 'dist', 'action', 'main.js');

interface RecordedRequest {
  method: string;
  url: string;
  body: string;
}

let repo: TempRepo;
let headSha: string;
let baseSha: string;
let server: Server;
let apiUrl: string;
const comments: { id: number; body: string; html_url: string }[] = [];
const requests: RecordedRequest[] = [];

before(async () => {
  // Compile dist/ so test/action.test.ts always exercises the built dist/action/main.js path.
  const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tsc, '-p', join(ROOT, 'tsconfig.json')], { cwd: ROOT, stdio: 'pipe' });

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
    const child = spawn(process.execPath, [DIST_MAIN], {
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
    child.on('error', rejectChild);
    child.on('close', (code) => resolveChild({ status: code, stdout, stderr }));
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
    assert.equal(first.outputs.salience, 'brief');
    assert.equal(first.outputs['question-count'], '1');
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
