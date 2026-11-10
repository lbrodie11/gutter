import { isAbsolute } from 'node:path';
import type { SourceReader } from './source/reader.ts';

export interface GutterConfig {
  maxForgotten?: number;
  maxChecklist?: number;
  maxCompanionQuestions?: number;
  minIntervalLow?: number;
  minCalibratedPrecision?: number;
  minChurnForTestQuestion?: number;
  wideSurfaceImporters?: number;
  /**
   * Independent signals a brief needs before it is `full` (default 1). Each high-signal
   * question (priority <= 2) counts once; breadth (>= 8 files or >= 3 modules) counts once.
   */
  salienceFullMinSignals?: number;
  /** When false, breadth alone never makes a brief `full` (default true). */
  salienceBreadthFull?: boolean;
  noHistory?: boolean;
  noCalibration?: boolean;
}

export interface SafeRaOriginWeights {
  human?: number;
  agent?: number;
  bot?: number;
}

export interface SafeRaOriginConfig {
  agentAuthorPatterns?: string[];
  botPatterns?: string[];
  agentTrailerPatterns?: string[];
  replaceDefaults?: boolean;
  weights?: SafeRaOriginWeights;
}

export interface SafeRaOwnersConfig {
  enabled?: boolean;
  max?: number;
  lookbackDays?: number;
  maxCommits?: number;
}

export interface SafeRaRepoConfig {
  maxCommits?: number;
  maxFilesPerCommit?: number;
  minShared?: number;
  minConfidence?: number;
  halfLifeDays?: number;
  since?: string;
  ignore?: string[];
  useDefaultIgnores?: boolean;
  skipCommits?: string;
  skipCommitPrefixes?: string[];
  origin?: SafeRaOriginConfig;
  style?: 'classic' | 'rich';
  cache?: { enabled?: boolean; dir?: string };
  owners?: SafeRaOwnersConfig;
}

const MAX_RA_CONFIG_BYTES = 64 * 1024;
const CONFIG_MAX_FILES_PER_COMMIT = 1000;
const MAX_ORIGIN_PATTERN_LENGTH = 200;
const MAX_OWNERS_PER_SUGGESTION = 5;
const MAX_OWNERS_LOOKBACK_DAYS = 3650;
const MAX_OWNERS_COMMITS = 1000;

const KNOWN_RA_CONFIG_KEYS = new Set([
  'maxCommits',
  'maxFilesPerCommit',
  'minShared',
  'minConfidence',
  'ignore',
  'useDefaultIgnores',
  'since',
  'halfLifeDays',
  'skipCommits',
  'skipCommitPrefixes',
  'origin',
  'style',
  'cache',
  'owners',
]);

/**
 * Matches `repo-archaeology` `riskySkipPattern` (`dist/model/origin.js`):
 * rejects regexes > 200 chars, backreferences, quantified groups containing a quantifier
 * or alternation, or > 6 repetition quantifiers.
 */
export function riskyRaSkipPattern(pattern: string): string | undefined {
  if (pattern.length > MAX_ORIGIN_PATTERN_LENGTH) {
    return `is longer than ${MAX_ORIGIN_PATTERN_LENGTH} characters`;
  }
  if (/\\(?:[1-9]|k<)/.test(pattern)) {
    return 'uses a backreference';
  }
  const clean = pattern.replace(/\\./g, 'xx');
  const masked = clean.replace(/\[[^\]]*\]/g, (m) => 'x'.repeat(m.length));
  const normalized = masked.replace(/\(\?(?:<[^>()!]+>|[a-zA-Z-]*:)/g, (m) => '(' + 'x'.repeat(m.length - 1));
  let quantifierCount = 0;
  const stack: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '*' || ch === '+' || ch === '{') {
      quantifierCount++;
    } else if (
      ch === '?' &&
      normalized[i - 1] !== '(' &&
      normalized[i - 1] !== '*' &&
      normalized[i - 1] !== '+' &&
      normalized[i - 1] !== '?' &&
      normalized[i - 1] !== '}'
    ) {
      quantifierCount++;
    }
    if (ch === '(') {
      stack.push(i);
    } else if (ch === ')' && stack.length > 0) {
      const start = stack.pop()!;
      const quantified = /^(?:[*+]|\{\d*,?\d*\})/.test(normalized.slice(i + 1));
      if (quantified && /(?:[*+?|]|\{\d*,?\d*\})/.test(normalized.slice(start + 1, i))) {
        return 'repeats a group that contains a quantifier or alternation, which can hang on some commit messages';
      }
    }
  }
  if (quantifierCount > 6) {
    return 'has too many repetition quantifiers (*, +, ?, {n,m})';
  }
  return undefined;
}

/**
 * Matches `repo-archaeology` `compileSkipPattern` (`dist/config.js`).
 */
export function compileRaSkipPattern(
  pattern?: string,
  prefixes?: string[],
): RegExp | undefined {
  const parts: string[] = [];
  if (prefixes && prefixes.length > 0) {
    const escaped = prefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    parts.push(`^(?:${escaped})(?:\\b|[:\\s_-])`);
  }
  if (pattern !== undefined && pattern !== '') {
    parts.push(`(?:${pattern})`);
  }
  if (parts.length === 0) return undefined;
  return new RegExp(parts.join('|'), 'i');
}

function isSafeRepoRelativeCacheDir(dir: unknown, reader?: SourceReader): dir is string {
  if (typeof dir !== 'string') return false;
  if (dir.trim() === '' || dir.includes('\0')) return false;
  if (isAbsolute(dir) || /^[\\/]|^[A-Za-z]:/.test(dir) || dir.split(/[\\/]/).includes('..')) {
    return false;
  }
  const parts = dir.split(/[\\/]+/).filter((p) => p !== '' && p !== '.');
  if (parts.length === 0) return false;
  if (reader?.isNonRegularEntry) {
    let cur = '';
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (reader.isNonRegularEntry(cur)) return false;
    }
  }
  return true;
}

function validateOriginConfig(raw: unknown): SafeRaOriginConfig | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const knownKeys = new Set([
    'agentAuthorPatterns',
    'botPatterns',
    'agentTrailerPatterns',
    'replaceDefaults',
    'weights',
  ]);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) return undefined;
  }
  const out: SafeRaOriginConfig = {};
  const validatePatternList = (field: 'agentAuthorPatterns' | 'botPatterns' | 'agentTrailerPatterns'): boolean => {
    const val = obj[field];
    if (val === undefined) return true;
    if (!Array.isArray(val)) return false;
    const list: string[] = [];
    for (const item of val) {
      if (typeof item !== 'string' || item.length === 0 || item.length > MAX_ORIGIN_PATTERN_LENGTH) {
        return false;
      }
      try {
        new RegExp(item, 'i');
      } catch {
        return false;
      }
      if (riskyRaSkipPattern(item)) return false;
      list.push(item);
    }
    out[field] = list;
    return true;
  };
  if (!validatePatternList('agentAuthorPatterns')) return undefined;
  if (!validatePatternList('botPatterns')) return undefined;
  if (!validatePatternList('agentTrailerPatterns')) return undefined;

  if (obj.replaceDefaults !== undefined) {
    if (typeof obj.replaceDefaults !== 'boolean') return undefined;
    out.replaceDefaults = obj.replaceDefaults;
  }
  if (obj.weights !== undefined) {
    if (typeof obj.weights !== 'object' || obj.weights === null || Array.isArray(obj.weights)) {
      return undefined;
    }
    const wObj = obj.weights as Record<string, unknown>;
    const knownWeightKeys = new Set(['human', 'agent', 'bot']);
    for (const key of Object.keys(wObj)) {
      if (!knownWeightKeys.has(key)) return undefined;
    }
    const weights: SafeRaOriginWeights = {};
    for (const key of ['human', 'agent', 'bot'] as const) {
      const v = wObj[key];
      if (v === undefined) continue;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) return undefined;
      weights[key] = v;
    }
    out.weights = weights;
  }
  return out;
}

function validateOwnersConfig(raw: unknown): SafeRaOwnersConfig | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const knownKeys = new Set(['enabled', 'max', 'lookbackDays', 'maxCommits']);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) return undefined;
  }
  const out: SafeRaOwnersConfig = {};
  if (obj.enabled !== undefined) {
    if (typeof obj.enabled !== 'boolean') return undefined;
    out.enabled = obj.enabled;
  }
  const boundedInt = (
    field: 'max' | 'lookbackDays' | 'maxCommits',
    min: number,
    max: number,
  ): boolean => {
    const val = obj[field];
    if (val === undefined) return true;
    if (typeof val !== 'number' || !Number.isInteger(val) || val < min || val > max) return false;
    out[field] = val;
    return true;
  };
  if (!boundedInt('max', 1, MAX_OWNERS_PER_SUGGESTION)) return undefined;
  if (!boundedInt('lookbackDays', 1, MAX_OWNERS_LOOKBACK_DAYS)) return undefined;
  if (!boundedInt('maxCommits', 1, MAX_OWNERS_COMMITS)) return undefined;
  return out;
}

/**
 * Validate a repository's `.repo-archaeology.json` text using the exact schema and
 * safety contract of `repo-archaeology`'s `parseConfigText` + `validatePartial` (`dist/config.js`).
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
      raw.maxFilesPerCommit < 2 ||
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
      Number.isNaN(raw.minConfidence) ||
      raw.minConfidence < 0 ||
      raw.minConfidence > 1
    ) {
      return { valid: false, config: undefined };
    }
    out.minConfidence = raw.minConfidence;
  }
  if (raw.halfLifeDays !== undefined) {
    if (typeof raw.halfLifeDays !== 'number' || !(raw.halfLifeDays > 0)) {
      return { valid: false, config: undefined };
    }
    out.halfLifeDays = raw.halfLifeDays;
  }
  if (raw.since !== undefined) {
    if (typeof raw.since !== 'string' || raw.since.trim() === '') {
      return { valid: false, config: undefined };
    }
    out.since = raw.since;
  }
  if (raw.skipCommits !== undefined) {
    if (typeof raw.skipCommits !== 'string') {
      return { valid: false, config: undefined };
    }
    try {
      compileRaSkipPattern(raw.skipCommits);
    } catch {
      return { valid: false, config: undefined };
    }
    if (riskyRaSkipPattern(raw.skipCommits)) {
      return { valid: false, config: undefined };
    }
    out.skipCommits = raw.skipCommits;
  }
  if (raw.skipCommitPrefixes !== undefined) {
    if (
      !Array.isArray(raw.skipCommitPrefixes) ||
      raw.skipCommitPrefixes.some((p) => typeof p !== 'string' || p.trim() === '')
    ) {
      return { valid: false, config: undefined };
    }
    out.skipCommitPrefixes = [...raw.skipCommitPrefixes];
  }
  if (out.skipCommits !== undefined || out.skipCommitPrefixes !== undefined) {
    try {
      compileRaSkipPattern(out.skipCommits, out.skipCommitPrefixes);
    } catch {
      return { valid: false, config: undefined };
    }
  }
  if (raw.ignore !== undefined) {
    if (!Array.isArray(raw.ignore) || raw.ignore.some((x) => typeof x !== 'string')) {
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
  if (raw.origin !== undefined) {
    const validatedOrigin = validateOriginConfig(raw.origin);
    if (!validatedOrigin) return { valid: false, config: undefined };
    out.origin = validatedOrigin;
  }
  if (raw.style !== undefined) {
    if (raw.style === 'classic' || raw.style === 'rich') {
      out.style = raw.style;
    }
  }
  if (raw.cache !== undefined) {
    if (!raw.cache || typeof raw.cache !== 'object' || Array.isArray(raw.cache)) {
      return { valid: false, config: undefined };
    }
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
      cleanCache.dir = cacheObj.dir;
    }
    out.cache = cleanCache;
  }
  if (raw.owners !== undefined) {
    const validatedOwners = validateOwnersConfig(raw.owners);
    if (!validatedOwners) return { valid: false, config: undefined };
    out.owners = validatedOwners;
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
  if (
    typeof obj.salienceFullMinSignals === 'number' &&
    Number.isFinite(obj.salienceFullMinSignals) &&
    obj.salienceFullMinSignals >= 1
  ) {
    out.salienceFullMinSignals = Math.floor(obj.salienceFullMinSignals);
  }
  if (typeof obj.salienceBreadthFull === 'boolean') {
    out.salienceBreadthFull = obj.salienceBreadthFull;
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
  /**
   * True iff `.repo-archaeology.json` exists as a regular file in the snapshot
   * and passes `validateRaRepoConfig`. False when absent, a symlink, > 64 KB, or invalid,
   * so `openRepository({ useConfigFile: raConfigValid })` never falls back to the working tree.
   */
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
  let raConfigValid = false;
  if (!reader.isNonRegularEntry?.('.repo-archaeology.json')) {
    const raRaw = reader.readText('.repo-archaeology.json', MAX_RA_CONFIG_BYTES + 1);
    if (raRaw !== undefined) {
      const validated = validateRaRepoConfig(raRaw, reader);
      raConfigValid = validated.valid;
      raSettings = validated.config;
    }
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
