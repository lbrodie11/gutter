/**
 * GitHub Action entry point.
 *
 * Security posture (see docs/DECISIONS.md):
 *  - Designed for `pull_request`, never `pull_request_target`. PR contents are
 *    parsed as text; nothing from the PR is executed.
 *  - Fork PRs get a read-only token: Gutter writes the job summary and the
 *    artifact instead of failing.
 *  - Gutter never fails the build. It explains; it does not gate.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBriefAsync } from '../brief.ts';
import { writeBrief } from '../output.ts';
import { renderMarkdown } from '../render/markdown.ts';
import { GitHubPermissionError, upsertComment } from '../github/comment.ts';
import { resolveSha } from '../git.ts';

interface PullRequestEvent {
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    base: { sha: string; ref: string };
    head: { sha: string; repo: { full_name: string } | null };
  };
}

const input = (name: string, fallback = '') => (process.env[`INPUT_${name.replace(/-/g, '_').toUpperCase()}`] ?? '').trim() || fallback;

function setOutput(name: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${value.replace(/[\r\n]/g, ' ')}\n`);
}

function summary(md: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, md + '\n');
}

async function run(): Promise<void> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const event: PullRequestEvent = eventPath ? JSON.parse(readFileSync(eventPath, 'utf8')) : {};
  const pr = event.pull_request;
  if (!pr) {
    console.log('gutter: not a pull_request event; nothing to brief.');
    setOutput('status', 'skipped');
    return;
  }

  const cwd = join(process.env.GITHUB_WORKSPACE ?? process.cwd(), input('working-directory', '.'));
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const base = input('base', pr.base.sha);

  const checkedOut = resolveSha(cwd, 'HEAD');
  if (checkedOut && checkedOut !== pr.head.sha) {
    console.log(`::notice::Checked-out HEAD (${checkedOut.slice(0, 7)}) is not the PR head (${pr.head.sha.slice(0, 7)}); links point at HEAD. Check out \`ref: \${{ github.event.pull_request.head.sha }}\` to match.`);
  }

  const maxForgottenRaw = Number(input('max-forgotten', '3'));
  // GU-05: the composite step installs repo-archaeology into $RUNNER_TEMP/gutter-ra and exports
  // GUTTER_RA_LIB; loadRaLibrary imports it by absolute path. Never installed into the user's repo.
  const brief = await buildBriefAsync({
    cwd,
    base,
    configRef: base,
    title: pr.title,
    ...(pr.body ? { intent: pr.body } : {}),
    ...(repository ? { repoUrl: `${server}/${repository}` } : {}),
    prNumber: pr.number,
    runner: { spec: input('archaeology-version', '^0.12.0') },
    noHistory: input('history', 'true') === 'false',
    noCalibration: input('calibrate', 'true') === 'false',
    maxForgotten: Number.isFinite(maxForgottenRaw) ? Math.max(0, Math.trunc(maxForgottenRaw)) : 3,
    warn: (message) => console.log(`::warning::Gutter: ${message}`),
  });

  const runUrl = process.env.GITHUB_RUN_ID ? `${server}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;
  const outDir = join(process.env.RUNNER_TEMP ?? cwd, 'gutter');
  const paths = writeBrief(brief, outDir, runUrl ? { pageUrl: runUrl } : {});
  const md = renderMarkdown(brief, runUrl ? { pageUrl: runUrl } : {});

  setOutput('status', 'analyzed');
  setOutput('salience', brief.salience.level);
  setOutput('question-count', String(brief.checklist.length));
  setOutput('forgotten-count', String(brief.forgotten.items.length));
  setOutput('json-path', paths.json);
  setOutput('html-path', paths.html);
  setOutput('out-dir', outDir);
  summary(md);

  const post = input('post', 'auto');
  const token = input('github-token');
  const fromFork = pr.head.repo?.full_name !== repository;
  if (post === 'never' || !token) return;
  if (fromFork) {
    console.log('gutter: fork PR — token is read-only, so the brief is in the job summary and artifact instead of a comment.');
    return;
  }
  try {
    const result = await upsertComment(
      { token, repository, issueNumber: pr.number, ...(process.env.GITHUB_API_URL ? { apiUrl: process.env.GITHUB_API_URL } : {}) },
      md,
      { createIfMissing: post === 'always' || brief.salience.level !== 'quiet' },
    );
    console.log(result.action === 'skipped' ? `gutter: no comment (${result.reason}).` : `gutter: comment ${result.action}: ${result.url}`);
    setOutput('comment', result.action);
  } catch (err) {
    if (err instanceof GitHubPermissionError) console.log(`::warning::${err.message}`);
    else throw err;
  }
}

run().catch((err: Error) => {
  // Explain, don't gate: a Gutter failure must never block a merge.
  console.log(`::warning::gutter could not brief this PR: ${err.message}`);
  setOutput('status', 'error');
});
