import { git } from '../git.ts';
import type { ChangeStructure, ChangedFile, FileStatus, ModuleSummary } from '../contract.ts';

const CONTAINERS = new Set(['src', 'packages', 'apps', 'lib', 'libs', 'services', 'internal', 'cmd', 'pkg', 'modules', 'crates']);

/** Group a path into a reviewer-meaningful module ("src/adapter", "packages/core", "(root)"). */
export function moduleOf(path: string): string {
  const parts = path.split('/');
  if (parts.length === 1) return '(root)';
  const [first, second] = parts;
  if (first && second && CONTAINERS.has(first) && parts.length >= 3) return `${first}/${second}`;
  return first ?? '(root)';
}

const TEST_PATH = /(^|\/)(__tests__|__test__|tests?|spec|specs)\//;
const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(_test\.go$)|((^|\/)test_[^/]+\.py$)|(_test\.py$)|(Test\.(java|kt)$)/;

export function isTestPath(path: string): boolean {
  return TEST_PATH.test(path) || TEST_FILE.test(path);
}

const LANGS: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', rb: 'ruby',
  cs: 'csharp', php: 'php', swift: 'swift', sql: 'sql', css: 'css', scss: 'css',
  md: 'markdown', json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'toml',
};

export function languageOf(path: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return (m && LANGS[m[1]!.toLowerCase()]) || null;
}

/** Read the change set between the merge base of `base` and `head`. */
export function readChanges(root: string, base: string, head: string): ChangeStructure {
  const range = `${base}...${head}`;
  const statusRaw = git(root, ['diff', '--no-color', '--name-status', '-M', '-z', range]);
  const numRaw = git(root, ['diff', '--no-color', '--numstat', '-M', '-z', range]);

  const statuses = parseNameStatus(statusRaw);
  const nums = parseNumstat(numRaw);

  const files: ChangedFile[] = statuses.map((s) => {
    const n = nums.get(s.path);
    return {
      path: s.path,
      ...(s.oldPath ? { oldPath: s.oldPath } : {}),
      status: s.status,
      additions: n?.additions ?? 0,
      deletions: n?.deletions ?? 0,
      binary: n?.binary ?? false,
      module: moduleOf(s.path),
      isTest: isTestPath(s.path),
      language: languageOf(s.path),
    };
  });

  return summarize(files);
}

export function summarize(files: ChangedFile[]): ChangeStructure {
  const byModule = new Map<string, ModuleSummary>();
  for (const f of files) {
    const m = byModule.get(f.module) ?? { name: f.module, files: 0, additions: 0, deletions: 0 };
    m.files += 1;
    m.additions += f.additions;
    m.deletions += f.deletions;
    byModule.set(f.module, m);
  }
  const modules = [...byModule.values()].sort(
    (a, b) => b.additions + b.deletions - (a.additions + a.deletions) || a.name.localeCompare(b.name),
  );
  return {
    files,
    modules,
    totals: {
      files: files.length,
      additions: files.reduce((s, f) => s + f.additions, 0),
      deletions: files.reduce((s, f) => s + f.deletions, 0),
      modules: modules.length,
    },
  };
}

interface StatusEntry { path: string; oldPath?: string; status: FileStatus }

function parseNameStatus(raw: string): StatusEntry[] {
  const parts = raw.split('\0').filter((p) => p.length > 0);
  const out: StatusEntry[] = [];
  for (let i = 0; i < parts.length; ) {
    const code = parts[i++]!;
    const letter = code[0];
    if (letter === 'R' || letter === 'C') {
      const oldPath = parts[i++]!;
      const path = parts[i++]!;
      out.push(letter === 'R' ? { path, oldPath, status: 'renamed' } : { path, status: 'added' });
    } else {
      const path = parts[i++]!;
      const status: FileStatus = letter === 'A' ? 'added' : letter === 'D' ? 'deleted' : 'modified';
      out.push({ path, status });
    }
  }
  return out;
}

function parseNumstat(raw: string): Map<string, { additions: number; deletions: number; binary: boolean }> {
  const out = new Map<string, { additions: number; deletions: number; binary: boolean }>();
  const parts = raw.split('\0');
  for (let i = 0; i < parts.length; ) {
    const head = parts[i++];
    if (!head) continue;
    const t1 = head.indexOf('\t');
    const t2 = t1 >= 0 ? head.indexOf('\t', t1 + 1) : -1;
    if (t1 < 0 || t2 < 0) continue;
    const a = head.slice(0, t1);
    const d = head.slice(t1 + 1, t2);
    const path = head.slice(t2 + 1);
    let target: string | undefined = path;
    if (path === '') {
      // rename: "<a>\t<d>\t" followed by old\0new\0
      i++; // old path
      target = parts[i++];
    }
    if (!target) continue;
    const binary = a === '-' || d === '-';
    out.set(target, { additions: binary ? 0 : Number(a), deletions: binary ? 0 : Number(d), binary });
  }
  return out;
}

export function headCommits(root: string, base: string, head: string, cap = 20): { sha: string; subject: string }[] {
  const raw = git(root, ['log', '--no-merges', `--max-count=${cap}`, '--format=%H%x1f%s%x1e', `${base}..${head}`], { allowFail: true });
  return raw
    .split('\x1e')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [sha = '', subject = ''] = r.split('\x1f');
      return { sha, subject };
    });
}
