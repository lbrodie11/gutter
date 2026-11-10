import { execFileSync } from 'node:child_process';
/**
 * Run git with an argument vector (never a shell string), so file names and
 * refs from an untrusted PR can't inject commands.
 */
export function git(cwd, args, opts = {}) {
    try {
        return execFileSync('git', args, {
            cwd,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    }
    catch (err) {
        if (opts.allowFail)
            return '';
        const e = err;
        throw new Error(`git ${args.join(' ')} failed: ${(e.stderr || e.message).trim()}`);
    }
}
export function repoRoot(cwd) {
    return git(cwd, ['rev-parse', '--show-toplevel']).trim();
}
export function resolveSha(cwd, ref) {
    const out = git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFail: true }).trim();
    return out || undefined;
}
export function resolveMergeBase(cwd, refA, refB) {
    const out = git(cwd, ['merge-base', refA, refB], { allowFail: true }).trim();
    return out || undefined;
}
export function isShallowRepo(cwd) {
    const out = git(cwd, ['rev-parse', '--is-shallow-repository'], { allowFail: true }).trim();
    return out === 'true';
}
/** Check whether `commitSha` or any of its parents has a committer timestamp earlier than its parent's. */
export function hasTimestampAnomaly(cwd, commitSha, extraAncestorSha) {
    const line = git(cwd, ['log', '-1', '--format=%ct%x1f%P', commitSha], { allowFail: true }).trim();
    if (!line)
        return false;
    const [ctRaw = '', parentsRaw = ''] = line.split('\x1f');
    const ct = Number(ctRaw);
    if (!Number.isFinite(ct))
        return false;
    const parents = parentsRaw.trim().split(/\s+/).filter(Boolean);
    if (extraAncestorSha && !parents.includes(extraAncestorSha)) {
        parents.push(extraAncestorSha);
    }
    for (const p of parents) {
        const pCtRaw = git(cwd, ['log', '-1', '--format=%ct', p], { allowFail: true }).trim();
        const pCt = Number(pCtRaw);
        if (Number.isFinite(pCt) && ct < pCt) {
            return true;
        }
    }
    return false;
}
/** Turn a remote URL into an https browse URL, or undefined. */
export function browseUrlFromRemote(remote) {
    const r = remote.trim();
    const ssh = /^git@([^:]+):(.+?)(\.git)?$/.exec(r);
    if (ssh)
        return `https://${ssh[1]}/${ssh[2]}`;
    const https = /^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+?)(\.git)?\/?$/.exec(r);
    if (https)
        return `https://${https[1]}/${https[2]}`;
    return undefined;
}
