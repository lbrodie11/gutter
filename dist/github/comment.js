import { COMMENT_MARKER } from "../render/markdown.js";
export class GitHubPermissionError extends Error {
}
async function gh(t, method, path, body) {
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
    if (!res.ok)
        throw new Error(`GitHub API ${method} ${path} → ${res.status} ${await res.text()}`);
    return (await res.json());
}
async function findExisting(t) {
    const [owner, repo] = t.repository.split('/');
    for (let page = 1; page <= 10; page++) {
        const batch = await gh(t, 'GET', `/repos/${owner}/${repo}/issues/${t.issueNumber}/comments?per_page=100&page=${page}`);
        const hit = batch.find((c) => c.body?.startsWith(COMMENT_MARKER));
        if (hit)
            return hit;
        if (batch.length < 100)
            return undefined;
    }
    return undefined;
}
/**
 * One sticky comment per PR. `quiet` briefs only update an existing comment
 * (so a once-noisy PR can go quiet) and never create a new one.
 */
export async function upsertComment(t, body, opts) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(t.repository))
        throw new Error(`invalid repository "${t.repository}"`);
    const [owner, repo] = t.repository.split('/');
    const existing = await findExisting(t);
    if (existing) {
        const updated = await gh(t, 'PATCH', `/repos/${owner}/${repo}/issues/comments/${existing.id}`, { body });
        return { action: 'updated', url: updated.html_url };
    }
    if (!opts.createIfMissing)
        return { action: 'skipped', reason: 'nothing worth a comment on this PR' };
    const created = await gh(t, 'POST', `/repos/${owner}/${repo}/issues/${t.issueNumber}/comments`, { body });
    return { action: 'created', url: created.html_url };
}
