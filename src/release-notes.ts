/**
 * Extracts the release notes section for a given version (e.g. "0.1.0" or
 * "0.1.0-rc.1") from CHANGELOG.md content.
 *
 * Matches a level-2 heading `## [v]<version>` followed by whitespace, `·`, or
 * end-of-line (so `0.1.0` never matches `0.1.0-rc.1`), and collects all lines
 * until the next `## ` heading or end of file.
 */
export function extractReleaseNotes(changelog: string, version: string): string {
  const ver = version.replace(/^v/, '');
  const escaped = ver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRe = new RegExp(`^##\\s+v?${escaped}(?=\\s|$|·)`);
  const nextHeadingRe = /^##\s+/;

  const lines = changelog.split(/\r?\n/);
  let collecting = false;
  const collected: string[] = [];

  for (const line of lines) {
    if (!collecting) {
      if (headingRe.test(line)) {
        collecting = true;
      }
      continue;
    }
    if (nextHeadingRe.test(line)) {
      break;
    }
    collected.push(line);
  }

  const body = collected.join('\n').trim();
  return body.length > 0 ? body : `Release ${ver}`;
}

/**
 * Compares two strict `MAJOR.MINOR.PATCH` semver strings.
 * Returns >0 if a > b, <0 if a < b, 0 if equal.
 */
export function compareStableSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Returns true if `candidateTag` (e.g. `v0.2.0`) should advance the floating
 * major tag (e.g. `v0`) given existing tags in the repository.
 * Prerelease tags never move the major tag, and backport patches older than an
 * existing stable release in the same major line do not move it backwards.
 */
export function shouldMoveMajorTag(candidateTag: string, existingTags: string[]): boolean {
  const m = /^v([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(candidateTag);
  if (!m) return false;
  const major = m[1]!;
  const stableRe = new RegExp(`^v${major}\\.([0-9]+)\\.([0-9]+)$`);
  for (const t of existingTags) {
    if (!stableRe.test(t)) continue;
    if (compareStableSemver(candidateTag, t) < 0) {
      return false;
    }
  }
  return true;
}
