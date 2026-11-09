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
  raSettings: Record<string, unknown> | undefined;
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
  let raSettings: Record<string, unknown> | undefined;
  const raRaw = reader.readText('.repo-archaeology.json');
  if (raRaw !== undefined) {
    try {
      const parsed = JSON.parse(raRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        raSettings = parsed as Record<string, unknown>;
      }
    } catch {
      raSettings = {};
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
  return { gutterConfig, raSettings, hasVerdicts, codeownersPath };
}
