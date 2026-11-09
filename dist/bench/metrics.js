import { DEFAULT_BOOTSTRAP_RESAMPLES, DEFAULT_BOOTSTRAP_SEED, makeProportionMetric, SAMPLE_SIZE_FLOOR, UNGATED_POLICY_LABEL, } from "./model.js";
import { markSharedFollowUpCommits } from "./outcomes.js";
const ALL_KINDS = [
    'broken-import',
    'forgotten-companion',
    'family-drift',
    'untested-change',
    'wide-surface',
];
const BASELINE_NAMES = ['popular', 'popular-near', 'recent'];
export function isScoredStatus(status) {
    return status === 'followedUp' || status === 'notFollowedUp';
}
/** Deterministic Mulberry32 PRNG for reproducible PR-clustered bootstrap intervals. */
function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function quantile(sorted, q) {
    if (sorted.length === 0)
        return 0;
    if (sorted.length === 1)
        return sorted[0];
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const weight = pos - lo;
    return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}
/**
 * PR-clustered bootstrap over `prs` (1,000 resamples, seeded) for file-level precision.
 */
export function bootstrapPrPrecision(prCounts, resamples = DEFAULT_BOOTSTRAP_RESAMPLES, seed = DEFAULT_BOOTSTRAP_SEED) {
    const active = prCounts.filter((p) => p.total > 0);
    if (active.length === 0)
        return null;
    const rng = mulberry32(seed);
    const estimates = [];
    const n = active.length;
    for (let r = 0; r < resamples; r++) {
        let hits = 0;
        let total = 0;
        for (let i = 0; i < n; i++) {
            const pick = active[Math.floor(rng() * n)];
            hits += pick.hits;
            total += pick.total;
        }
        if (total > 0) {
            estimates.push(hits / total);
        }
    }
    if (estimates.length === 0)
        return null;
    estimates.sort((a, b) => a - b);
    return {
        low: Number(quantile(estimates, 0.025).toFixed(4)),
        median: Number(quantile(estimates, 0.5).toFixed(4)),
        high: Number(quantile(estimates, 0.975).toFixed(4)),
        resamples,
        seed,
    };
}
/**
 * PR-clustered paired bootstrap over `prs` (1,000 resamples, seeded) for lift (`policyRate / baselineRate`).
 */
export function bootstrapPrLift(pairedCounts, resamples = DEFAULT_BOOTSTRAP_RESAMPLES, seed = DEFAULT_BOOTSTRAP_SEED) {
    const active = pairedCounts.filter((p) => p.policyTotal > 0 || p.baseTotal > 0);
    if (active.length === 0)
        return null;
    const totalBaseHits = active.reduce((s, p) => s + p.baseHits, 0);
    const totalPolicyTotal = active.reduce((s, p) => s + p.policyTotal, 0);
    if (totalBaseHits === 0 || totalPolicyTotal === 0)
        return null;
    const rng = mulberry32(seed);
    const lifts = [];
    const n = active.length;
    for (let r = 0; r < resamples; r++) {
        let pHits = 0;
        let pTot = 0;
        let bHits = 0;
        let bTot = 0;
        for (let i = 0; i < n; i++) {
            const pick = active[Math.floor(rng() * n)];
            pHits += pick.policyHits;
            pTot += pick.policyTotal;
            bHits += pick.baseHits;
            bTot += pick.baseTotal;
        }
        if (pTot > 0 && bTot > 0 && bHits > 0) {
            const pRate = pHits / pTot;
            const bRate = bHits / bTot;
            lifts.push(pRate / bRate);
        }
    }
    if (lifts.length === 0)
        return null;
    lifts.sort((a, b) => a - b);
    return {
        low: Number(quantile(lifts, 0.025).toFixed(4)),
        median: Number(quantile(lifts, 0.5).toFixed(4)),
        high: Number(quantile(lifts, 0.975).toFixed(4)),
        resamples,
        seed,
    };
}
export function computePolicyAggregates(prs, policy) {
    const policyLabel = policy === 'production' ? 'production (calibrated)' : UNGATED_POLICY_LABEL;
    // Only include PRs where history was available (`history === 'available'`) in evaluated/scored denominators.
    const evaluatedPrs = prs.filter((p) => p.history === 'available');
    const prsEvaluated = evaluatedPrs.length;
    const sharedFollowUpOutcomes = markSharedFollowUpCommits(evaluatedPrs.map((p) => ({
        prId: p.id,
        questions: p.policies[policy].questions,
    })));
    let prsWithQuestionsCount = 0;
    let prsScoredCount = 0;
    let questionsTotal = 0;
    let quietCount = 0;
    let briefCount = 0;
    let fullCount = 0;
    const outcomes = {
        followedUp: 0,
        notFollowedUp: 0,
        censored: 0,
        targetDeleted: 0,
        targetRenamed: 0,
        resolvedAtMerge: 0,
        unscorable: 0,
        sharedFollowUpOutcomes,
    };
    let scoredQuestionsNum = 0;
    let scoredQuestionsDen = 0;
    let scoredTargetsNum = 0;
    let scoredTargetsDen = 0;
    let sameAuthorHits = 0;
    let raSignalHits = 0;
    let pAt1Hits = 0;
    let pAt1Queries = 0;
    let pAt3Hits = 0;
    let pAt3Denom = 0;
    let pAt3ShortQueries = 0;
    let missedFilesTotal = 0;
    let prsWithMissedFollowUp = 0;
    let companionFollowedUpCount = 0;
    const prPrecisionPairs = [];
    const allCandidateExemplars = [];
    const kindStats = new Map();
    for (const k of ALL_KINDS) {
        kindStats.set(k, { questions: 0, qHits: 0, qDen: 0, tHits: 0, tSame: 0, tDen: 0 });
    }
    const bucketStats = {
        '0-0.3': { targets: 0, hits: 0, same: 0, den: 0 },
        '0.3-0.5': { targets: 0, hits: 0, same: 0, den: 0 },
        '0.5+': { targets: 0, hits: 0, same: 0, den: 0 },
    };
    const confounderSlices = {
        botOrAgentOrigin: { prs: 0, hits: 0, den: 0 },
        generatedPaths: { prs: 0, hits: 0, den: 0 },
        dependencyOrVersionOnly: { prs: 0, hits: 0, den: 0 },
        largeSweep50Plus: { prs: 0, hits: 0, den: 0 },
        cleanManual: { prs: 0, hits: 0, den: 0 },
    };
    for (const pr of evaluatedPrs) {
        const evalPol = pr.policies[policy];
        if (evalPol.salience === 'quiet')
            quietCount++;
        else if (evalPol.salience === 'brief')
            briefCount++;
        else if (evalPol.salience === 'full')
            fullCount++;
        if (evalPol.questions.length > 0) {
            prsWithQuestionsCount++;
        }
        questionsTotal += evalPol.questions.length;
        let prHasScoredQuestion = false;
        let prHits = 0;
        let prTotal = 0;
        const prCompanionScoredTargets = [];
        const seenCompanionFiles = new Set();
        const seenKindTargetFiles = new Map();
        const uniquePrTargets = new Map();
        for (const q of evalPol.questions) {
            const ks = kindStats.get(q.kind) ?? { questions: 0, qHits: 0, qDen: 0, tHits: 0, tSame: 0, tDen: 0 };
            ks.questions++;
            kindStats.set(q.kind, ks);
            let kindSeen = seenKindTargetFiles.get(q.kind);
            if (!kindSeen) {
                kindSeen = new Set();
                seenKindTargetFiles.set(q.kind, kindSeen);
            }
            if (q.status === 'unscorable') {
                outcomes.unscorable++;
            }
            else if (isScoredStatus(q.status)) {
                prHasScoredQuestion = true;
                scoredQuestionsDen++;
                ks.qDen++;
                if (q.status === 'followedUp') {
                    scoredQuestionsNum++;
                    ks.qHits++;
                }
            }
            for (const t of q.targets) {
                if (!kindSeen.has(t.targetFile) && isScoredStatus(t.status)) {
                    kindSeen.add(t.targetFile);
                    ks.tDen++;
                    if (t.status === 'followedUp') {
                        ks.tHits++;
                        if (t.sameAuthor) {
                            ks.tSame++;
                        }
                    }
                }
                if (q.kind === 'forgotten-companion' && isScoredStatus(t.status) && !seenCompanionFiles.has(t.targetFile)) {
                    seenCompanionFiles.add(t.targetFile);
                    prCompanionScoredTargets.push(t);
                    if (t.status === 'followedUp') {
                        companionFollowedUpCount++;
                    }
                }
                const existing = uniquePrTargets.get(t.targetFile);
                if (!existing) {
                    uniquePrTargets.set(t.targetFile, {
                        target: t,
                        kind: q.kind,
                        question: q.question,
                        authorNames: q.authorNames,
                        intervalLow: q.intervalLow,
                        intervalLowBucket: q.intervalLowBucket,
                    });
                }
                else {
                    // If a later question on the same PR carries a Wilson interval (e.g. forgotten-companion)
                    // or upgrades status to followedUp, merge that metadata onto the unique file observation.
                    if (existing.intervalLow === null && q.intervalLow !== null) {
                        existing.intervalLow = q.intervalLow;
                        existing.intervalLowBucket = q.intervalLowBucket;
                        existing.kind = q.kind;
                        existing.question = q.question;
                    }
                    if (existing.target.status !== 'followedUp' && t.status === 'followedUp') {
                        existing.target = t;
                    }
                }
            }
        }
        for (const entry of uniquePrTargets.values()) {
            const t = entry.target;
            if (t.status === 'followedUp')
                outcomes.followedUp++;
            else if (t.status === 'notFollowedUp')
                outcomes.notFollowedUp++;
            else if (t.status === 'censored')
                outcomes.censored++;
            else if (t.status === 'targetDeleted')
                outcomes.targetDeleted++;
            else if (t.status === 'targetRenamed')
                outcomes.targetRenamed++;
            else if (t.status === 'resolvedAtMerge')
                outcomes.resolvedAtMerge++;
            else if (t.status === 'unscorable')
                outcomes.unscorable++;
            if (entry.intervalLowBucket !== 'none') {
                bucketStats[entry.intervalLowBucket].targets++;
            }
            if (isScoredStatus(t.status)) {
                scoredTargetsDen++;
                prTotal++;
                if (entry.intervalLowBucket !== 'none') {
                    bucketStats[entry.intervalLowBucket].den++;
                }
                if (t.status === 'followedUp') {
                    scoredTargetsNum++;
                    prHits++;
                    if (entry.intervalLowBucket !== 'none') {
                        bucketStats[entry.intervalLowBucket].hits++;
                    }
                    if (t.sameAuthor) {
                        sameAuthorHits++;
                        if (entry.intervalLowBucket !== 'none') {
                            bucketStats[entry.intervalLowBucket].same++;
                        }
                    }
                    if (t.matchesRaFollowUp) {
                        raSignalHits++;
                    }
                }
                allCandidateExemplars.push({
                    prId: pr.id,
                    prNumber: pr.prNumber,
                    headSha: pr.head,
                    subject: pr.subject,
                    authorNames: entry.authorNames,
                    kind: entry.kind,
                    question: entry.question,
                    targetFile: t.targetFile,
                    intervalLow: entry.intervalLow,
                    status: t.status,
                    followUpCommitSha: t.commitSha,
                    delayHours: t.delayHours,
                    sameAuthor: t.sameAuthor,
                });
            }
        }
        if (prHasScoredQuestion) {
            prsScoredCount++;
        }
        prPrecisionPairs.push({ hits: prHits, total: prTotal });
        if (prCompanionScoredTargets.length > 0) {
            pAt1Queries++;
            if (prCompanionScoredTargets[0].status === 'followedUp') {
                pAt1Hits++;
            }
            const top3 = prCompanionScoredTargets.slice(0, 3);
            if (top3.length < 3) {
                pAt3ShortQueries++;
            }
            pAt3Denom += top3.length;
            pAt3Hits += top3.filter((t) => t.status === 'followedUp').length;
        }
        // Missed follow-ups (only counted on PRs whose window is not censored)
        const prWindowObserved = evalPol.questions.every((q) => q.status !== 'censored') &&
            evalPol.missedFollowUpFiles !== undefined;
        if (prWindowObserved && evalPol.missedFollowUpFiles.length > 0) {
            missedFilesTotal += evalPol.missedFollowUpFiles.length;
            prsWithMissedFollowUp++;
        }
        // Confounders breakdown
        const c = pr.confounders;
        const isClean = !c.botOrAgentOrigin && !c.generatedPaths && !c.dependencyOrVersionOnly && !c.largeSweep50Plus;
        if (c.botOrAgentOrigin) {
            confounderSlices.botOrAgentOrigin.prs++;
            confounderSlices.botOrAgentOrigin.hits += prHits;
            confounderSlices.botOrAgentOrigin.den += prTotal;
        }
        if (c.generatedPaths) {
            confounderSlices.generatedPaths.prs++;
            confounderSlices.generatedPaths.hits += prHits;
            confounderSlices.generatedPaths.den += prTotal;
        }
        if (c.dependencyOrVersionOnly) {
            confounderSlices.dependencyOrVersionOnly.prs++;
            confounderSlices.dependencyOrVersionOnly.hits += prHits;
            confounderSlices.dependencyOrVersionOnly.den += prTotal;
        }
        if (c.largeSweep50Plus) {
            confounderSlices.largeSweep50Plus.prs++;
            confounderSlices.largeSweep50Plus.hits += prHits;
            confounderSlices.largeSweep50Plus.den += prTotal;
        }
        if (isClean) {
            confounderSlices.cleanManual.prs++;
            confounderSlices.cleanManual.hits += prHits;
            confounderSlices.cleanManual.den += prTotal;
        }
    }
    const fileLevelFollowUpPrecision = makeProportionMetric(scoredTargetsNum, scoredTargetsDen);
    const questionLevelFollowUpRate = makeProportionMetric(scoredQuestionsNum, scoredQuestionsDen);
    const precisionAt1 = makeProportionMetric(pAt1Hits, pAt1Queries);
    const precisionAt3 = makeProportionMetric(pAt3Hits, pAt3Denom);
    const sameAuthorFollowUpRate = makeProportionMetric(sameAuthorHits, scoredTargetsDen);
    const sameAuthorShareOfFollowedUp = makeProportionMetric(sameAuthorHits, scoredTargetsNum);
    const raSignalFollowUpRate = makeProportionMetric(raSignalHits, scoredTargetsDen);
    const bootstrapFilePrecisionCi = bootstrapPrPrecision(prPrecisionPairs);
    // Baselines aggregation
    const baselineSummaries = {};
    for (const bName of BASELINE_NAMES) {
        let proposedTargets = 0;
        let shortfallPrs = 0;
        let shortfallTargets = 0;
        let bHits = 0;
        let bDen = 0;
        let bSameHits = 0;
        let bQuestionHits = 0;
        let bQuestionDen = 0;
        const pairedLiftRows = [];
        for (let i = 0; i < evaluatedPrs.length; i++) {
            const pr = evaluatedPrs[i];
            const bSet = pr.policies[policy].baselines[bName];
            const pCounts = prPrecisionPairs[i];
            proposedTargets += bSet.proposedCount;
            if (bSet.shortfall > 0) {
                shortfallPrs++;
                shortfallTargets += bSet.shortfall;
            }
            let prBHits = 0;
            let prBDen = 0;
            for (const t of bSet.targets) {
                if (isScoredStatus(t.status)) {
                    bDen++;
                    prBDen++;
                    if (t.status === 'followedUp') {
                        bHits++;
                        prBHits++;
                        if (t.sameAuthor)
                            bSameHits++;
                    }
                }
            }
            if (prBDen > 0) {
                bQuestionDen++;
                if (prBHits > 0)
                    bQuestionHits++;
            }
            pairedLiftRows.push({
                policyHits: pCounts.hits,
                policyTotal: pCounts.total,
                baseHits: prBHits,
                baseTotal: prBDen,
            });
        }
        const bFilePrecision = makeProportionMetric(bHits, bDen);
        const bQuestionHit = makeProportionMetric(bQuestionHits, bQuestionDen);
        const bSameRate = makeProportionMetric(bSameHits, bDen);
        const pRate = fileLevelFollowUpPrecision.rate;
        const bRate = bFilePrecision.rate;
        const liftVsBaseline = pRate !== null && bRate !== null && bRate > 0 ? Number((pRate / bRate).toFixed(4)) : null;
        const bootstrapLiftCi = bootstrapPrLift(pairedLiftRows);
        baselineSummaries[bName] = {
            baseline: bName,
            proposedTargets,
            shortfallPrs,
            shortfallTargets,
            fileLevelFollowUp: bFilePrecision,
            questionLevelHitRate: bQuestionHit,
            sameAuthorFollowUpRate: bSameRate,
            liftVsBaseline,
            bootstrapLiftCi,
        };
    }
    // Headline baseline = strongest baseline (highest fileLevelFollowUp.rate; tie-breaker: popular-near -> recent -> popular)
    let strongestBaseline = null;
    let highestBaselineRate = -1;
    for (const bName of ['popular-near', 'recent', 'popular']) {
        const bSummary = baselineSummaries[bName];
        if (bSummary.fileLevelFollowUp.rate !== null && bSummary.fileLevelFollowUp.rate > highestBaselineRate) {
            highestBaselineRate = bSummary.fileLevelFollowUp.rate;
            strongestBaseline = bName;
        }
    }
    const headlineSummary = strongestBaseline ? baselineSummaries[strongestBaseline] : null;
    // Breakdowns
    const byKind = {};
    for (const k of ALL_KINDS) {
        const ks = kindStats.get(k);
        byKind[k] = {
            kind: k,
            questions: ks.questions,
            scoredQuestions: ks.qDen,
            questionFollowUpRate: makeProportionMetric(ks.qHits, ks.qDen),
            scoredTargets: ks.tDen,
            fileFollowUpPrecision: makeProportionMetric(ks.tHits, ks.tDen),
            sameAuthorFollowUpRate: makeProportionMetric(ks.tSame, ks.tDen),
        };
    }
    const byIntervalLow = {
        '0-0.3': {
            bucket: '0-0.3',
            targets: bucketStats['0-0.3'].targets,
            scoredTargets: bucketStats['0-0.3'].den,
            fileFollowUpPrecision: makeProportionMetric(bucketStats['0-0.3'].hits, bucketStats['0-0.3'].den),
            sameAuthorFollowUpRate: makeProportionMetric(bucketStats['0-0.3'].same, bucketStats['0-0.3'].den),
        },
        '0.3-0.5': {
            bucket: '0.3-0.5',
            targets: bucketStats['0.3-0.5'].targets,
            scoredTargets: bucketStats['0.3-0.5'].den,
            fileFollowUpPrecision: makeProportionMetric(bucketStats['0.3-0.5'].hits, bucketStats['0.3-0.5'].den),
            sameAuthorFollowUpRate: makeProportionMetric(bucketStats['0.3-0.5'].same, bucketStats['0.3-0.5'].den),
        },
        '0.5+': {
            bucket: '0.5+',
            targets: bucketStats['0.5+'].targets,
            scoredTargets: bucketStats['0.5+'].den,
            fileFollowUpPrecision: makeProportionMetric(bucketStats['0.5+'].hits, bucketStats['0.5+'].den),
            sameAuthorFollowUpRate: makeProportionMetric(bucketStats['0.5+'].same, bucketStats['0.5+'].den),
        },
    };
    const byConfounder = {};
    for (const slice of [
        'botOrAgentOrigin',
        'generatedPaths',
        'dependencyOrVersionOnly',
        'largeSweep50Plus',
        'cleanManual',
    ]) {
        const cs = confounderSlices[slice];
        byConfounder[slice] = {
            slice,
            prsEvaluated: cs.prs,
            scoredTargets: cs.den,
            fileFollowUpPrecision: makeProportionMetric(cs.hits, cs.den),
        };
    }
    // Five best and five worst questions
    const bestQuestions = allCandidateExemplars
        .filter((e) => e.status === 'followedUp')
        .sort((a, b) => Number(Boolean(b.sameAuthor)) - Number(Boolean(a.sameAuthor)) ||
        (b.intervalLow ?? 0) - (a.intervalLow ?? 0) ||
        (a.delayHours ?? 9999) - (b.delayHours ?? 9999) ||
        a.prId.localeCompare(b.prId))
        .slice(0, 5);
    const worstQuestions = allCandidateExemplars
        .filter((e) => e.status === 'notFollowedUp')
        .sort((a, b) => (b.intervalLow ?? 0) - (a.intervalLow ?? 0) ||
        a.prId.localeCompare(b.prId) ||
        a.targetFile.localeCompare(b.targetFile))
        .slice(0, 5);
    const sampleStatus = prsScoredCount >= SAMPLE_SIZE_FLOOR && scoredQuestionsDen >= SAMPLE_SIZE_FLOOR
        ? 'sufficient'
        : 'insufficient-sample (< 30 scored)';
    return {
        policy,
        policyLabel,
        sampleStatus,
        coverage: {
            prsEvaluated,
            prsScored: prsScoredCount,
            prsWithQuestions: makeProportionMetric(prsWithQuestionsCount, prsEvaluated),
            questionsTotal,
            questionsPerPr: prsEvaluated > 0 ? Number((questionsTotal / prsEvaluated).toFixed(4)) : null,
            salienceDistribution: {
                quiet: makeProportionMetric(quietCount, prsEvaluated),
                brief: makeProportionMetric(briefCount, prsEvaluated),
                full: makeProportionMetric(fullCount, prsEvaluated),
            },
            fullSalienceShare: makeProportionMetric(fullCount, prsEvaluated),
        },
        outcomes,
        accuracyProxy: {
            fileLevelFollowUpPrecision,
            questionLevelFollowUpRate,
            precisionAt1,
            precisionAt3,
            precisionAt3ShortQueries: pAt3ShortQueries,
            precisionAt3Note: 'Queries with fewer than 3 suggestions use their actual suggestion count (1 or 2) as the denominator.',
            sameAuthorFollowUpRate,
            sameAuthorShareOfFollowedUp,
            raSignalFollowUpRate,
            bootstrapFilePrecisionCi,
        },
        missedFollowUps: {
            missedFilesTotal,
            prsWithMissedFollowUp,
            recallProxy: makeProportionMetric(companionFollowedUpCount, companionFollowedUpCount + missedFilesTotal),
        },
        baselines: baselineSummaries,
        headlineBaseline: {
            strongestBaseline,
            lift: headlineSummary?.liftVsBaseline ?? null,
            bootstrapLiftCi: headlineSummary?.bootstrapLiftCi ?? null,
        },
        breakdowns: {
            byKind,
            byIntervalLow,
            byConfounder,
        },
        exemplars: {
            bestQuestions,
            worstQuestions,
        },
    };
}
export function summarizeStageTiming(samplesMs) {
    if (samplesMs.length === 0) {
        return { count: 0, totalMs: 0, p50Ms: 0, p95Ms: 0 };
    }
    const sorted = [...samplesMs].sort((a, b) => a - b);
    const total = sorted.reduce((s, x) => s + x, 0);
    return {
        count: sorted.length,
        totalMs: Number(total.toFixed(2)),
        p50Ms: Number(quantile(sorted, 0.5).toFixed(2)),
        p95Ms: Number(quantile(sorted, 0.95).toFixed(2)),
    };
}
export function buildGateSummary(production, gateFullShare, proxyMinLift) {
    const fullRate = production.coverage.fullSalienceShare.rate;
    const fullPassed = fullRate === null ? null : fullRate < gateFullShare;
    const fullLabel = gateFullShare === 1 / 3 || Math.abs(gateFullShare - 1 / 3) < 0.001 ? '< 1/3' : `< ${gateFullShare}`;
    const fullLine = fullRate === null
        ? `Full-salience share: N/A (${fullLabel})`
        : `Full-salience share: ${fullRate.toFixed(2)} (${fullLabel}) ${fullPassed ? '✓' : '✗'}`;
    const proxyRate = production.accuracyProxy.fileLevelFollowUpPrecision.rate;
    const proxyInterval = production.accuracyProxy.fileLevelFollowUpPrecision.interval;
    const strongest = production.headlineBaseline.strongestBaseline;
    const lift = production.headlineBaseline.lift;
    const proxyPart = proxyRate === null || !proxyInterval
        ? 'Follow-up proxy N/A'
        : `Follow-up proxy ${proxyRate.toFixed(2)} [${proxyInterval.low.toFixed(2)}–${proxyInterval.high.toFixed(2)}]`;
    const liftPart = lift === null || !strongest ? 'lift N/A' : `lift ×${lift.toFixed(2)} vs ${strongest}`;
    const sampleSuffix = production.sampleStatus !== 'sufficient'
        ? ` (insufficient sample: N=${production.coverage.prsScored} < ${SAMPLE_SIZE_FLOOR})`
        : '';
    const gateALine = `Question usefulness (Gate A): UNVERIFIED${sampleSuffix}. ${proxyPart}, ${liftPart}. Human labels: GU-04.`;
    return {
        fullSalienceShare: {
            value: fullRate,
            threshold: Number(gateFullShare.toFixed(4)),
            passed: fullPassed,
            line: fullLine,
        },
        gateAUsefulness: {
            status: 'UNVERIFIED',
            followUpProxyRate: proxyRate,
            followUpProxyInterval: proxyInterval,
            strongestBaseline: strongest,
            liftVsStrongest: lift,
            proxyMinLift,
            line: gateALine,
        },
    };
}
