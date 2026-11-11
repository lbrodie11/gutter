import type { DependentsLayer } from '../contract.ts';

/**
 * What the renderers say about `dependents.coverage` (GU-32, DECISIONS #21). Plain text pieces: the renderer
 * escapes them and formats `sample` (PR-derived: a path and a specifier) as code.
 *
 * - A brief with `unresolved.relevant` (GU-32 and later): "partial" only when `coverage` is `partial`, naming how
 *   many imports could reach the PR's files and one of them; the repository-wide count is a quieter line.
 * - An older brief (no `relevant`): exactly the pre-GU-32 sentence, where `partial` meant "any unresolved import
 *   in the repository".
 */
export interface CoverageWording {
  partial: boolean;
  /** "No importers found" lead-in for a page with no importers to list (only when `partial`). */
  noneFound: string;
  /** The partial sentence: `before`, then ` (for example <sample>)` when there is a sample, then `after`. */
  before: string;
  sample?: string;
  after: string;
  /** Unresolved imports elsewhere in the repository that cannot reach this PR's files (quieter line). */
  elsewhere?: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function coverageWording(deps: DependentsLayer): CoverageWording {
  const uCount = deps.unresolved?.count ?? 0;
  const ra = deps.analyzers.includes('ra-import-graph');
  const relevant = deps.unresolved?.relevant;
  if (!relevant || (deps.coverage === 'partial' && relevant.count === 0)) {
    // Pre-GU-32 brief: unchanged wording.
    return {
      partial: deps.coverage === 'partial' || uCount > 0,
      noneFound: 'No importers found through relative imports. ',
      before: ra
        ? `${plural(uCount, 'import')} in this repository could not be resolved to a file, so some importers may be missing.`
        : `${plural(uCount, 'import')} ${uCount === 1 ? 'uses' : 'use'} aliases or packages Gutter can't resolve yet, so some importers may be missing.`,
      after: '',
    };
  }
  const rc = relevant.count;
  const partial = deps.coverage === 'partial';
  const others = Math.max(0, uCount - rc);
  const elsewhere = others === 0
    ? undefined
    : partial
      ? `${plural(others, 'other unresolved import')} in this repository can't reach them.`
      : `${plural(others, 'unresolved import')} elsewhere in this repository can't reach this PR's files.`;
  return {
    partial,
    noneFound: ra ? 'No importers found. ' : 'No importers found through relative imports. ',
    before: ra
      ? `${plural(rc, 'import')} that could reach this PR's files could not be resolved`
      : `${plural(rc, 'import')} that could reach this PR's files ${rc === 1 ? 'uses' : 'use'} aliases or packages Gutter can't resolve yet`,
    ...(relevant.samples[0] ? { sample: relevant.samples[0] } : {}),
    after: ', so some importers may be missing.',
    ...(elsewhere ? { elsewhere } : {}),
  };
}
