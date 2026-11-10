import { commitUrl, fileUrl, mdCell, mdCode, mdText, short } from '../render/escape.ts';
import {
  UNGATED_POLICY_LABEL,
  type BaselineAggregateSummary,
  type BaselineName,
  type BenchResultsModel,
  type BootstrapInterval,
  type ExemplarQuestion,
  OUTCOME_NAMES,
  type OutcomeName,
  type PolicyAggregateSummary,
  type ProportionMetric,
} from './model.ts';
import { sanitizeAuthorName, sanitizePath, sanitizeText } from './sanitize.ts';
import { assertValidBenchResults } from './validate.ts';

export const MAX_BENCH_MD_BYTES = 64 * 1024;

function fmtProportion(m: ProportionMetric): string {
  if (m.denominator === 0 || m.rate === null || m.interval === null) {
    return `${m.numerator} / ${m.denominator} (N/A)`;
  }
  return `${m.numerator} / ${m.denominator} (${m.rate}, [${m.interval.low}, ${m.interval.high}])`;
}

function fmtBootstrap(b: BootstrapInterval | null): string {
  if (!b) return 'N/A';
  return `[${b.low}, ${b.high}] (median ${b.median}, n=${b.resamples}, seed=${b.seed})`;
}

function fmtLift(lift: number | null): string {
  return lift === null ? 'N/A' : `×${lift}`;
}

function safeMdQuestion(raw: string): string {
  const clean = sanitizeText(raw, 320);
  return clean
    .split(/(`[^`]*`)/)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 1
        ? mdCode(sanitizePath(part.slice(1, -1), 160))
        : mdText(part),
    )
    .join('');
}

function renderPolicySection(
  summary: PolicyAggregateSummary,
  headingPrefix: string,
): string[] {
  const lines: string[] = [];
  const cov = summary.coverage;
  const out = summary.outcomes;
  const acc = summary.accuracyProxy;
  const missed = summary.missedFollowUps;

  lines.push(`${headingPrefix} Coverage & Salience (${mdCode(summary.policy)} — ${mdText(summary.policyLabel)})`);
  lines.push('');
  lines.push(`- **Sample status:** ${mdCode(summary.sampleStatus)}`);
  lines.push(`- **PRs evaluated:** ${cov.prsEvaluated}`);
  lines.push(`- **PRs scored:** ${cov.prsScored}`);
  lines.push(`- **PRs with questions:** ${fmtProportion(cov.prsWithQuestions)}`);
  lines.push(`- **Total questions:** ${cov.questionsTotal} (per PR: ${cov.questionsPerPr === null ? 'N/A' : cov.questionsPerPr})`);
  lines.push(`- **Salience \`quiet\`:** ${fmtProportion(cov.salienceDistribution.quiet)}`);
  lines.push(`- **Salience \`brief\`:** ${fmtProportion(cov.salienceDistribution.brief)}`);
  lines.push(`- **Salience \`full\` (full-salience share):** ${fmtProportion(cov.fullSalienceShare)}`);
  lines.push('');

  lines.push(`${headingPrefix} Observational Outcomes (${mdCode(summary.policy)})`);
  lines.push('');
  lines.push('| Outcome | Target Count |');
  lines.push('|---|---:|');
  lines.push(`| \`followedUp\` | ${out.followedUp} |`);
  lines.push(`| \`notFollowedUp\` | ${out.notFollowedUp} |`);
  lines.push(`| \`censored\` | ${out.censored} |`);
  lines.push(`| \`targetDeleted\` | ${out.targetDeleted} |`);
  lines.push(`| \`targetRenamed\` | ${out.targetRenamed} |`);
  lines.push(`| \`resolvedAtMerge\` | ${out.resolvedAtMerge} |`);
  lines.push(`| \`unscorable\` | ${out.unscorable} |`);
  lines.push(`| Shared follow-up outcomes across PR windows | ${out.sharedFollowUpOutcomes} |`);
  lines.push('');

  lines.push(`${headingPrefix} Follow-Up Proxy Metrics (${mdCode(summary.policy)})`);
  lines.push('');
  lines.push('| Metric | Numerator / Denominator (Rate, Wilson CI) | PR-Clustered Bootstrap CI |');
  lines.push('|---|---|---|');
  lines.push(
    `| File-level follow-up precision | ${mdCell(fmtProportion(acc.fileLevelFollowUpPrecision))} | ${mdCell(fmtBootstrap(acc.bootstrapFilePrecisionCi))} |`,
  );
  lines.push(`| Question-level follow-up rate | ${mdCell(fmtProportion(acc.questionLevelFollowUpRate))} | — |`);
  lines.push(`| \`forgotten-companion\` Precision@1 | ${mdCell(fmtProportion(acc.precisionAt1))} | — |`);
  lines.push(`| \`forgotten-companion\` Precision@3 | ${mdCell(fmtProportion(acc.precisionAt3))} | — |`);
  lines.push(`| Same-author follow-up rate | ${mdCell(fmtProportion(acc.sameAuthorFollowUpRate))} | — |`);
  lines.push(`| Same-author share of \`followedUp\` | ${mdCell(fmtProportion(acc.sameAuthorShareOfFollowedUp))} | — |`);
  lines.push(`| RA-signal follow-up rate | ${mdCell(fmtProportion(acc.raSignalFollowUpRate))} | — |`);
  lines.push(`| Missed co-change follow-up recall proxy | ${mdCell(fmtProportion(missed.recallProxy))} | — |`);
  lines.push('');
  lines.push(`_${mdText(acc.precisionAt3Note)}_`);
  lines.push(
    `_Missed co-change follow-ups: ${missed.missedFilesTotal} untouched historical co-change partner(s) across ${missed.prsWithMissedFollowUp} PR(s) changed within the observation window without a Gutter question._`,
  );
  lines.push('');

  return lines;
}

function renderBaselinesTable(summary: PolicyAggregateSummary): string[] {
  const lines: string[] = [];
  const hl = summary.headlineBaseline;
  lines.push(
    `- **Strongest baseline (${mdCode(summary.policy)}):** ${hl.strongestBaseline ? mdCode(hl.strongestBaseline) : 'N/A'} · **Headline lift:** ${fmtLift(hl.lift)} · **Bootstrap CI:** ${fmtBootstrap(hl.bootstrapLiftCi)}`,
  );
  lines.push('');
  lines.push(
    '| Baseline | Proposed | Shortfall PRs (Slots) | File-Level Follow-Up | Question-Level Hit Rate | Same-Author Rate | Lift vs Baseline | Bootstrap Lift CI |',
  );
  lines.push('|---|---:|---|---:|---:|---:|---:|---|');
  const order: BaselineName[] = ['popular', 'popular-near', 'recent'];
  for (const name of order) {
    const b: BaselineAggregateSummary = summary.baselines[name];
    lines.push(
      `| ${mdCell(mdCode(b.baseline))} | ${b.proposedTargets} | ${b.shortfallPrs} (${b.shortfallTargets}) | ${mdCell(fmtProportion(b.fileLevelFollowUp))} | ${mdCell(fmtProportion(b.questionLevelHitRate))} | ${mdCell(fmtProportion(b.sameAuthorFollowUpRate))} | ${fmtLift(b.liftVsBaseline)} | ${mdCell(fmtBootstrap(b.bootstrapLiftCi))} |`,
    );
  }
  lines.push('');
  lines.push(...renderOutcomeLiftTable(summary));
  return lines;
}

const OUTCOME_LABELS: Record<OutcomeName, string> = {
  followUp: 'Any follow-up',
  sameAuthor: 'Same-author follow-up',
  raSignal: 'RA-signal follow-up',
};

function outcomeRate(b: BaselineAggregateSummary, outcome: OutcomeName): ProportionMetric | undefined {
  if (outcome === 'followUp') return b.fileLevelFollowUp;
  if (outcome === 'sameAuthor') return b.sameAuthorFollowUpRate;
  return b.raSignalFollowUpRate;
}

/** GU-04 Stage 0: every baseline on every outcome, with lift per outcome vs that outcome's strongest baseline. */
function renderOutcomeLiftTable(summary: PolicyAggregateSummary): string[] {
  const byOutcome = summary.headlineBaseline.byOutcome;
  if (!byOutcome) return [];
  const acc = summary.accuracyProxy;
  const policyRate: Record<OutcomeName, ProportionMetric> = {
    followUp: acc.fileLevelFollowUpPrecision,
    sameAuthor: acc.sameAuthorFollowUpRate,
    raSignal: acc.raSignalFollowUpRate,
  };
  const lines: string[] = [];
  lines.push(`**Lift by outcome (${mdCode(summary.policy)}).** Each outcome picks its own strongest baseline.`);
  lines.push('');
  lines.push('| Outcome | Gutter | `popular` | `popular-near` | `recent` | Strongest | Lift | Bootstrap Lift CI |');
  lines.push('|---|---|---|---|---|---|---:|---|');
  for (const outcome of OUTCOME_NAMES) {
    const hl = byOutcome[outcome];
    const cells = (['popular', 'popular-near', 'recent'] as const).map((name) => {
      const m = outcomeRate(summary.baselines[name], outcome);
      return m ? mdCell(fmtProportion(m)) : 'N/A';
    });
    lines.push(
      `| ${OUTCOME_LABELS[outcome]} | ${mdCell(fmtProportion(policyRate[outcome]))} | ${cells.join(' | ')} | ${hl.strongestBaseline ? mdCode(hl.strongestBaseline) : 'N/A'} | ${fmtLift(hl.lift)} | ${mdCell(fmtBootstrap(hl.bootstrapCi))} |`,
    );
  }
  lines.push('');
  return lines;
}

function renderBreakdowns(summary: PolicyAggregateSummary): string[] {
  const lines: string[] = [];
  lines.push('### Breakdown by Checklist Kind (`production`)');
  lines.push('');
  lines.push(
    '| Kind | Questions | Scored Questions | Question Follow-Up Rate | Scored Targets | File Follow-Up Precision | Same-Author Rate |',
  );
  lines.push('|---|---:|---:|---|---|---:|---|');
  const kinds = [
    'broken-import',
    'forgotten-companion',
    'family-drift',
    'untested-change',
    'wide-surface',
  ] as const;
  for (const k of kinds) {
    const row = summary.breakdowns.byKind[k];
    lines.push(
      `| ${mdCell(mdCode(row.kind))} | ${row.questions} | ${row.scoredQuestions} | ${mdCell(fmtProportion(row.questionFollowUpRate))} | ${row.scoredTargets} | ${mdCell(fmtProportion(row.fileFollowUpPrecision))} | ${mdCell(fmtProportion(row.sameAuthorFollowUpRate))} |`,
    );
  }
  lines.push('');

  lines.push('### Breakdown by `interval.low` Bucket (`production`)');
  lines.push('');
  lines.push('| Bucket | Targets | Scored Targets | File Follow-Up Precision | Same-Author Rate |');
  lines.push('|---|---:|---:|---|---|');
  const buckets = ['0-0.3', '0.3-0.5', '0.5+'] as const;
  for (const bucket of buckets) {
    const row = summary.breakdowns.byIntervalLow[bucket];
    lines.push(
      `| ${mdCell(mdCode(row.bucket))} | ${row.targets} | ${row.scoredTargets} | ${mdCell(fmtProportion(row.fileFollowUpPrecision))} | ${mdCell(fmtProportion(row.sameAuthorFollowUpRate))} |`,
    );
  }
  lines.push('');

  lines.push('### Breakdown by Confounder Slice (`production`)');
  lines.push('');
  lines.push('| Slice | PRs Evaluated | Scored Targets | File Follow-Up Precision |');
  lines.push('|---|---:|---:|---|');
  const slices = [
    'cleanManual',
    'botOrAgentOrigin',
    'generatedPaths',
    'dependencyOrVersionOnly',
    'largeSweep50Plus',
  ] as const;
  for (const s of slices) {
    const row = summary.breakdowns.byConfounder[s];
    lines.push(
      `| ${mdCell(mdCode(row.slice))} | ${row.prsEvaluated} | ${row.scoredTargets} | ${mdCell(fmtProportion(row.fileFollowUpPrecision))} |`,
    );
  }
  lines.push('');
  return lines;
}

function renderExemplarList(
  items: readonly ExemplarQuestion[],
  repoUrl: string | null,
): string[] {
  if (items.length === 0) {
    return ['_None in this run._', ''];
  }
  const lines: string[] = [];
  for (const ex of items.slice(0, 5)) {
    const headShort = short(ex.headSha);
    const headLinkUrl = commitUrl(repoUrl ?? undefined, ex.headSha);
    const headRef = headLinkUrl ? `[${mdCode(headShort)}](${headLinkUrl})` : mdCode(headShort);

    const targetPath = sanitizePath(ex.targetFile, 160);
    const targetLinkUrl = fileUrl(repoUrl ?? undefined, ex.headSha, targetPath);
    const targetRef = targetLinkUrl ? `[${mdCode(targetPath)}](${targetLinkUrl})` : mdCode(targetPath);

    const authors = ex.authorNames.length
      ? ex.authorNames.map((a) => mdText(sanitizeAuthorName(a))).join(', ')
      : 'unknown';

    let outcomeDetail = `outcome: ${mdCode(ex.status)}`;
    if (ex.followUpCommitSha) {
      const fuShort = short(ex.followUpCommitSha);
      const fuUrl = commitUrl(repoUrl ?? undefined, ex.followUpCommitSha);
      const fuRef = fuUrl ? `[${mdCode(fuShort)}](${fuUrl})` : mdCode(fuShort);
      outcomeDetail += ` in ${fuRef} (${ex.delayHours ?? 0}h, sameAuthor=${String(ex.sameAuthor)})`;
    }

    lines.push(
      `- **${mdText(sanitizeText(ex.prId, 40))}** (${headRef}) · ${mdText(sanitizeText(ex.subject, 140))} · author(s): ${authors}`,
    );
    lines.push(
      `  - Question (${mdCode(ex.kind)}, intervalLow=${ex.intervalLow === null ? 'N/A' : ex.intervalLow}): ${safeMdQuestion(ex.question)}`,
    );
    lines.push(`  - Target: ${targetRef} · ${outcomeDetail}`);
  }
  lines.push('');
  return lines;
}

/**
 * Render `bench.md` strictly from the schema-validated `BenchResultsModel`.
 */
export function renderBenchMarkdown(model: BenchResultsModel, maxBytes: number = MAX_BENCH_MD_BYTES): string {
  assertValidBenchResults(model);

  const repoName = mdText(sanitizeText(model.repo.name, 100));
  const branch = mdCode(sanitizeText(model.repo.branch, 100));
  const headShort = short(model.repo.headSha);
  const headUrl = commitUrl(model.repo.remoteUrl ?? undefined, model.repo.headSha);
  const headLink = headUrl ? `[${mdCode(headShort)}](${headUrl})` : mdCode(headShort);

  const lines: string[] = [];
  lines.push(`# Gutter Benchmark Report · ${repoName}`);
  lines.push('');
  lines.push(
    `Branch: ${branch} · Head: ${headLink} (${mdCode(model.repo.headSha)}) · Generated: ${mdCode(model.generatedAt)} · ` +
      `Gutter ${mdCode(model.tools.gutter)} + Repo Archaeology ${mdCode(model.tools.repoArchaeology)} · ` +
      `schemaVersion ${model.schemaVersion} · scoringVersion ${model.scoringVersion}`,
  );
  lines.push('');

  lines.push('## Gate Check');
  lines.push('');
  lines.push('```text');
  lines.push(model.gates.fullSalienceShare.line);
  lines.push(model.gates.gateAUsefulness.line);
  lines.push('```');
  lines.push('');

  lines.push('## Change-Unit Discovery & Eligibility Funnel');
  lines.push('');
  const f = model.funnel;
  lines.push('| Stage / Bucket | Count | Notes |');
  lines.push('|---|---:|---|');
  lines.push(`| First-parent commits discovered | ${f.discovered} | \`git rev-list --first-parent\` on ${branch} |`);
  lines.push(`| Classified: \`merge-commit\` (\`high\`) | ${f.classified.mergeCommitHigh} | 2 parents, \`Merge pull request #n\` |`);
  lines.push(`| Classified: \`merge-commit\` (\`medium\`) | ${f.classified.mergeCommitMedium} | 2 parents, unnumbered merge |`);
  lines.push(`| Classified: \`squash-subject\` (\`medium\`) | ${f.classified.squashMedium} | 1 parent, subject ends with \`(#n)\` |`);
  lines.push(`| Classified: \`octopus\` (skipped) | ${f.classified.octopus} | > 2 parents |`);
  lines.push(`| Classified: \`not-a-pr\` (skipped) | ${f.classified.notAPr} | Direct pushes / rebase commits without \`(#n)\` |`);
  lines.push(`| Classified: \`change-unit\` (\`low\`) | ${f.classified.changeUnitLow} | Separate unnumbered pool (\`--include-unnumbered\`) |`);
  lines.push(`| Eligible PRs | ${f.eligible} | Passed classification, \`--since\`, merge-base, non-empty diff |`);
  lines.push(`| Evaluated PRs | ${f.evaluated} | Newest \`--prs ${model.settings.prsLimit}\` with available history |`);
  lines.push(`| Scored PRs (\`production\`) | ${f.scored} | ≥ 1 scorable question with observed ${model.settings.windowDays}-day window |`);
  if (model.settings.includeUnnumbered) {
    lines.push(
      `| Unnumbered \`change-unit\` funnel (never pooled) | ${f.changeUnitsDiscovered} → ${f.changeUnitsEligible} → ${f.changeUnitsEvaluated} → ${f.changeUnitsScored} | Discovered → eligible → evaluated → scored |`,
    );
  }
  lines.push('');

  lines.push('### Funnel Exclusions');
  lines.push('');
  lines.push('| Exclusion Reason | Count |');
  lines.push('|---|---:|');
  lines.push(`| \`octopus\` | ${f.exclusions.octopus} |`);
  lines.push(`| \`notAPr\` | ${f.exclusions.notAPr} |`);
  lines.push(`| \`rootCommit\` | ${f.exclusions.rootCommit} |`);
  lines.push(`| \`beforeSince\` | ${f.exclusions.beforeSince} |`);
  lines.push(`| \`missingMergeBase\` | ${f.exclusions.missingMergeBase} |`);
  lines.push(`| \`emptyDiff\` | ${f.exclusions.emptyDiff} |`);
  lines.push(`| \`beyondPrsLimit\` | ${f.exclusions.beyondPrsLimit} |`);
  lines.push(`| \`historyUnavailable\` | ${f.exclusions.historyUnavailable} |`);
  lines.push(`| \`noQuestions\` | ${f.exclusions.noQuestions} |`);
  lines.push(`| \`unscorableOnly\` | ${f.exclusions.unscorableOnly} |`);
  lines.push(`| \`resolvedAtMergeOnly\` | ${f.exclusions.resolvedAtMergeOnly} |`);
  lines.push(`| \`censored\` | ${f.exclusions.censored} |`);
  lines.push('');

  lines.push('## Production Policy Summary (`production`)');
  lines.push('');
  lines.push(...renderPolicySection(model.aggregates.production, '###'));

  lines.push('## Baseline Comparison');
  lines.push('');
  lines.push('### Production Policy vs. Matched As-Of Baselines');
  lines.push('');
  lines.push(...renderBaselinesTable(model.aggregates.production));

  lines.push(...renderBreakdowns(model.aggregates.production));

  lines.push(`## Ungated Research Section (\`ungated\` — ${UNGATED_POLICY_LABEL})`);
  lines.push('');
  lines.push(
    `> **${UNGATED_POLICY_LABEL}:** The \`ungated\` policy bypasses per-repo backtest calibration to measure raw co-change and static signals. Its numbers must never be reported as Gutter product precision.`,
  );
  lines.push('');
  lines.push(...renderPolicySection(model.aggregates.ungated, '###'));
  lines.push('### Ungated Policy vs. Matched As-Of Baselines (`research: not product behavior`)');
  lines.push('');
  lines.push(...renderBaselinesTable(model.aggregates.ungated));

  if (model.changeUnits.aggregates) {
    lines.push('### Unnumbered Change-Units Pool (`low` confidence — reported separately, never pooled with PRs)');
    lines.push('');
    lines.push(...renderPolicySection(model.changeUnits.aggregates.production, '####'));
  }

  lines.push('## Five Best and Five Worst Questions (`production`)');
  lines.push('');
  lines.push('### Five Best Questions (`followedUp` within observation window)');
  lines.push('');
  lines.push(...renderExemplarList(model.aggregates.production.exemplars.bestQuestions, model.repo.remoteUrl));
  lines.push('### Five Worst Questions (`notFollowedUp` despite high confidence)');
  lines.push('');
  lines.push(...renderExemplarList(model.aggregates.production.exemplars.worstQuestions, model.repo.remoteUrl));

  lines.push('## Runtime per Stage');
  lines.push('');
  lines.push(`Total wall time: **${model.timings.totalWallMs} ms**`);
  lines.push('');
  lines.push('| Stage | Count | Total (ms) | p50 (ms) | p95 (ms) |');
  lines.push('|---|---:|---:|---:|---:|');
  const stageOrder = ['discovery', 'sessionOpen', 'staticAnalysis', 'brief', 'scoring', 'report'] as const;
  for (const st of stageOrder) {
    const row = model.timings.stages[st];
    lines.push(`| ${mdCell(mdCode(st))} | ${row.count} | ${row.totalMs} | ${row.p50Ms} | ${row.p95Ms} |`);
  }
  lines.push('');

  lines.push('## Methodology Limits');
  lines.push('');
  lines.push(
    `- **Commits ≠ pull requests:** Offline discovery walks first-parent commits on ${branch}. Rebase-merged PRs carry no merge parent or \`(#n)\` suffix and are excluded as \`not-a-pr\`, while cherry-picks or edited subjects carrying \`(#n)\` are classified with \`medium\` confidence.`,
  );
  lines.push(
    `- **Observational outcomes, not ground-truth defects:** A \`followedUp\` outcome within the ${model.settings.windowDays}-day window records that a target file changed later on the first-parent branch. Planned multi-PR splits and unrelated feature work can touch the same file; conversely, a real omission that went unfixed in ${model.settings.windowDays} days is recorded as \`notFollowedUp\`.`,
  );
  lines.push(
    '- **Gate A (`UNVERIFIED`):** Whether Gutter questions are genuinely useful is judged by human review labels in GU-04, never by automated follow-up proxy rates.',
  );
  lines.push(
    `- **Right-censoring:** PRs whose ${model.settings.windowDays}-day post-merge window extends past the newest commit on ${branch} without an earlier hit are marked \`censored\` and excluded from precision denominators.`,
  );
  lines.push(
    `- **Strictly as-of replay & baselines:** Every question, calibration checkpoint (\`--calibration-every ${model.settings.calibrationEvery}\`), and baseline proposal (\`popular\`, \`popular-near\`, \`recent\`) is computed strictly from git ancestry available at that PR.`,
  );

  let output = lines.join('\n') + '\n';
  if (Buffer.byteLength(output, 'utf8') > maxBytes) {
    const suffix = '\n\n_[Report truncated to size cap.]_\n';
    const trimmedLines = [...lines];
    while (trimmedLines.length > 0 && Buffer.byteLength(trimmedLines.join('\n') + suffix, 'utf8') > maxBytes) {
      trimmedLines.pop();
    }
    output = trimmedLines.join('\n') + suffix;
  }
  return output;
}
