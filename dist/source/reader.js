import { lstatSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { MessageChannel, receiveMessageOnPort, Worker } from 'node:worker_threads';
import { git } from "../git.js";
export const MAX_FILE_BYTES = 512 * 1024;
const CAT_FILE_TIMEOUT_MS = 10_000;
/**
 * Validate and normalize a repo-relative POSIX path.
 * Rejects empty paths, leading slashes, backslashes, control characters, and `..` segments.
 */
export function normalizeSafeRepoPath(relPath) {
    if (!relPath || typeof relPath !== 'string')
        return undefined;
    if (/[\0\r\n\\]/.test(relPath))
        return undefined;
    if (relPath.startsWith('/'))
        return undefined;
    const parts = relPath.split('/');
    for (const part of parts) {
        if (!part || part === '.' || part === '..')
            return undefined;
    }
    const norm = posix.normalize(relPath);
    if (!norm || norm === '.' || norm === '..' || norm.startsWith('../') || posix.isAbsolute(norm)) {
        return undefined;
    }
    return norm;
}
export class WorkingTreeReader {
    root;
    maxBytes;
    trackedCache;
    trackedSet;
    constructor(root, maxBytes = MAX_FILE_BYTES) {
        this.root = root;
        this.maxBytes = maxBytes;
    }
    listFiles() {
        if (this.trackedCache !== undefined)
            return this.trackedCache;
        const raw = git(this.root, ['ls-files', '-z']);
        const files = [];
        for (const entry of raw.split('\0')) {
            const norm = normalizeSafeRepoPath(entry);
            if (!norm)
                continue;
            if (this.isRegularWorkingTreeFile(norm)) {
                files.push(norm);
            }
        }
        this.trackedCache = files;
        this.trackedSet = new Set(files);
        return files;
    }
    hasFile(relPath) {
        const norm = normalizeSafeRepoPath(relPath);
        if (!norm)
            return false;
        if (this.trackedSet !== undefined && this.trackedSet.has(norm)) {
            return true;
        }
        return this.isRegularWorkingTreeFile(norm);
    }
    readText(relPath, maxBytes = this.maxBytes) {
        const norm = normalizeSafeRepoPath(relPath);
        if (!norm)
            return undefined;
        if (!this.isRegularWorkingTreeFile(norm))
            return undefined;
        const abs = join(this.root, norm);
        try {
            const st = lstatSync(abs);
            if (st.isSymbolicLink() || !st.isFile() || st.size > maxBytes)
                return undefined;
            const buf = readFileSync(abs);
            if (buf.length > maxBytes || buf.includes(0))
                return undefined;
            return buf.toString('utf8');
        }
        catch {
            return undefined;
        }
    }
    close() {
        // WorkingTreeReader has no background worker.
    }
    isRegularWorkingTreeFile(normPath) {
        const parts = normPath.split('/');
        let current = this.root;
        for (let i = 0; i < parts.length; i++) {
            current = join(current, parts[i]);
            try {
                const st = lstatSync(current);
                if (st.isSymbolicLink())
                    return false;
                if (i === parts.length - 1 && !st.isFile())
                    return false;
                if (i < parts.length - 1 && !st.isDirectory())
                    return false;
            }
            catch {
                return false;
            }
        }
        return true;
    }
}
const CAT_FILE_WORKER_SCRIPT = `
const { spawn } = require('node:child_process');
const { workerData } = require('node:worker_threads');

const { root, port, initLock } = workerData;

const child = spawn('git', ['cat-file', '--batch'], {
  cwd: root,
  env: {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
    GIT_NO_REPLACE_OBJECTS: '1',
    LC_ALL: 'C',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});

let childExited = false;
let stderrText = '';
const chunks = [];
let totalBuffered = 0;
let pendingStep = null;

function notifyWaiter(lock, value = 1) {
  Atomics.store(lock, 0, value);
  Atomics.notify(lock, 0, 1);
}

function consumeBytes(n) {
  const out = Buffer.allocUnsafe(n);
  let offset = 0;
  while (offset < n && chunks.length > 0) {
    const first = chunks[0];
    const take = Math.min(first.length, n - offset);
    first.copy(out, offset, 0, take);
    offset += take;
    if (take === first.length) {
      chunks.shift();
    } else {
      chunks[0] = first.subarray(take);
    }
  }
  totalBuffered -= offset;
  return out;
}

function discardFromBuffer(maxToDiscard) {
  let discarded = 0;
  while (discarded < maxToDiscard && chunks.length > 0) {
    const first = chunks[0];
    const take = Math.min(first.length, maxToDiscard - discarded);
    discarded += take;
    if (take === first.length) {
      chunks.shift();
    } else {
      chunks[0] = first.subarray(take);
    }
  }
  totalBuffered -= discarded;
  return discarded;
}

function findNewlineOffset() {
  let scanned = 0;
  for (let i = 0; i < chunks.length; i++) {
    const buf = chunks[i];
    const idx = buf.indexOf(0x0a);
    if (idx !== -1) return scanned + idx;
    scanned += buf.length;
  }
  return -1;
}

child.stdout.on('data', (chunk) => {
  chunks.push(chunk);
  totalBuffered += chunk.length;
  if (pendingStep) pendingStep();
});

child.stderr.on('data', (chunk) => {
  if (stderrText.length < 4096) {
    stderrText += chunk.toString('utf8');
  }
});

child.on('error', (err) => {
  if (stderrText.length < 4096 && err && err.message) {
    stderrText += err.message;
  }
  childExited = true;
  if (pendingStep) pendingStep();
});

child.on('close', () => {
  childExited = true;
  if (pendingStep) pendingStep();
});

port.on('message', (msg) => {
  if (msg.type === 'close') {
    const finishClose = () => {
      port.postMessage({ type: 'closed' });
      notifyWaiter(msg.lock, 1);
      port.close();
      process.exit(0);
    };
    if (childExited) {
      finishClose();
      return;
    }
    child.once('close', finishClose);
    try {
      child.stdin.end();
    } catch {}
    setTimeout(() => {
      try { child.kill('SIGTERM'); } catch {}
    }, 30).unref();
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
    }, 150).unref();
    return;
  }

  if (msg.type === 'read') {
    const { spec, maxBytes, lock } = msg;
    if (childExited || !child.stdin.writable) {
      port.postMessage({ content: undefined, dead: true, stderr: stderrText });
      notifyWaiter(lock, 1);
      return;
    }

    let phase = 'header';
    let bodySize = 0;
    let remainingToRead = 0;
    let discard = false;

    const finishRead = (content, dead = false) => {
      pendingStep = null;
      port.postMessage({ content, dead, stderr: dead ? stderrText : undefined });
      notifyWaiter(lock, 1);
    };

    pendingStep = () => {
      if (phase === 'header') {
        const nl = findNewlineOffset();
        if (nl === -1) {
          if (childExited) finishRead(undefined, true);
          return;
        }
        const headerLine = consumeBytes(nl + 1).subarray(0, nl).toString('utf8');
        const match = /^[0-9a-f]{40,64} (\\S+) (\\d+)$/.exec(headerLine);
        if (!match) {
          finishRead(undefined, false);
          return;
        }
        const objType = match[1];
        bodySize = Number(match[2]);
        remainingToRead = bodySize + 1;
        discard = objType !== 'blob' || bodySize > maxBytes;
        phase = 'body';
      }

      if (phase === 'body') {
        if (discard) {
          remainingToRead -= discardFromBuffer(remainingToRead);
          if (remainingToRead <= 0) {
            finishRead(undefined, false);
            return;
          }
          if (childExited) finishRead(undefined, true);
          return;
        }
        if (totalBuffered >= remainingToRead) {
          const payload = consumeBytes(remainingToRead);
          const body = payload.subarray(0, bodySize);
          if (body.includes(0)) {
            finishRead(undefined, false);
            return;
          }
          finishRead(body.toString('utf8'), false);
          return;
        }
        if (childExited) finishRead(undefined, true);
      }
    };

    try {
      child.stdin.write(spec + '\\n');
    } catch {
      finishRead(undefined, true);
    }
  }
});

port.postMessage({ type: 'init', pid: child.pid ?? null });
notifyWaiter(initLock, 1);
`;
function isRegularGitMode(mode) {
    return mode === '100644' || mode === '100755';
}
export class GitTreeReader {
    root;
    commitSha;
    maxBytes;
    regularFiles;
    blobShas;
    nonRegularPaths;
    blobCache;
    worker;
    port;
    lock;
    closed;
    exitHandler;
    constructor(root, commitSha, maxBytes = MAX_FILE_BYTES) {
        if (!commitSha || commitSha.startsWith('-') || /[\0\r\n\s]/.test(commitSha)) {
            throw new Error(`Invalid commit ref for GitTreeReader: ${JSON.stringify(commitSha)}`);
        }
        this.root = root;
        this.commitSha = commitSha;
        this.maxBytes = maxBytes;
        this.blobCache = new Map();
        this.closed = false;
    }
    listFiles() {
        this.ensureTreeLoaded();
        return this.regularFiles;
    }
    hasFile(relPath) {
        const norm = normalizeSafeRepoPath(relPath);
        if (!norm)
            return false;
        this.ensureTreeLoaded();
        if (this.hasNonRegularPrefix(norm))
            return false;
        return this.blobShas.has(norm);
    }
    /** True if `relPath` exists in the tree as a symlink (`120000`) or submodule (`160000`). */
    isNonRegularEntry(relPath) {
        const norm = normalizeSafeRepoPath(relPath);
        if (!norm)
            return false;
        this.ensureTreeLoaded();
        return this.nonRegularPaths.has(norm);
    }
    readText(relPath, maxBytes = this.maxBytes) {
        if (this.closed) {
            throw new Error(`Cannot read "${relPath}" after GitTreeReader has been closed`);
        }
        const norm = normalizeSafeRepoPath(relPath);
        if (!norm)
            return undefined;
        this.ensureTreeLoaded();
        if (this.hasNonRegularPrefix(norm))
            return undefined;
        const blobSha = this.blobShas.get(norm);
        if (!blobSha)
            return undefined;
        const cacheKey = `${blobSha}:${maxBytes}`;
        if (this.blobCache.has(cacheKey)) {
            return this.blobCache.get(cacheKey);
        }
        this.ensureWorkerOpen();
        if (!this.port || !this.lock) {
            throw new Error(`Failed to initialize git cat-file --batch worker for ${this.commitSha}`);
        }
        try {
            Atomics.store(this.lock, 0, 0);
            this.port.postMessage({
                type: 'read',
                spec: blobSha,
                maxBytes,
                lock: this.lock,
            });
            const waitRes = Atomics.wait(this.lock, 0, 0, CAT_FILE_TIMEOUT_MS);
            if (waitRes === 'timed-out') {
                this.closeWorkerInternal();
                throw new Error(`Timed out reading ${this.commitSha}:${norm} from git cat-file --batch`);
            }
            const msg = receiveMessageOnPort(this.port)?.message;
            if (!msg || msg.dead) {
                this.closeWorkerInternal();
                const detail = msg?.stderr?.trim();
                throw new Error(`git cat-file --batch exited unexpectedly while reading ${this.commitSha}:${norm}${detail ? `: ${detail}` : ''}`);
            }
            this.blobCache.set(cacheKey, msg.content);
            return msg.content;
        }
        catch (err) {
            this.closeWorkerInternal();
            throw err;
        }
    }
    close() {
        this.closed = true;
        this.closeWorkerInternal();
    }
    ensureTreeLoaded() {
        if (this.regularFiles !== undefined)
            return;
        const raw = git(this.root, ['ls-tree', '-r', '-z', '--end-of-options', this.commitSha]);
        const regular = [];
        const shas = new Map();
        const nonRegular = new Set();
        for (const record of raw.split('\0')) {
            if (!record)
                continue;
            const tabIdx = record.indexOf('\t');
            if (tabIdx <= 0)
                continue;
            const header = record.slice(0, tabIdx);
            const rawPath = record.slice(tabIdx + 1);
            const norm = normalizeSafeRepoPath(rawPath);
            if (!norm)
                continue;
            const parts = header.trim().split(/\s+/);
            const mode = parts[0] ?? '';
            const sha = parts[2] ?? '';
            if (isRegularGitMode(mode) && /^[0-9a-f]{40,64}$/.test(sha)) {
                regular.push(norm);
                shas.set(norm, sha);
            }
            else {
                nonRegular.add(norm);
            }
        }
        // Filter out any path that sits beneath a symlink or non-regular prefix.
        this.nonRegularPaths = nonRegular;
        this.regularFiles = regular.filter((p) => !this.hasNonRegularPrefixInSet(p, nonRegular));
        this.blobShas = new Map();
        for (const p of this.regularFiles) {
            const sha = shas.get(p);
            if (sha)
                this.blobShas.set(p, sha);
        }
    }
    hasNonRegularPrefix(normPath) {
        return this.hasNonRegularPrefixInSet(normPath, this.nonRegularPaths);
    }
    hasNonRegularPrefixInSet(normPath, nonRegular) {
        if (nonRegular.size === 0)
            return false;
        if (nonRegular.has(normPath))
            return true;
        const parts = normPath.split('/');
        let prefix = '';
        for (let i = 0; i < parts.length - 1; i++) {
            prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
            if (nonRegular.has(prefix))
                return true;
        }
        return false;
    }
    ensureWorkerOpen() {
        if (this.worker)
            return;
        const channel = new MessageChannel();
        const sab = new SharedArrayBuffer(4);
        const syncLock = new Int32Array(sab);
        Atomics.store(syncLock, 0, 0);
        const w = new Worker(CAT_FILE_WORKER_SCRIPT, {
            eval: true,
            workerData: {
                root: this.root,
                port: channel.port2,
                initLock: syncLock,
            },
            transferList: [channel.port2],
        });
        w.unref();
        channel.port1.unref();
        this.worker = w;
        this.port = channel.port1;
        this.lock = syncLock;
        Atomics.wait(syncLock, 0, 0, 5000);
        receiveMessageOnPort(channel.port1);
        if (!this.exitHandler) {
            this.exitHandler = () => this.closeWorkerInternal();
            process.once('exit', this.exitHandler);
        }
    }
    closeWorkerInternal() {
        if (this.exitHandler) {
            process.removeListener('exit', this.exitHandler);
            this.exitHandler = undefined;
        }
        const activeWorker = this.worker;
        const activePort = this.port;
        const activeLock = this.lock;
        this.worker = undefined;
        this.port = undefined;
        this.lock = undefined;
        if (!activeWorker || !activePort || !activeLock)
            return;
        try {
            Atomics.store(activeLock, 0, 0);
            activePort.postMessage({ type: 'close', lock: activeLock });
            Atomics.wait(activeLock, 0, 0, 2000);
            while (receiveMessageOnPort(activePort) !== undefined) {
                // drain
            }
        }
        catch {
            // ignore if worker already exited
        }
        finally {
            try {
                activePort.close();
            }
            catch { }
            void activeWorker.terminate();
        }
    }
}
