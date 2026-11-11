import { isAbsolute } from 'node:path';
/** Keys that only change anything under `legacyPredictions` (GU-29): they tune the retired companion questions. */
export const LEGACY_ONLY_KEYS = [
    'maxCompanionQuestions',
    'minIntervalLow',
    'minCalibratedPrecision',
    'companionRequireGhost',
    'companionMinTrackRecordFired',
];
/** Legacy-only keys that are set while `legacyPredictions` is off, so they have no effect. */
export function inertLegacyKeys(config) {
    if (!config || config.legacyPredictions)
        return [];
    return LEGACY_ONLY_KEYS.filter((k) => config[k] !== undefined);
}
export function inertLegacyWarning(keys) {
    return `${keys.join(', ')} only appl${keys.length === 1 ? 'ies' : 'y'} with "legacyPredictions": true (GU-29, DECISIONS #17); ignored.`;
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
    'skipReverts',
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
export function riskyRaSkipPattern(pattern) {
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
    const stack = [];
    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (ch === '*' || ch === '+' || ch === '{') {
            quantifierCount++;
        }
        else if (ch === '?' &&
            normalized[i - 1] !== '(' &&
            normalized[i - 1] !== '*' &&
            normalized[i - 1] !== '+' &&
            normalized[i - 1] !== '?' &&
            normalized[i - 1] !== '}') {
            quantifierCount++;
        }
        if (ch === '(') {
            stack.push(i);
        }
        else if (ch === ')' && stack.length > 0) {
            const start = stack.pop();
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
export function compileRaSkipPattern(pattern, prefixes) {
    const parts = [];
    if (prefixes && prefixes.length > 0) {
        const escaped = prefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        parts.push(`^(?:${escaped})(?:\\b|[:\\s_-])`);
    }
    if (pattern !== undefined && pattern !== '') {
        parts.push(`(?:${pattern})`);
    }
    if (parts.length === 0)
        return undefined;
    return new RegExp(parts.join('|'), 'i');
}
function isSafeRepoRelativeCacheDir(dir, reader) {
    if (typeof dir !== 'string')
        return false;
    if (dir.trim() === '' || dir.includes('\0'))
        return false;
    if (isAbsolute(dir) || /^[\\/]|^[A-Za-z]:/.test(dir) || dir.split(/[\\/]/).includes('..')) {
        return false;
    }
    const parts = dir.split(/[\\/]+/).filter((p) => p !== '' && p !== '.');
    if (parts.length === 0)
        return false;
    if (reader?.isNonRegularEntry) {
        let cur = '';
        for (const part of parts) {
            cur = cur ? `${cur}/${part}` : part;
            if (reader.isNonRegularEntry(cur))
                return false;
        }
    }
    return true;
}
function validateOriginConfig(raw) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
        return undefined;
    const obj = raw;
    const knownKeys = new Set([
        'agentAuthorPatterns',
        'botPatterns',
        'agentTrailerPatterns',
        'replaceDefaults',
        'weights',
    ]);
    for (const key of Object.keys(obj)) {
        if (!knownKeys.has(key))
            return undefined;
    }
    const out = {};
    const validatePatternList = (field) => {
        const val = obj[field];
        if (val === undefined)
            return true;
        if (!Array.isArray(val))
            return false;
        const list = [];
        for (const item of val) {
            if (typeof item !== 'string' || item.length === 0 || item.length > MAX_ORIGIN_PATTERN_LENGTH) {
                return false;
            }
            try {
                new RegExp(item, 'i');
            }
            catch {
                return false;
            }
            if (riskyRaSkipPattern(item))
                return false;
            list.push(item);
        }
        out[field] = list;
        return true;
    };
    if (!validatePatternList('agentAuthorPatterns'))
        return undefined;
    if (!validatePatternList('botPatterns'))
        return undefined;
    if (!validatePatternList('agentTrailerPatterns'))
        return undefined;
    if (obj.replaceDefaults !== undefined) {
        if (typeof obj.replaceDefaults !== 'boolean')
            return undefined;
        out.replaceDefaults = obj.replaceDefaults;
    }
    if (obj.weights !== undefined) {
        if (typeof obj.weights !== 'object' || obj.weights === null || Array.isArray(obj.weights)) {
            return undefined;
        }
        const wObj = obj.weights;
        const knownWeightKeys = new Set(['human', 'agent', 'bot']);
        for (const key of Object.keys(wObj)) {
            if (!knownWeightKeys.has(key))
                return undefined;
        }
        const weights = {};
        for (const key of ['human', 'agent', 'bot']) {
            const v = wObj[key];
            if (v === undefined)
                continue;
            if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)
                return undefined;
            weights[key] = v;
        }
        out.weights = weights;
    }
    return out;
}
function validateOwnersConfig(raw) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
        return undefined;
    const obj = raw;
    const knownKeys = new Set(['enabled', 'max', 'lookbackDays', 'maxCommits']);
    for (const key of Object.keys(obj)) {
        if (!knownKeys.has(key))
            return undefined;
    }
    const out = {};
    if (obj.enabled !== undefined) {
        if (typeof obj.enabled !== 'boolean')
            return undefined;
        out.enabled = obj.enabled;
    }
    const boundedInt = (field, min, max) => {
        const val = obj[field];
        if (val === undefined)
            return true;
        if (typeof val !== 'number' || !Number.isInteger(val) || val < min || val > max)
            return false;
        out[field] = val;
        return true;
    };
    if (!boundedInt('max', 1, MAX_OWNERS_PER_SUGGESTION))
        return undefined;
    if (!boundedInt('lookbackDays', 1, MAX_OWNERS_LOOKBACK_DAYS))
        return undefined;
    if (!boundedInt('maxCommits', 1, MAX_OWNERS_COMMITS))
        return undefined;
    return out;
}
/**
 * Validate a repository's `.repo-archaeology.json` text using the exact schema and
 * safety contract of `repo-archaeology`'s `parseConfigText` + `validatePartial` (`dist/config.js`).
 */
export function validateRaRepoConfig(rawText, reader) {
    if (Buffer.byteLength(rawText, 'utf8') > MAX_RA_CONFIG_BYTES) {
        return { valid: false, config: undefined };
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    }
    catch {
        return { valid: false, config: undefined };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, config: undefined };
    }
    const raw = parsed;
    for (const key of Object.keys(raw)) {
        if (!KNOWN_RA_CONFIG_KEYS.has(key)) {
            return { valid: false, config: undefined };
        }
    }
    const out = {};
    if (raw.maxCommits !== undefined) {
        if (typeof raw.maxCommits !== 'number' || !Number.isInteger(raw.maxCommits) || raw.maxCommits < 1) {
            return { valid: false, config: undefined };
        }
        out.maxCommits = raw.maxCommits;
    }
    if (raw.maxFilesPerCommit !== undefined) {
        if (typeof raw.maxFilesPerCommit !== 'number' ||
            !Number.isInteger(raw.maxFilesPerCommit) ||
            raw.maxFilesPerCommit < 2 ||
            raw.maxFilesPerCommit > CONFIG_MAX_FILES_PER_COMMIT) {
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
        if (typeof raw.minConfidence !== 'number' ||
            Number.isNaN(raw.minConfidence) ||
            raw.minConfidence < 0 ||
            raw.minConfidence > 1) {
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
        }
        catch {
            return { valid: false, config: undefined };
        }
        if (riskyRaSkipPattern(raw.skipCommits)) {
            return { valid: false, config: undefined };
        }
        out.skipCommits = raw.skipCommits;
    }
    if (raw.skipCommitPrefixes !== undefined) {
        if (!Array.isArray(raw.skipCommitPrefixes) ||
            raw.skipCommitPrefixes.some((p) => typeof p !== 'string' || p.trim() === '')) {
            return { valid: false, config: undefined };
        }
        out.skipCommitPrefixes = [...raw.skipCommitPrefixes];
    }
    if (raw.skipReverts !== undefined) {
        if (typeof raw.skipReverts !== 'boolean') {
            return { valid: false, config: undefined };
        }
        out.skipReverts = raw.skipReverts;
    }
    if (out.skipCommits !== undefined || out.skipCommitPrefixes !== undefined) {
        try {
            compileRaSkipPattern(out.skipCommits, out.skipCommitPrefixes);
        }
        catch {
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
        if (!validatedOrigin)
            return { valid: false, config: undefined };
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
        const cacheObj = raw.cache;
        for (const k of Object.keys(cacheObj)) {
            if (k !== 'enabled' && k !== 'dir')
                return { valid: false, config: undefined };
        }
        const cleanCache = {};
        if (cacheObj.enabled !== undefined) {
            if (typeof cacheObj.enabled !== 'boolean')
                return { valid: false, config: undefined };
            cleanCache.enabled = cacheObj.enabled;
        }
        if (cacheObj.dir !== undefined) {
            if (!isSafeRepoRelativeCacheDir(cacheObj.dir, reader))
                return { valid: false, config: undefined };
            cleanCache.dir = cacheObj.dir;
        }
        out.cache = cleanCache;
    }
    if (raw.owners !== undefined) {
        const validatedOwners = validateOwnersConfig(raw.owners);
        if (!validatedOwners)
            return { valid: false, config: undefined };
        out.owners = validatedOwners;
    }
    return { valid: true, config: out };
}
export function parseGutterConfigObject(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return {};
    const obj = raw;
    const out = {};
    if (typeof obj.maxForgotten === 'number' && Number.isFinite(obj.maxForgotten) && obj.maxForgotten >= 0) {
        out.maxForgotten = Math.floor(obj.maxForgotten);
    }
    if (typeof obj.maxChecklist === 'number' && Number.isFinite(obj.maxChecklist) && obj.maxChecklist >= 0) {
        out.maxChecklist = Math.floor(obj.maxChecklist);
    }
    if (typeof obj.maxCompanionQuestions === 'number' &&
        Number.isFinite(obj.maxCompanionQuestions) &&
        obj.maxCompanionQuestions >= 0) {
        out.maxCompanionQuestions = Math.floor(obj.maxCompanionQuestions);
    }
    if (typeof obj.minIntervalLow === 'number' &&
        Number.isFinite(obj.minIntervalLow) &&
        obj.minIntervalLow >= 0 &&
        obj.minIntervalLow <= 1) {
        out.minIntervalLow = obj.minIntervalLow;
    }
    if (typeof obj.minCalibratedPrecision === 'number' &&
        Number.isFinite(obj.minCalibratedPrecision) &&
        obj.minCalibratedPrecision >= 0 &&
        obj.minCalibratedPrecision <= 1) {
        out.minCalibratedPrecision = obj.minCalibratedPrecision;
    }
    if (typeof obj.minChurnForTestQuestion === 'number' &&
        Number.isFinite(obj.minChurnForTestQuestion) &&
        obj.minChurnForTestQuestion >= 0) {
        out.minChurnForTestQuestion = Math.floor(obj.minChurnForTestQuestion);
    }
    if (typeof obj.wideSurfaceImporters === 'number' &&
        Number.isFinite(obj.wideSurfaceImporters) &&
        obj.wideSurfaceImporters >= 1) {
        out.wideSurfaceImporters = Math.floor(obj.wideSurfaceImporters);
    }
    if (typeof obj.salienceFullMinSignals === 'number' &&
        Number.isFinite(obj.salienceFullMinSignals) &&
        obj.salienceFullMinSignals >= 1) {
        out.salienceFullMinSignals = Math.floor(obj.salienceFullMinSignals);
    }
    if (typeof obj.salienceBreadthFull === 'boolean') {
        out.salienceBreadthFull = obj.salienceBreadthFull;
    }
    if (typeof obj.legacyPredictions === 'boolean') {
        out.legacyPredictions = obj.legacyPredictions;
    }
    if (typeof obj.companionRequireGhost === 'boolean') {
        out.companionRequireGhost = obj.companionRequireGhost;
    }
    if (typeof obj.companionMinTrackRecordFired === 'number' &&
        Number.isInteger(obj.companionMinTrackRecordFired) &&
        obj.companionMinTrackRecordFired >= 1) {
        out.companionMinTrackRecordFired = obj.companionMinTrackRecordFired;
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
export function readGutterConfig(reader) {
    const text = reader.readText('.gutter.json');
    if (text === undefined)
        return {};
    try {
        return parseGutterConfigObject(JSON.parse(text));
    }
    catch {
        return {};
    }
}
const CODEOWNERS_CANDIDATES = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];
/**
 * Read `.gutter.json`, `.repo-archaeology.json`, `.repo-archaeology.verdicts.json`,
 * and `CODEOWNERS` at `head` through the `SourceReader`.
 */
export function readSnapshotAuxConfigs(reader) {
    const gutterConfig = readGutterConfig(reader);
    let raSettings;
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
    let codeownersPath;
    for (const candidate of CODEOWNERS_CANDIDATES) {
        if (reader.readText(candidate) !== undefined) {
            codeownersPath = candidate;
            break;
        }
    }
    return { gutterConfig, raSettings, raConfigValid, hasVerdicts, codeownersPath };
}
