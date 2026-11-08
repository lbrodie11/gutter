import { SCHEMA_VERSION } from "./contract.js";
import { browseUrlFromRemote, git, repoRoot, resolveSha } from "./git.js";
import { headCommits, readChanges } from "./evidence/changes.js";
import { buildDependents } from "./evidence/imports.js";
import { linkTests } from "./evidence/tests.js";
import { buildChecklist, salienceOf } from "./evidence/checklist.js";
import { runBacktest, runDiff, toCalibration, toForgotten } from "./sources/archaeology.js";
import { GUTTER_VERSION } from "./version.js";
const INTENT_MAX = 600;
export function buildBrief(opts) {
    const root = repoRoot(opts.cwd);
    const head = opts.head ?? 'HEAD';
    const baseSha = resolveSha(root, opts.base);
    if (!baseSha)
        throw new Error(`base ref "${opts.base}" not found (did the checkout fetch enough history? use fetch-depth: 0)`);
    const headSha = resolveSha(root, head);
    if (!headSha)
        throw new Error(`head ref "${head}" not found`);
    const changes = readChanges(root, opts.base, head);
    const commits = headCommits(root, opts.base, head);
    const dependents = buildDependents(root, changes);
    const tests = linkTests(root, changes);
    // Co-change history: Repo Archaeology analyzes the checked-out HEAD, so only
    // run it ourselves when `head` is what is checked out.
    let raDiff = opts.raDiff;
    let raBacktest = opts.raBacktest;
    let unavailable;
    const engines = [{ name: 'gutter', version: GUTTER_VERSION }];
    if (!opts.noHistory && !raDiff) {
        const checkedOut = resolveSha(root, 'HEAD');
        if (checkedOut !== headSha) {
            unavailable = `Co-change history needs ${head} checked out; it was skipped.`;
        }
        else {
            try {
                raDiff = runDiff(root, opts.base, opts.runner ?? {});
                if (!opts.noCalibration && !raBacktest)
                    raBacktest = runBacktest(root, opts.runner ?? {});
            }
            catch (err) {
                unavailable = `Repo Archaeology could not run: ${err.message.split('\n')[0]}`;
            }
        }
    }
    if (opts.noHistory)
        unavailable = 'Co-change history was turned off for this run.';
    if (raDiff)
        engines.push({ name: 'repo-archaeology', version: raDiff.tool.version });
    const forgotten = toForgotten(opts.noHistory ? undefined : raDiff, { maxItems: opts.maxForgotten ?? 3, maxEvidence: 5 }, unavailable);
    const calibration = toCalibration(opts.noHistory ? undefined : raBacktest, Boolean(opts.noCalibration));
    const checklist = buildChecklist({ changes, dependents, forgotten, tests, calibration });
    const salience = salienceOf(changes, checklist);
    const remote = git(root, ['remote', 'get-url', 'origin'], { allowFail: true });
    const repoUrl = opts.repoUrl ?? browseUrlFromRemote(remote);
    const title = (opts.title ?? commits[0]?.subject ?? `${opts.base}…${head}`).trim();
    const intent = opts.intent?.trim().slice(0, INTENT_MAX);
    return {
        schemaVersion: SCHEMA_VERSION,
        tool: { name: 'gutter', version: GUTTER_VERSION },
        change: {
            base: opts.base,
            head,
            baseSha,
            headSha,
            title,
            ...(intent ? { intent } : {}),
            commits,
            ...(repoUrl ? { repoUrl } : {}),
            ...(opts.prNumber ? { prNumber: opts.prNumber } : {}),
        },
        salience,
        changes,
        dependents,
        forgotten,
        tests,
        checklist,
        calibration,
        provenance: { generatedAt: (opts.now ?? new Date()).toISOString(), engines, deterministic: true },
    };
}
/** Normalize legacy schemaVersion: 1 briefs (`unresolvedAliases`) into `{ coverage, unresolved }`. */
export function normalizeBrief(brief) {
    const deps = brief.dependents;
    const legacyCount = typeof deps.unresolvedAliases === 'number' ? deps.unresolvedAliases : 0;
    if (!deps.unresolved || typeof deps.unresolved.count !== 'number') {
        deps.unresolved = {
            count: legacyCount,
            samples: Array.isArray(deps.unresolved?.samples) ? deps.unresolved.samples : [],
        };
    }
    else if (!Array.isArray(deps.unresolved.samples)) {
        deps.unresolved.samples = [];
    }
    if (deps.coverage !== 'full' && deps.coverage !== 'partial') {
        deps.coverage = deps.unresolved.count > 0 ? 'partial' : 'full';
    }
    return brief;
}
/** Every checklist item must point at evidence that exists. Renderers call this. */
export function assertEvidenceResolves(brief) {
    normalizeBrief(brief);
    const ids = new Set([
        ...brief.dependents.entries.map((e) => e.id),
        ...brief.forgotten.items.map((e) => e.id),
        ...brief.forgotten.families.map((e) => e.id),
        ...brief.tests.map((e) => e.id),
    ]);
    for (const c of brief.checklist) {
        for (const ref of c.evidence) {
            if (!ids.has(ref))
                throw new Error(`checklist item ${c.id} cites missing evidence ${ref}`);
        }
    }
}
