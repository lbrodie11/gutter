/**
 * Adapter for Repo Archaeology's v1 JSON contract (repo-archaeology >= 0.3.0; `trackRecord` needs >= 0.10.0).
 *
 * Gutter does not re-implement co-change mining. Repo Archaeology owns the
 * statistics (directional confidence, Wilson ranking, sweep filtering, rename
 * following, backtests); Gutter owns comprehension: gating, wording, layout.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { win32 } from 'node:path';
import { wilsonInterval, pct } from "../stats/wilson.js";
import { isAutomatedAuthor } from "../evidence/automation.js";
const nonNegInt = (x) => typeof x === 'number' && Number.isInteger(x) && x >= 0;
const unit = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
/** RA-05 `interval`: `{ low, high }` with 0 <= low <= high <= 1, else undefined (Gutter computes its own). */
export function normalizeInterval(raw) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const r = raw;
    return unit(r.low) && unit(r.high) && r.low <= r.high ? { low: r.low, high: r.high } : undefined;
}
/** RA-08 `originShare`: `{ human, agent, bot }`, each in [0, 1], else undefined. */
export function normalizeOriginShare(raw) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const r = raw;
    return unit(r.human) && unit(r.agent) && unit(r.bot) ? { human: r.human, agent: r.agent, bot: r.bot } : undefined;
}
/** RA-08 evidence `origin`. Unknown values are ignored (Gutter's author-name fallback applies). */
export function normalizeOrigin(raw) {
    return raw === 'human' || raw === 'agent' || raw === 'bot' ? raw : undefined;
}
/** Optional Repo Archaeology fields present in a diff/backtest, for `provenance.engines[].features`. */
export function detectRaFeatures(diff, backtest) {
    const out = new Set();
    for (const s of diff?.suggestions ?? []) {
        if (normalizeInterval(s.interval))
            out.add('interval');
        if (normalizeOriginShare(s.originShare))
            out.add('originShare');
        if (s.evidence.some((e) => normalizeOrigin(e.origin)))
            out.add('origin');
        if (s.trackRecord !== undefined)
            out.add('trackRecord');
        if (s.owners !== undefined)
            out.add('owners');
    }
    if (backtest?.strategies.some((x) => x.followUpPrecision !== undefined || x.followUpHitRate !== undefined))
        out.add('followUps');
    return [...out].sort();
}
/**
 * Validate an untrusted `trackRecord` against the three RA 0.10 shapes; anything else is `undefined`
 * (treated like "no track record"), so a malformed or future shape can never pass a `fired` filter.
 */
export function normalizeTrackRecord(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return undefined;
    const r = raw;
    if (r.reason === 'limited_history') {
        return { fired: null, confirmed: null, precision: null, reason: 'limited_history' };
    }
    if (r.reason === 'never_fired') {
        return r.fired === 0 ? { fired: 0, confirmed: null, precision: null, reason: 'never_fired' } : undefined;
    }
    if (r.reason !== undefined)
        return undefined;
    if (!nonNegInt(r.fired) || r.fired < 1 || !nonNegInt(r.confirmed) || r.confirmed > r.fired)
        return undefined;
    const precision = typeof r.precision === 'number' && r.precision >= 0 && r.precision <= 1 ? r.precision : null;
    return { fired: r.fired, confirmed: r.confirmed, precision, reason: null };
}
/** Track records keyed by suggested file (`to`); `diff` emits one suggestion per untouched file. */
export function trackRecordsByTarget(diff) {
    const out = new Map();
    for (const s of diff?.suggestions ?? []) {
        if (out.has(s.to))
            continue;
        const tr = normalizeTrackRecord(s.trackRecord);
        if (tr)
            out.set(s.to, tr);
    }
    return out;
}
/** npx last resort (GU-05). `^0.4.0` would cap at 0.4.x, which lacks `interval`, `origin` and track records. */
export const DEFAULT_RA_SPEC = '^0.10.0';
export function resolveRaCommand(runner, ctx = {}) {
    const env = ctx.env ?? process.env;
    const platform = ctx.platform ?? process.platform;
    const execPath = ctx.execPath ?? process.execPath;
    const exists = ctx.exists ?? existsSync;
    const bin = runner.bin ?? env.GUTTER_RA_BIN;
    if (bin)
        return /\.[cm]?js$/.test(bin) ? { file: execPath, pre: [bin] } : { file: bin, pre: [] };
    const spec = runner.spec ?? DEFAULT_RA_SPEC;
    if (!/^[\w.^~<>=*| -]+$/.test(spec))
        throw new Error(`invalid repo-archaeology version spec: ${spec}`);
    if (platform === 'win32') {
        const candidates = [
            env.npm_execpath ? win32.join(win32.dirname(env.npm_execpath), 'npx-cli.js') : '',
            win32.join(win32.dirname(execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'),
        ].filter(Boolean);
        for (const c of candidates) {
            if (exists(c))
                return { file: execPath, pre: [c, '--yes', `repo-archaeology@${spec}`] };
        }
        throw new Error('Could not locate npx-cli.js for this Windows Node.js installation; set GUTTER_RA_BIN or pass --ra-bin pointing to repo-archaeology/dist/cli.js.');
    }
    return { file: 'npx', pre: ['--yes', `repo-archaeology@${spec}`] };
}
function runJson(root, runner, args) {
    const { file, pre } = resolveRaCommand(runner);
    const out = execFileSync(file, [...pre, ...args, '--json'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 128 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(out);
}
export function loadJson(path) {
    if (!existsSync(path))
        throw new Error(`file not found: ${path}`);
    return JSON.parse(readFileSync(path, 'utf8'));
}
export function runDiff(root, base, runner) {
    return runJson(root, runner, ['diff', '--base', base, '--limit', '25']);
}
export function runBacktest(root, runner) {
    return runJson(root, runner, ['backtest']);
}
function assertV1(doc, what) {
    if (doc.schemaVersion !== 1) {
        throw new Error(`${what}: expected Repo Archaeology schemaVersion 1, got ${String(doc.schemaVersion)}`);
    }
}
// ---- Mapping into gutter.json -------------------------------------------------
const SILENCE_NOTES = {
    no_changed_files: 'No changed files to check.',
    limited_repo_history: 'Too little history in this repository to say anything yet.',
    no_history_for_changed_files: 'The changed files are new or have too little history.',
    no_cochange_partners: 'These files have no files that usually change with them.',
    all_companions_touched: 'Every file that usually changes with these files was changed here too.',
    filtered_by_thresholds: 'Some files co-change occasionally, but not often enough to flag.',
    filtered_by_kinds: 'Companions exist but are outside the configured relationship kinds.',
};
export function toForgotten(diff, opts, unavailableNote) {
    if (!diff) {
        return {
            status: 'unavailable',
            note: unavailableNote ?? 'Repo Archaeology did not run, so co-change history was not checked.',
            items: [], total: 0, families: [], commitsAnalyzed: 0, warnings: [],
        };
    }
    assertV1(diff, 'diff JSON');
    const items = diff.suggestions.slice(0, opts.maxItems).map((s, i) => {
        // GU-05: Repo Archaeology's origin classifier wins; the author-name list is the fallback.
        const evidence = s.evidence.slice(0, opts.maxEvidence).map((e) => {
            const origin = normalizeOrigin(e.origin);
            return {
                sha: e.hash, date: e.date, author: e.author, subject: e.subject,
                automated: origin ? origin === 'bot' : isAutomatedAuthor(e.author),
                ...(origin ? { origin } : {}),
            };
        });
        const automated = evidence.filter((e) => e.automated).length;
        const originShare = normalizeOriginShare(s.originShare);
        return {
            id: `forgotten:${i}`,
            changed: s.from,
            file: s.to,
            relationship: s.relationship,
            why: s.why,
            shared: s.shared,
            changedTotal: s.fromChanges,
            confidence: s.confidence,
            interval: normalizeInterval(s.interval) ?? wilsonInterval(s.shared, s.fromChanges),
            ...(s.lastTogether ? { lastTogether: s.lastTogether } : {}),
            evidence,
            automationShare: originShare ? originShare.bot : evidence.length ? automated / evidence.length : 0,
            alsoLinkedFrom: s.alsoLinkedFrom ?? [],
            ...(originShare ? { originShare } : {}),
        };
    });
    const families = (diff.families ?? []).map((f, i) => {
        const members = f.members.map((m) => m.path);
        const changed = new Set(f.changedMembers ?? []);
        return {
            id: `family:${i}`,
            label: f.label,
            why: f.why,
            members,
            changedMembers: members.filter((m) => changed.has(m)),
            untouchedMembers: members.filter((m) => !changed.has(m)),
        };
    });
    const reason = diff.silence?.primaryReason;
    const insufficient = reason === 'limited_repo_history' || reason === 'no_history_for_changed_files';
    return {
        status: insufficient ? 'insufficient-history' : 'analyzed',
        ...(items.length === 0 && reason ? { note: SILENCE_NOTES[reason] ?? reason } : {}),
        items,
        total: diff.totalSuggestions ?? diff.suggestions.length,
        families,
        commitsAnalyzed: diff.meta.commitsAnalyzed,
        warnings: diff.meta.warnings ?? [],
    };
}
/** Thresholds for calling calibration "measured" rather than "thin". */
const MIN_TEST_COMMITS = 50;
const MIN_FIRED = 20;
export function toCalibration(bt, skipped = false) {
    if (skipped)
        return { status: 'skipped', note: 'Calibration was turned off for this run.' };
    if (!bt)
        return { status: 'unavailable', note: 'No backtest ran, so warning accuracy on this repository is unknown.' };
    assertV1(bt, 'backtest JSON');
    const main = bt.strategies.find((s) => s.name === 'co-change');
    const baseline = bt.strategies.find((s) => s.name === 'popularity, same changes');
    if (!main)
        return { status: 'unavailable', note: 'Backtest output had no co-change strategy.' };
    // Lift uses hit rate, the same definition Repo Archaeology prints, so the two tools never disagree.
    const lift = baseline && baseline.hitRate > 0 ? main.hitRate / baseline.hitRate : undefined;
    const thin = bt.test.commits < MIN_TEST_COMMITS || main.fired < MIN_FIRED;
    const note = thin
        ? `Only ${bt.test.commits} recent commits to test against, so accuracy here is not yet known.`
        : `Replayed on the last ${bt.test.commits} commits: when it flagged files, at least one really did change ${pct(main.hitRate)} of the time` +
            (lift ? ` (${lift.toFixed(1)}× better than guessing busy files)` : '') +
            `, and ${pct(main.precision)} of all flagged files did.`;
    return {
        status: thin ? 'thin' : 'measured',
        note,
        precision: main.precision,
        hitRate: main.hitRate,
        ...(lift !== undefined ? { lift } : {}),
        testCommits: bt.test.commits,
        fired: main.fired,
        window: { from: bt.test.from, to: bt.test.to },
    };
}
