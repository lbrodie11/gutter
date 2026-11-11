/**
 * FALLBACK ONLY (GU-05) for co-change items: Repo Archaeology's `interval` (RA-05) is used when present.
 *
 * 95% Wilson score interval for k successes out of n trials.
 * Used to show "14 of 19 commits (95% CI 51–89%)" instead of a bare 74%,
 * so sparse history reads as uncertain rather than authoritative.
 */
export function wilsonInterval(k, n, z = 1.959963984540054) {
    if (n <= 0)
        return { low: 0, high: 1 };
    const p = Math.min(Math.max(k / n, 0), 1);
    const z2 = z * z;
    const denom = 1 + z2 / n;
    const centre = p + z2 / (2 * n);
    const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    return {
        low: Math.max(0, (centre - margin) / denom),
        high: Math.min(1, (centre + margin) / denom),
    };
}
export function pct(x) {
    return `${Math.round(x * 100)}%`;
}
