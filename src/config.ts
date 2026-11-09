import { posix, win32 } from 'node:path';
import type { SourceReader } from './source/reader.ts';

export interface GutterConfig {
  maxForgotten?: number;
  maxChecklist?: number;
  maxCompanionQuestions?: number;
  minIntervalLow?: number;
  minCalibratedPrecision?: number;
  minChurnForTestQuestion?: number;
  wideSurfaceImporters?: number;
  noHistory?: boolean;
  noCalibration?: boolean;
}

export interface SafeRaRepoConfig {
  schemaVersion?: 1;
  maxCommits?: number;
  maxFilesPerCommit?: number;
  minShared?: number;
  minConfidence?: number;
  limit?: number;
  since?: string;
  ignore?: string[];
  useDefaultIgnores?: boolean;
  kinds?: string[];
  skipCommits?: string[];
  skipCommitPrefixes?: string[];
  cache?: boolean | { enabled?: boolean; dir?: string };
}

const MAX_RA_CONFIG_BYTES = 64 * 1024;
const CONFIG_MAX_FILES_PER_COMMIT = 1000;

const KNOWN_RA_CONFIG_KEYS = new Set([
  'maxCommits',
  'maxFilesPerCommit',
  'minShared',
  'minConfidence',
  'limit',
  'since',
  'ignore',
  'useDefaultIgnores',
  'kinds',
  'skipCommits',
  'skipCommitPrefixes',
  'cache',
  'schemaVersion',
]);

const VALID_RA_KINDS = new Set(['test', 'docs', 'config', 'schema', 'types', 'code']);

function isSafeRepoRelativeCacheDir(dir: unknown, reader?: SourceReader): dir is string {
  if (typeof dir !== 'string') return false;
  const trimmed = dir.trim();
  if (!trimmed || trimmed.includes('\0')) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
  if (/^[a-zA-Z]:/.test(trimmed)) return false;
  if (posix.isAbsolute(trimmed) || win32.isAbsolute(trimmed)) return false;
  const parts = trimmed.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.some((p) => p === '..' || p === '.')) return false;
  if (reader?.isNonRegularEntry) {
    let cur = '';
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (reader.isNonRegularEntry(cur)) return false;
    }
  }
  return true;
}

/**
 * Validate a repository's `.repo-archaeology.json` text using the same safety bounds
 * as `repo-archaeology`'s `parseConfigText` + `parseCacheConfig(..., 'file')`.
 * Any invalid or unsafe field rejects the entire config object so untrusted repo
 * configs are never treated as trusted API flags or allowed to escape the repo.
 */
export function validateRaRepoConfig(
  rawText: string,
  reader?: SourceReader,
): { valid: boolean; config: SafeRaRepoConfig | undefined } {
  if (Buffer.byteLength(rawText, 'utf8') > MAX_RA_CONFIG_BYTES) {
    return { valid: false, config: undefined };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { valid: false, config: undefined };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, config: undefined };
  }
  const raw = parsed as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!KNOWN_RA_CONFIG_KEYS.has(key)) {
      return { valid: false, config: undefined };
    }
  }

  const out: SafeRaRepoConfig = {};
  if (raw.schemaVersion !== undefined) {
    if (raw.schemaVersion !== 1) return { valid: false, config: undefined };
    out.schemaVersion = 1;
  }
  if (raw.maxCommits !== undefined) {
    if (typeof raw.maxCommits !== 'number' || !Number.isInteger(raw.maxCommits) || raw.maxCommits < 1) {
      return { valid: false, config: undefined };
    }
    out.maxCommits = raw.maxCommits;
  }
  if (raw.maxFilesPerCommit !== undefined) {
    if (
      typeof raw.maxFilesPerCommit !== 'number' ||
      !Number.isInteger(raw.maxFilesPerCommit) ||
      raw.maxFilesPerCommit < 1 ||
      raw.maxFilesPerCommit > CONFIG_MAX_FILES_PER_COMMIT
    ) {
      return { valid: false, config: undefined };
    }
    out.maxFilesPerCommit = raw.maxFilesPerCommit;
  }
  if (raw.minShared !== undefined) {
    if (typeof raw.minShared !== 'number' || !Number.isInteger(raw.minShared) || raw.minShared < 1) {
      return { valid: false, config: undefined };
    }
    out.minShared = raw.minShared;
  }
  if (raw.minConfidence !== undefined) {
    if (
      typeof raw.minConfidence !== 'number' ||
      !Number.isFinite(raw.minConfidence) ||
      raw.minConfidence < 0 ||
      raw.minConfidence > 1
    ) {
      return { valid: false, config: undefined };
    }
    out.minConfidence = raw.minConfidence;
  }
  if (raw.limit !== undefined) {
    if (typeof raw.limit !== 'number' || !Number.isInteger(raw.limit) || raw.limit < 1) {
      return { valid: false, config: undefined };
    }
    out.limit = raw.limit;
  }
  if (raw.since !== undefined) {
    if (typeof raw.since !== 'string' || !raw.since.trim() || raw.since.trim().startsWith('-')) {
      return { valid: false, config: undefined };
    }
    out.since = raw.since.trim();
  }
  if (raw.ignore !== undefined) {
    if (!Array.isArray(raw.ignore) || !raw.ignore.every((x) => typeof x === 'string')) {
      return { valid: false, config: undefined };
    }
    out.ignore = [...raw.ignore];
  }
  if (raw.useDefaultIgnores !== undefined) {
    if (typeof raw.useDefaultIgnores !== 'boolean') {
      return { valid: false, config: undefined };
    }
    out.useDefaultIgnores = raw.useDefaultIgnores;
  }
  if (raw.kinds !== undefined) {
    if (!Array.isArray(raw.kinds) || !raw.kinds.every((x) => typeof x === 'string' && VALID_RA_KINDS.has(x))) {
      return { valid: false, config: undefined };
    }
    out.kinds = [...raw.kinds];
  }
  if (raw.skipCommits !== undefined) {
    if (
      !Array.isArray(raw.skipCommits) ||
      !raw.skipCommits.every((x) => typeof x === 'string' && /^[0-9a-fA-F]{4,64}$/.test(x.trim()))
    ) {
      return { valid: false, config: undefined };
    }
    out.skipCommits = raw.skipCommits.map((x) => x.trim());
  }
  if (raw.skipCommitPrefixes !== undefined) {
    if (
      !Array.isArray(raw.skipCommitPrefixes) ||
      !raw.skipCommitPrefixes.every(
        (x) => typeof x === 'string' && x.trim().length >= 3 && !/^(merge|revert)$/i.test(x.trim()),
      )
    ) {
      return { valid: false, config: undefined };
    }
    out.skipCommitPrefixes = raw.skipCommitPrefixes.map((x) => x.trim());
  }
  if (raw.cache !== undefined) {
    if (typeof raw.cache === 'boolean') {
      out.cache = raw.cache;
    } else if (raw.cache && typeof raw.cache === 'object' && !Array.isArray(raw.cache)) {
      const cacheObj = raw.cache as Record<string, unknown>;
      for (const k of Object.keys(cacheObj)) {
        if (k !== 'enabled' && k !== 'dir') return { valid: false, config: undefined };
      }
      const cleanCache: { enabled?: boolean; dir?: string } = {};
      if (cacheObj.enabled !== undefined) {
        if (typeof cacheObj.enabled !== 'boolean') return { valid: false, config: undefined };
        cleanCache.enabled = cacheObj.enabled;
      }
      if (cacheObj.dir !== undefined) {
        if (!isSafeRepoRelativeCacheDir(cacheObj.dir, reader)) return { valid: false, config: undefined };
        cleanCache.dir = cacheObj.dir.trim();
      }
      out.cache = cleanCache;
    } else {
      return { valid: false, config: undefined };
    }
  }

  return { valid: true, config: out };
}

export function parseGutterConfigObject(raw: unknown): GutterConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: GutterConfig = {};
  if (typeof obj.maxForgotten === 'number' && Number.isFinite(obj.maxForgotten) && obj.maxForgotten >= 0) {
    out.maxForgotten = Math.floor(obj.maxForgotten);
  }
  if (typeof obj.maxChecklist === 'number' && Number.isFinite(obj.maxChecklist) && obj.maxChecklist >= 0) {
    out.maxChecklist = Math.floor(obj.maxChecklist);
  }
  if (
    typeof obj.maxCompanionQuestions === 'number' &&
    Number.isFinite(obj.maxCompanionQuestions) &&
    obj.maxCompanionQuestions >= 0
  ) {
    out.maxCompanionQuestions = Math.floor(obj.maxCompanionQuestions);
  }
  if (
    typeof obj.minIntervalLow === 'number' &&
    Number.isFinite(obj.minIntervalLow) &&
    obj.minIntervalLow >= 0 &&
    obj.minIntervalLow <= 1
  ) {
    out.minIntervalLow = obj.minIntervalLow;
  }
  if (
    typeof obj.minCalibratedPrecision === 'number' &&
    Number.isFinite(obj.minCalibratedPrecision) &&
    obj.minCalibratedPrecision >= 0 &&
    obj.minCalibratedPrecision <= 1
  ) {
    out.minCalibratedPrecision = obj.minCalibratedPrecision;
  }
  if (
    typeof obj.minChurnForTestQuestion === 'number' &&
    Number.isFinite(obj.minChurnForTestQuestion) &&
    obj.minChurnForTestQuestion >= 0
  ) {
    out.minChurnForTestQuestion = Math.floor(obj.minChurnForTestQuestion);
  }
  if (
    typeof obj.wideSurfaceImporters === 'number' &&
    Number.isFinite(obj.wideSurfaceImporters) &&
    obj.wideSurfaceImporters >= 1
  ) {
    out.wideSurfaceImporters = Math.floor(obj.wideSurfaceImporters);
  }
  if (typeof obj.noHistory === 'boolean') {
    out.noHistory = obj.noHistory;
  }
  if (typeof obj.noCalibration === 'boolean') {
    out.noCalibration = obj.noCalibration;
  }
  return out;
}

/** Read `.gutter.json` through the given snapshot reader (`head` tree or working tree). */
export function readGutterConfig(reader: SourceReader): GutterConfig {
  const text = reader.readText('.gutter.json');
  if (text === undefined) return {};
  try {
    return parseGutterConfigObject(JSON.parse(text));
  } catch {
    return {};
  }
}

export interface SnapshotAuxConfigs {
  gutterConfig: GutterConfig;
  raSettings: SafeRaRepoConfig | undefined;
  raConfigValid: boolean;
  hasVerdicts: boolean;
  codeownersPath: string | undefined;
}

const CODEOWNERS_CANDIDATES = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];

/**
 * Read `.gutter.json`, `.repo-archaeology.json`, `.repo-archaeology.verdicts.json`,
 * and `CODEOWNERS` at `head` through the `SourceReader`.
 */
export function readSnapshotAuxConfigs(reader: SourceReader): SnapshotAuxConfigs {
  const gutterConfig = readGutterConfig(reader);
  let raSettings: SafeRaRepoConfig | undefined;
  let raConfigValid = true;
  const raRaw = reader.readText('.repo-archaeology.json');
  if (raRaw !== undefined) {
    const validated = validateRaRepoConfig(raRaw, reader);
    raConfigValid = validated.valid;
    raSettings = validated.config;
  }
  const hasVerdicts = reader.readText('.repo-archaeology.verdicts.json') !== undefined;
  let codeownersPath: string | undefined;
  for (const candidate of CODEOWNERS_CANDIDATES) {
    if (reader.readText(candidate) !== undefined) {
      codeownersPath = candidate;
      break;
    }
  }
  return { gutterConfig, raSettings, raConfigValid, hasVerdicts, codeownersPath };
}
