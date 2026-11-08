import { execFileSync } from 'node:child_process';

/**
 * Run git with an argument vector (never a shell string), so file names and
 * refs from an untrusted PR can't inject commands.
 */
export function git(cwd: string, args: string[], opts: { allowFail?: boolean } = {}): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    if (opts.allowFail) return '';
    const e = err as { stderr?: string; message: string };
    throw new Error(`git ${args.join(' ')} failed: ${(e.stderr || e.message).trim()}`);
  }
}

export function repoRoot(cwd: string): string {
  return git(cwd, ['rev-parse', '--show-toplevel']).trim();
}

export function resolveSha(cwd: string, ref: string): string | undefined {
  const out = git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFail: true }).trim();
  return out || undefined;
}

/** Turn a remote URL into an https browse URL, or undefined. */
export function browseUrlFromRemote(remote: string): string | undefined {
  const r = remote.trim();
  const ssh = /^git@([^:]+):(.+?)(\.git)?$/.exec(r);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  const https = /^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+?)(\.git)?\/?$/.exec(r);
  if (https) return `https://${https[1]}/${https[2]}`;
  return undefined;
}
