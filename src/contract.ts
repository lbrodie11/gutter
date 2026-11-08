/**
 * The gutter.json contract (schemaVersion 1).
 *
 * This is the product. Renderers (compact Markdown, comic HTML), the GitHub
 * Action, future IDE/agent surfaces and analytics all consume this one shape.
 * Rule: no renderer may say anything that is not in here, and every checklist
 * item must cite evidence ids that exist in here.
 *
 * Versioning mirrors Repo Archaeology: additive fields and new enum values keep
 * schemaVersion 1; removing/renaming/retyping a field bumps it. Consumers must
 * ignore unknown properties and tolerate unknown enum values (e.g. new
 * `checklist.kind` values).
 */

export const SCHEMA_VERSION = 1 as const;

export type EvidenceId = string;

export interface GutterBrief {
  schemaVersion: typeof SCHEMA_VERSION;
  tool: { name: 'gutter'; version: string };
  change: ChangeContext;
  salience: Salience;
  changes: ChangeStructure;
  dependents: DependentsLayer;
  forgotten: ForgottenLayer;
  tests: TestLink[];
  checklist: ChecklistItem[];
  calibration: Calibration;
  provenance: Provenance;
}

/** What the reviewer is looking at. Never contains absolute local paths. */
export interface ChangeContext {
  base: string;
  head: string;
  baseSha?: string;
  headSha?: string;
  /** PR title or, failing that, the head commit subject. Untrusted text. */
  title: string;
  /** PR body excerpt (trimmed). Untrusted text. */
  intent?: string;
  /** Subjects of commits in base..head, newest first, capped. Untrusted text. */
  commits: { sha: string; subject: string }[];
  /** e.g. https://github.com/owner/repo — used only to build links. */
  repoUrl?: string;
  prNumber?: number;
}

/**
 * "Nothing to say" is a successful outcome. Renderers use this to decide how
 * loud to be: quiet = one line (or no comment at all), brief = short, full = page.
 */
export interface Salience {
  level: 'quiet' | 'brief' | 'full';
  reasons: string[];
}

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  /** null when binary. */
  binary: boolean;
  module: string;
  isTest: boolean;
  language: string | null;
}

export interface ModuleSummary {
  name: string;
  files: number;
  additions: number;
  deletions: number;
}

export interface ChangeStructure {
  files: ChangedFile[];
  modules: ModuleSummary[];
  totals: { files: number; additions: number; deletions: number; modules: number };
}

export interface DependentsEntry {
  id: EvidenceId;
  file: string;
  deleted: boolean;
  /** Files that statically import `file` and were also changed. */
  changedImporters: string[];
  /** Files that statically import `file` and were NOT changed in this PR. */
  untouchedImporters: string[];
}

export interface DependentsLayer {
  /** Which analyzers ran. Anything outside them is reported as unchecked, never as "no dependents". */
  analyzers: string[];
  entries: DependentsEntry[];
  /** Changed files whose language has no static analyzer yet. */
  unchecked: string[];
  /** 'full' when all non-external imports were resolved; 'partial' when unresolved imports exist. */
  coverage: 'full' | 'partial';
  /** Unresolved non-relative, non-external imports (`<file> → <specifier>`), capped at 5 sorted samples. */
  unresolved: { count: number; samples: string[] };
  scannedFiles: number;
}

export interface CommitRef {
  sha: string;
  date: string;
  author: string;
  subject: string;
  automated: boolean;
}

export interface ForgottenItem {
  id: EvidenceId;
  /** The changed file that predicts the companion. */
  changed: string;
  /** The untouched companion. */
  file: string;
  relationship: 'ghost' | 'unknown' | 'indirect' | 'direct' | 'test';
  why: string;
  shared: number;
  changedTotal: number;
  /** Directional confidence shared/changedTotal. */
  confidence: number;
  /** 95% Wilson interval for that proportion. */
  interval: { low: number; high: number };
  lastTogether?: string;
  evidence: CommitRef[];
  /** Share of supporting commits authored by bots/automation (0..1). */
  automationShare: number;
  alsoLinkedFrom: string[];
}

export interface FamilyItem {
  id: EvidenceId;
  label: string;
  why: string;
  members: string[];
  changedMembers: string[];
  untouchedMembers: string[];
}

export interface ForgottenLayer {
  status: 'analyzed' | 'insufficient-history' | 'unavailable';
  /** Plain-language reason when status !== analyzed or nothing was found. */
  note?: string;
  items: ForgottenItem[];
  /** Qualifying suggestions before Gutter's display cap. */
  total: number;
  families: FamilyItem[];
  commitsAnalyzed: number;
  warnings: string[];
}

export interface TestLink {
  id: EvidenceId;
  source: string;
  status: 'test-changed' | 'test-untouched' | 'no-test-found';
  candidates: { path: string; changed: boolean }[];
}

export type ChecklistKind =
  | 'broken-import'
  | 'forgotten-companion'
  | 'family-drift'
  | 'untested-change'
  | 'wide-surface';

export interface ChecklistItem {
  id: EvidenceId;
  kind: ChecklistKind;
  /** A question for the reviewer, never a verdict. Paths appear in `backticks`. */
  question: string;
  /** Ids of dependents/forgotten/family/tests entries this question rests on. */
  evidence: EvidenceId[];
  priority: number;
}

export interface Calibration {
  status: 'measured' | 'thin' | 'unavailable' | 'skipped';
  note: string;
  /** Of files Gutter would have flagged on held-out history, share that really did change next. */
  precision?: number;
  /** Share of flagged changes where at least one flagged file was right. */
  hitRate?: number;
  /** hitRate ÷ popularity-baseline hitRate on the same changes (Repo Archaeology's definition). */
  lift?: number;
  testCommits?: number;
  fired?: number;
  window?: { from: string; to: string };
}

export interface Provenance {
  generatedAt: string;
  engines: { name: string; version: string }[];
  deterministic: true;
}
