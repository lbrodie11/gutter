import { COMMENT_MARKER } from '../render/markdown.ts';

export interface CommentTarget {
  token: string;
  /** "owner/name" */
  repository: string;
  issueNumber: number;
  apiUrl?: string;
}

export type CommentResult =
  | { action: 'created' | 'updated'; url: string }
  | { action: 'skipped'; reason: string };

export class GitHubPermissionError extends Error {}

interface IssueComment { id: number; body?: string; html_url: string }

async function gh<T>(t: CommentTarget, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${t.apiUrl ?? 'https://api.github.com'}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${t.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'gutter-action',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 403 || res.status === 404) {
    throw new GitHubPermissionError(`GitHub API ${method} ${path} → ${res.status}. The token needs pull-requests: write (fork PRs get a read-only token).`);
  }
  if (!res.ok) throw new Error(`GitHub API ${method} ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function findExisting(t: CommentTarget): Promise<IssueComment | undefined> {
  const [owner, repo] = t.repository.split('/');
  for (let page = 1; page <= 10; page++) {
    const batch = await gh<IssueComment[]>(t, 'GET', `/repos/${owner}/${repo}/issues/${t.issueNumber}/comments?per_page=100&page=${page}`);
    const hit = batch.find((c) => c.body?.startsWith(COMMENT_MARKER));
    if (hit) return hit;
    if (batch.length < 100) return undefined;
  }
  return undefined;
}

/**
 * One sticky comment per PR. `quiet` briefs only update an existing comment
 * (so a once-noisy PR can go quiet) and never create a new one.
 */
export async function upsertComment(t: CommentTarget, body: string, opts: { createIfMissing: boolean }): Promise<CommentResult> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(t.repository)) throw new Error(`invalid repository "${t.repository}"`);
  const [owner, repo] = t.repository.split('/');
  const existing = await findExisting(t);
  if (existing) {
    const updated = await gh<IssueComment>(t, 'PATCH', `/repos/${owner}/${repo}/issues/comments/${existing.id}`, { body });
    return { action: 'updated', url: updated.html_url };
  }
  if (!opts.createIfMissing) return { action: 'skipped', reason: 'nothing worth a comment on this PR' };
  const created = await gh<IssueComment>(t, 'POST', `/repos/${owner}/${repo}/issues/${t.issueNumber}/comments`, { body });
  return { action: 'created', url: created.html_url };
}
