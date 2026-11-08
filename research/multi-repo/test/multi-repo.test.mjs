import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildReportMarkdown } from '../generate-report.mjs';
import {
  buildShuffledDownstreamCommits,
  classifyCommit,
  classifyFilePath,
  computeOverallDecision,
  evaluateWalkForward,
  extractContractTokens,
  extractExplicitRefsFromSubject,
  wilsonInterval,
} from '../run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MULTI_REPO_DIR = join(HERE, '..');

const HOUR = 3600;
const DAY = 24 * HOUR;

function makeCommit({
  sha,
  commitTime,
  files,
  subject = 'feat: update module',
  authorName = 'Alice Dev',
  committerName = 'Alice Dev',
  repoId = 'org/repo',
}) {
  const c = {
    sha,
    authorTime: commitTime,
    commitTime,
    authorName,
    committerName,
    subject,
    files,
  };
  c.category = classifyCommit(c, repoId);
  c.explicitRefs = extractExplicitRefsFromSubject(subject);
  return c;
}

describe('GU-27 multi-repo research harness', () => {
  it('enforces strict as-of-time causality (no future leakage from unclosed windows)', () => {
    const startSec = 1_700_000_000;
    const deltaHours = 72;
    const deltaSec = deltaHours * HOUR;
    const endSec = startSec + 60 * DAY;
    const evalStartSec = startSec + 10 * DAY;

    // 2 completed training pairs well before evalStartSec, plus 2 noise upstream events so base rate < 1
    // Pair 3 starts at t3 = evalStartSec - 10h, so its 72h window closes at evalStartSec + 62h.
    const t1 = startSec + 1 * DAY;
    const t2 = startSec + 5 * DAY;
    const tNoise1 = startSec + 7 * DAY;
    const tNoise2 = startSec + 9 * DAY;
    const t3 = evalStartSec - 10 * HOUR;

    // Query Q1 happens at evalStartSec + 1h (BEFORE Pair 3's 72h window has closed!)
    // Even if downstream commit B3 happened at evalStartSec - 5h (or after Q1 at evalStartSec + 2h),
    // Pair 3's window [t3, t3 + 72h] is NOT closed at Q1's prediction time, so Q1 only sees 2 completed windows (< minShared=3).
    const tQ1 = evalStartSec + 1 * HOUR;
    // Query Q2 happens at t3 + 73h (AFTER Pair 3's 72h window has closed), so Q2 sees all 3 completed windows.
    const tQ2 = t3 + 73 * HOUR;

    const commitsA = [
      makeCommit({ sha: 'a1', commitTime: t1, files: ['schemas/order.yaml'] }),
      makeCommit({ sha: 'a2', commitTime: t2, files: ['schemas/order.yaml'] }),
      makeCommit({ sha: 'n1', commitTime: tNoise1, files: ['schemas/unrelated1.yaml'] }),
      makeCommit({ sha: 'n2', commitTime: tNoise2, files: ['schemas/unrelated2.yaml'] }),
      makeCommit({ sha: 'a3', commitTime: t3, files: ['schemas/order.yaml'] }),
      makeCommit({ sha: 'q1', commitTime: tQ1, files: ['schemas/order.yaml'] }),
      makeCommit({ sha: 'q2', commitTime: tQ2, files: ['schemas/order.yaml'] }),
    ];

    const commitsB = [
      makeCommit({ sha: 'b1', commitTime: t1 + 2 * HOUR, files: ['src/orders.ts'] }),
      makeCommit({ sha: 'b2', commitTime: t2 + 2 * HOUR, files: ['src/orders.ts'] }),
      // B3 occurs AFTER Q1 (at tQ1 + 2h, still inside a3's 72h window). Must never leak into Q1!
      makeCommit({ sha: 'b3', commitTime: tQ1 + 2 * HOUR, files: ['src/orders.ts'] }),
      makeCommit({ sha: 'b4', commitTime: tQ2 + 4 * HOUR, files: ['src/orders.ts'] }),
    ];

    const resAtQ1Only = evaluateWalkForward({
      commitsA: commitsA.slice(0, 6), // up to q1
      commitsB,
      startSec,
      endSec,
      evalStartSec,
      deltaHours,
      minShared: 3,
      minWilsonLow: 0.1,
      minLift: 1.1,
    });

    assert.equal(resAtQ1Only.eligibleUpstreamEvents, 1);
    assert.equal(
      resAtQ1Only.queriesWithPrediction,
      0,
      'Q1 must not fire because the 3rd training window (t3 + 72h) has not closed at tQ1',
    );

    const resWithQ2 = evaluateWalkForward({
      commitsA,
      commitsB,
      startSec,
      endSec,
      evalStartSec,
      deltaHours,
      minShared: 3,
      minWilsonLow: 0.1,
      minLift: 1.1,
    });

    assert.equal(resWithQ2.eligibleUpstreamEvents, 2);
    assert.equal(
      resWithQ2.queriesWithPrediction,
      1,
      'Q2 fires once the 3rd training window (t3 + 72h <= tQ2) has closed',
    );
    assert.equal(resWithQ2.correctSuggestions, 1);
    assert.equal(resWithQ2.precisionAtK, 1);
  });

  it('right-censors upstream events inside (T_end - delta, T_end] and excludes simultaneous timestamps', () => {
    const startSec = 1_700_000_000;
    const deltaHours = 72;
    const endSec = startSec + 30 * DAY;
    const evalStartSec = startSec + 15 * DAY;

    const tEligible = endSec - 73 * HOUR; // > 72h before endSec -> eligible
    const tCensored1 = endSec - 71 * HOUR; // < 72h before endSec -> right-censored
    const tCensored2 = endSec - 1 * HOUR; // < 72h before endSec -> right-censored

    const commitsA = [
      makeCommit({ sha: 'el1', commitTime: tEligible, files: ['proto/trace.proto'] }),
      makeCommit({ sha: 'ce1', commitTime: tCensored1, files: ['proto/trace.proto'] }),
      makeCommit({ sha: 'ce2', commitTime: tCensored2, files: ['proto/trace.proto'] }),
    ];

    // Simultaneous commit at exact same second `tEligible` must NOT count as a follow-up in (t_A, t_A + delta]
    const commitsB = [
      makeCommit({ sha: 'sim1', commitTime: tEligible, files: ['src/trace.ts'] }),
    ];

    const res = evaluateWalkForward({
      commitsA,
      commitsB,
      startSec,
      endSec,
      evalStartSec,
      deltaHours,
    });

    assert.equal(res.eligibleUpstreamEvents, 1);
    assert.equal(res.censoredEvents, 2);
    assert.equal(
      res.activeDownstreamWindows,
      0,
      'Simultaneous timestamp (t_B === t_A) must not count as prospective follow-up',
    );
  });

  it('classifies confounders and filters non-manual changes in manual_only mode', () => {
    assert.equal(classifyFilePath('src/resources/Customers.ts', 'stripe/stripe-node'), 'generated');
    assert.equal(classifyFilePath('src/RequestSender.ts', 'stripe/stripe-node'), 'manual');
    assert.equal(classifyFilePath('pkg/apis/core/v1/zz_generated.deepcopy.go'), 'generated');
    assert.equal(classifyFilePath('package.json'), 'dependency_or_version');

    const botSyncCommit = makeCommit({
      sha: 'm1',
      commitTime: 1000,
      files: ['kubernetes/typed/core/v1/pod.go'],
      authorName: 'Kubernetes Prow Robot',
      committerName: 'k8s-publishing-bot',
      subject: 'Merge pull request #123 from kubernetes/sync',
      repoId: 'kubernetes/client-go',
    });
    assert.equal(botSyncCommit.category, 'mirrored');

    // Build a synthetic history where coupling ONLY exists on generated files
    const startSec = 1_700_000_000;
    const endSec = startSec + 80 * DAY;
    const evalStartSec = startSec + 50 * DAY;
    const commitsA = [];
    const commitsB = [];

    for (let i = 1; i <= 5; i++) {
      const t = startSec + i * 8 * DAY;
      commitsA.push(makeCommit({ sha: `a${i}`, commitTime: t, files: ['openapi/spec3.yaml'] }));
      commitsB.push(
        makeCommit({
          sha: `b${i}`,
          commitTime: t + 2 * HOUR,
          files: ['src/resources/Customers.ts'],
          repoId: 'stripe/stripe-node',
        }),
      );
      // Noise upstream event 4 days later (> 72h away from next b_{i+1}) so lift > 1.5
      commitsA.push(makeCommit({ sha: `na${i}`, commitTime: t + 4 * DAY, files: ['openapi/other.yaml'] }));
    }

    const tEval = evalStartSec + 2 * DAY;
    commitsA.push(makeCommit({ sha: 'aeval', commitTime: tEval, files: ['openapi/spec3.yaml'] }));
    commitsB.push(
      makeCommit({
        sha: 'beval',
        commitTime: tEval + 3 * HOUR,
        files: ['src/resources/Customers.ts'],
        repoId: 'stripe/stripe-node',
      }),
    );

    const allRes = evaluateWalkForward({
      commitsA,
      commitsB,
      repoAId: 'stripe/openapi',
      repoBId: 'stripe/stripe-node',
      startSec,
      endSec,
      evalStartSec,
      deltaHours: 72,
      targetScope: 'all',
    });
    const manualRes = evaluateWalkForward({
      commitsA,
      commitsB,
      repoAId: 'stripe/openapi',
      repoBId: 'stripe/stripe-node',
      startSec,
      endSec,
      evalStartSec,
      deltaHours: 72,
      targetScope: 'manual_only',
    });

    assert.equal(allRes.queriesWithPrediction, 1);
    assert.equal(allRes.precisionAtK, 1);
    assert.equal(
      manualRes.queriesWithPrediction,
      0,
      'manual_only must exclude generated resource targets',
    );
  });

  it('enforces shared contract tokens in explicit_ref mode and destroys coupling in shuffled control', () => {
    const tokensA = extractContractTokens('opentelemetry/proto/metrics/v1/metrics.proto');
    const tokensB = extractContractTokens('packages/otlp-transformer/src/metrics/internal.ts');
    const tokensUnrelated = extractContractTokens('packages/sdk-logs/src/export/BatchLogRecordProcessor.ts');

    assert.ok(tokensA.includes('stem:metric'));
    assert.ok(tokensB.includes('stem:metric'));
    assert.ok(!tokensUnrelated.includes('stem:metric'));

    const startSec = 1_700_000_000;
    const endSec = startSec + 80 * DAY;
    const evalStartSec = startSec + 50 * DAY;
    const commitsA = [];
    const commitsB = [];

    for (let i = 1; i <= 5; i++) {
      const t = startSec + i * 8 * DAY;
      commitsA.push(
        makeCommit({
          sha: `a${i}`,
          commitTime: t,
          files: ['opentelemetry/proto/metrics/v1/metrics.proto'],
        }),
      );
      commitsB.push(
        makeCommit({
          sha: `b${i}`,
          commitTime: t + 4 * HOUR,
          files: [
            'packages/otlp-transformer/src/metrics/internal.ts',
            'packages/sdk-logs/src/export/BatchLogRecordProcessor.ts',
          ],
        }),
      );
      commitsA.push(
        makeCommit({
          sha: `noise${i}`,
          commitTime: t + 4 * DAY,
          files: ['opentelemetry/proto/common/v1/common.proto'],
        }),
      );
    }

    const tEval = evalStartSec + 2 * DAY;
    commitsA.push(
      makeCommit({
        sha: 'evalA',
        commitTime: tEval,
        files: ['opentelemetry/proto/metrics/v1/metrics.proto'],
      }),
    );
    commitsB.push(
      makeCommit({
        sha: 'evalB',
        commitTime: tEval + 5 * HOUR,
        files: ['packages/otlp-transformer/src/metrics/internal.ts'],
      }),
    );

    const explicitRes = evaluateWalkForward({
      commitsA,
      commitsB,
      startSec,
      endSec,
      evalStartSec,
      deltaHours: 72,
      method: 'explicit_ref',
    });

    assert.equal(explicitRes.queriesWithPrediction, 1);
    assert.equal(explicitRes.totalSuggestions, 1, 'explicit_ref only suggests the token-matching metrics file');
    assert.equal(explicitRes.precisionAtK, 1);

    const shuffledB = buildShuffledDownstreamCommits(commitsB, startSec, endSec, 25 * DAY);
    assert.equal(shuffledB.length, commitsB.length);
    const shuffledRes = evaluateWalkForward({
      commitsA,
      commitsB: shuffledB,
      startSec,
      endSec,
      evalStartSec,
      deltaHours: 72,
      method: 'explicit_ref',
    });
    assert.equal(shuffledRes.precisionAtK, 0, 'Shuffled control breaks planted short-horizon coupling');
  });

  it('computes valid Wilson 95% intervals', () => {
    const zero = wilsonInterval(0, 0);
    assert.deepEqual(zero, { center: 0, low: 0, high: 0 });
    const half = wilsonInterval(50, 100);
    assert.ok(half.low > 0.4 && half.low < 0.5);
    assert.ok(half.high > 0.5 && half.high < 0.6);
  });

  it('recognizes Kubernetes Publisher committer as mirrored and evaluates GO / NOT YET / NO-GO overlap', () => {
    const k8sPublisherCommit = makeCommit({
      sha: 'kp1',
      commitTime: 1000,
      files: ['tools/events/event_broadcaster.go'],
      authorName: 'Human Contributor',
      committerName: 'Kubernetes Publisher',
      subject: 'client-go: avoid holding lock',
      repoId: 'kubernetes/client-go',
    });
    assert.equal(k8sPublisherCommit.category, 'mirrored');

    // Sparse only (< 2 pairs with N >= 30, no qualifying negative pair) -> NOT YET
    const sparseOnly = computeOverallDecision([
      {
        runs: [{ targetScope: 'manual_only', sampleSizeGatePassed: false, status: 'INCONCLUSIVE (sparse data)', liftOverStrongestBaseline: 0 }],
      },
    ]);
    assert.equal(sparseOnly.operationalDecision, 'NOT YET');
    assert.equal(sparseOnly.preregisteredRuleStatus, 'NOT YET');

    // 1 pair reaches N >= 30 with lift < 1.2 -> NO-GO_AND_NOT_YET_OVERLAP (operational NO-GO)
    const overlap = computeOverallDecision([
      {
        runs: [{ targetScope: 'manual_only', sampleSizeGatePassed: true, status: 'NO-GO', liftOverStrongestBaseline: 0.69 }],
      },
      {
        runs: [{ targetScope: 'manual_only', sampleSizeGatePassed: false, status: 'INCONCLUSIVE (sparse data)', liftOverStrongestBaseline: 0 }],
      },
    ]);
    assert.equal(overlap.operationalDecision, 'NO-GO');
    assert.equal(overlap.preregisteredRuleStatus, 'NO-GO_AND_NOT_YET_OVERLAP');
    assert.equal(overlap.notYetConditionMet, true);
    assert.equal(overlap.noGoConditionMet, true);

    // 2 pairs reach N >= 30 and pass GO -> GO
    const goDecision = computeOverallDecision([
      {
        runs: [{ targetScope: 'manual_only', sampleSizeGatePassed: true, status: 'GO', liftOverStrongestBaseline: 1.8 }],
      },
      {
        runs: [{ targetScope: 'manual_only', sampleSizeGatePassed: true, status: 'GO', liftOverStrongestBaseline: 2.1 }],
      },
    ]);
    assert.equal(goDecision.operationalDecision, 'GO');
    assert.equal(goDecision.preregisteredRuleStatus, 'GO');
  });

  it('verifies REPORT.md is generated deterministically from results.json and diagnostics.json', () => {
    const results = JSON.parse(readFileSync(join(MULTI_REPO_DIR, 'results.json'), 'utf8'));
    const diagnostics = JSON.parse(readFileSync(join(MULTI_REPO_DIR, 'diagnostics.json'), 'utf8'));
    const reportOnDisk = readFileSync(join(MULTI_REPO_DIR, 'REPORT.md'), 'utf8').replace(/\r\n/g, '\n');
    const expected = buildReportMarkdown(results, diagnostics);

    assert.equal(reportOnDisk, expected, 'REPORT.md must match buildReportMarkdown(results, diagnostics) byte-for-byte');
    assert.ok(
      reportOnDisk.includes('**0.4577** (287/627)'),
      'REPORT.md must contain the exact Stripe 168h temporal/all row from results.json (287/627 = 0.4577)',
    );
  });
});
