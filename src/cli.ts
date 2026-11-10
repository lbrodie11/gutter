#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildBrief } from './brief.ts';
import { parseGutterConfigObject, type GutterConfig } from './config.ts';
import type { GutterBrief } from './contract.ts';
import { renderCompareLabelHtml, sampleCompare, type CompareSource } from './bench/label.ts';
import type { BenchResultsModel } from './bench/model.ts';
import { runBench } from './bench/runner.ts';
import { validateBenchResults } from './bench/validate.ts';
import { summaryLine, writeBrief } from './output.ts';
import { renderComic, lintPage } from './render/comic.ts';
import { renderMarkdown } from './render/markdown.ts';
import { loadJson, type RaBacktest, type RaDiff } from './sources/archaeology.ts';
import { RaLibUnavailableError } from './sources/archaeology-lib.ts';
import { GUTTER_VERSION } from './version.ts';

const HELP = `gutter ${GUTTER_VERSION}: a one-page, evidence-backed briefing for a change

Usage
  gutter brief --base <ref> [options]     analyze <base>...HEAD and write gutter.json, brief.md, gutter.html
  gutter bench [options]                  replay merged PRs as-of each PR and write bench.json, bench.md, bench.html
  gutter label --compare <bench.json> [options]   write a blinded labeling page (one self-contained HTML file)
  gutter render <gutter.json> [--format md|html]   re-render a saved brief to stdout
  gutter --version
  gutter <command> --help                 show this help

brief options
  --base <ref>            branch or commit the change is going into (required)
  --head <ref>            change tip (default HEAD; co-change history needs it checked out)
  --out <dir>             where to write the files (default .gutter)
  --print <md|json|none>  also print one rendering to stdout (default none)
  --title <text>          PR title (default: newest commit subject)
  --intent <text>         PR description excerpt
  --repo-url <url>        e.g. https://github.com/owner/repo, for links (default: from origin)
  --pr <number>           PR number, for the page header
  --ra-diff <file>        use a saved \`repo-archaeology diff --json\` result
  --ra-backtest <file>    use a saved \`repo-archaeology backtest --json\` result
  --ra-bin <path>         repo-archaeology binary or dist/cli.js (or set GUTTER_RA_BIN)
  --ra-version <spec>     npm version spec when running repo-archaeology via npx (default ^0.4.0)
  --no-history            skip co-change history entirely
  --no-calibration        skip the per-repo accuracy backtest
  --max-forgotten <n>     "usually changes with" pairs to show (default 3)

bench options
  --branch <ref>          first-parent branch to replay (default: branch at HEAD)
  --prs <n>               newest eligible PRs to replay (default: 200)
  --since <date>          exclude commits before ISO date/timestamp
  --window-days <n>       post-merge follow-up window in days (default: 7)
  --calibration-every <n> compute backtest calibration every n-th PR (default: 1)
  --include-unnumbered    evaluate unnumbered 1-parent commits in a separate pool
  --gate-full-share <n>   max full-salience share threshold (default: 0.3333)
  --proxy-min-lift <n>    min follow-up proxy lift threshold (default: 1.5)
  --config <variant.json> tuning config variant JSON file (for GU-04)
  --ra-lib <path>         local repo-archaeology >= 0.4.0 library entry path
  --no-ra-cache           disable Repo Archaeology history cache
  --resume                resume from bench.partial.jsonl in --out
  --out <dir>             output directory (default: .gutter/bench)
  --cwd <dir>             repository directory to benchmark (default: cwd)

label options
  --compare               blinded comparison: Gutter companion questions vs recent and
                          popular-near baseline proposals, rendered identically (GU-04 Stage 0)
  --sample <n>            items to draw, split 2:1:1 Gutter:recent:popular-near (default: 60)
  --seed <n>              sampling and shuffle seed (default: 1)
  --out <file>            HTML file to write (default: label-compare.html next to bench.json)
`;

const COMMANDS = new Set(['brief', 'bench', 'label', 'render']);

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === '-v' || cmd === '--version') {
    process.stdout.write(`${GUTTER_VERSION}\n`);
    return 0;
  }
  if (COMMANDS.has(cmd) && rest.some((a) => a === '-h' || a === '--help')) {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === 'brief') return brief(rest);
  if (cmd === 'bench') return await bench(rest);
  if (cmd === 'label') return label(rest);
  if (cmd === 'render') return render(rest);
  process.stderr.write(`unknown command "${cmd}"\n\n${HELP}`);
  return 2;
}

function brief(args: string[]): number {
  const { values } = parseArgs({
    args,
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
      out: { type: 'string', default: '.gutter' },
      print: { type: 'string', default: 'none' },
      title: { type: 'string' },
      intent: { type: 'string' },
      'repo-url': { type: 'string' },
      pr: { type: 'string' },
      'ra-diff': { type: 'string' },
      'ra-backtest': { type: 'string' },
      'ra-bin': { type: 'string' },
      'ra-version': { type: 'string' },
      'no-history': { type: 'boolean' },
      'no-calibration': { type: 'boolean' },
      'max-forgotten': { type: 'string' },
    },
    strict: true,
  });
  if (!values.base) {
    process.stderr.write('error: --base is required (e.g. --base main)\n');
    return 2;
  }
  const result: GutterBrief = buildBrief({
    cwd: process.cwd(),
    base: values.base,
    ...(values.head ? { head: values.head } : {}),
    ...(values.title ? { title: values.title } : {}),
    ...(values.intent ? { intent: values.intent } : {}),
    ...(values['repo-url'] ? { repoUrl: values['repo-url'] } : {}),
    ...(values.pr ? { prNumber: Number(values.pr) } : {}),
    ...(values['ra-diff'] ? { raDiff: loadJson<RaDiff>(resolve(values['ra-diff'])) } : {}),
    ...(values['ra-backtest'] ? { raBacktest: loadJson<RaBacktest>(resolve(values['ra-backtest'])) } : {}),
    runner: {
      ...(values['ra-bin'] ? { bin: resolve(values['ra-bin']) } : {}),
      ...(values['ra-version'] ? { spec: values['ra-version'] } : {}),
    },
    ...(values['no-history'] !== undefined ? { noHistory: values['no-history'] } : {}),
    ...(values['no-calibration'] !== undefined ? { noCalibration: values['no-calibration'] } : {}),
    ...(values['max-forgotten'] !== undefined
      ? {
          maxForgotten: Number.isFinite(Number(values['max-forgotten']))
            ? Math.max(0, Math.trunc(Number(values['max-forgotten'])))
            : 3,
        }
      : {}),
  });

  const paths = writeBrief(result, resolve(values.out));
  const problems = lintPage(renderComic(result));
  if (problems.length) process.stderr.write(`warning: page design-grammar issues:\n  ${problems.join('\n  ')}\n`);

  if (values.print === 'md') process.stdout.write(renderMarkdown(result));
  else if (values.print === 'json') process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  process.stderr.write(`${summaryLine(result)}\n  ${paths.json}\n  ${paths.markdown}\n  ${paths.html}\n`);
  return 0;
}

function render(args: string[]): number {
  const { values, positionals } = parseArgs({
    args,
    options: { format: { type: 'string', default: 'md' } },
    allowPositionals: true,
  });
  const file = positionals[0];
  if (!file) {
    process.stderr.write('error: render needs a gutter.json path\n');
    return 2;
  }
  const doc = JSON.parse(readFileSync(resolve(file), 'utf8')) as GutterBrief;
  if (doc.schemaVersion !== 1) {
    process.stderr.write(`error: unsupported gutter.json schemaVersion ${String(doc.schemaVersion)}\n`);
    return 2;
  }
  process.stdout.write(values.format === 'html' ? renderComic(doc) : renderMarkdown(doc));
  return 0;
}

function label(args: string[]): number {
  const { values, positionals } = parseArgs({
    args,
    options: {
      compare: { type: 'boolean', default: false },
      sample: { type: 'string', default: '60' },
      seed: { type: 'string', default: '1' },
      out: { type: 'string' },
    },
    allowPositionals: true,
    strict: true,
  });
  const file = positionals[0];
  if (!file) {
    process.stderr.write('error: label needs a bench.json path\n');
    return 2;
  }
  if (!values.compare) {
    process.stderr.write(
      'error: only --compare (blinded comparison labeling, GU-04 Stage 0) is available so far; ' +
        'the per-question labeling mode lands with the benchmark corpus\n',
    );
    return 2;
  }
  const sample = Number(values.sample);
  const seed = Number(values.seed);
  if (!Number.isInteger(sample) || sample < 4 || !Number.isInteger(seed)) {
    process.stderr.write('error: --sample must be an integer >= 4 and --seed an integer\n');
    return 2;
  }
  const benchPath = resolve(file);
  const model = JSON.parse(readFileSync(benchPath, 'utf8')) as BenchResultsModel;
  const problems = validateBenchResults(model);
  if (problems.length > 0) {
    process.stderr.write(`error: ${file} is not a valid bench.json:\n  ${problems.slice(0, 5).join('\n  ')}\n`);
    return 2;
  }
  const quarter = Math.floor(sample / 4);
  const result = sampleCompare(model, { seed, gutter: sample - 2 * quarter, recent: quarter, popularNear: quarter });
  const outPath = values.out ? resolve(values.out) : join(dirname(benchPath), 'label-compare.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderCompareLabelHtml(result), 'utf8');
  const short = (s: CompareSource) => `${result.drawn[s]}/${result.requested[s]} ${s} (pool ${result.pool[s]})`;
  process.stderr.write(
    `gutter label: ${result.items.length} blinded item(s): ${short('gutter')}, ${short('recent')}, ${short('popular-near')}; ` +
      `sample ${result.sampleId}, seed ${seed}\n  ${outPath}\n`,
  );
  return 0;
}

/** Why a `--config` variant would not run exactly as written, or undefined when it would. */
function configVariantProblem(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'must be a JSON object of .gutter.json keys';
  const parsed = parseGutterConfigObject(raw) as Record<string, unknown>;
  const rawObj = raw as Record<string, unknown>;
  const dropped = Object.keys(rawObj).filter((k) => !(k in parsed));
  if (dropped.length > 0) return `unknown or invalid key(s): ${dropped.join(', ')}`;
  const changed = Object.keys(rawObj).filter((k) => parsed[k] !== rawObj[k]);
  if (changed.length > 0) {
    return `value(s) the config parser would change: ${changed.map((k) => `${k} ${JSON.stringify(rawObj[k])} -> ${JSON.stringify(parsed[k])}`).join(', ')}`;
  }
  return undefined;
}

async function bench(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      branch: { type: 'string' },
      prs: { type: 'string', default: '200' },
      since: { type: 'string' },
      'window-days': { type: 'string', default: '7' },
      'calibration-every': { type: 'string', default: '1' },
      'include-unnumbered': { type: 'boolean', default: false },
      'gate-full-share': { type: 'string' },
      'proxy-min-lift': { type: 'string' },
      config: { type: 'string' },
      'ra-lib': { type: 'string' },
      'no-ra-cache': { type: 'boolean', default: false },
      resume: { type: 'boolean', default: false },
      out: { type: 'string', default: '.gutter/bench' },
      cwd: { type: 'string' },
    },
    strict: true,
  });

  let configVariant: GutterConfig | undefined;
  if (values.config) {
    const raw: unknown = JSON.parse(readFileSync(resolve(values.config), 'utf8'));
    // A preregistered variant must run exactly as written: refuse anything the config parser would
    // drop or change (unknown keys, invalid values, 1.5 rounded to 1), and anything that is not an object.
    const problem = configVariantProblem(raw);
    if (problem) {
      process.stderr.write(`error: --config ${values.config}: ${problem}\n`);
      return 2;
    }
    configVariant = parseGutterConfigObject(raw);
  }

  const outDir = resolve(values.out);
  const cwd = values.cwd ? resolve(values.cwd) : process.cwd();

  const model = await runBench({
    cwd,
    outDir,
    ...(values.branch ? { branch: values.branch } : {}),
    prs: Number(values.prs),
    ...(values.since ? { since: values.since } : {}),
    windowDays: Number(values['window-days']),
    calibrationEvery: Number(values['calibration-every']),
    includeUnnumbered: values['include-unnumbered'],
    ...(values['gate-full-share'] !== undefined ? { gateFullShare: Number(values['gate-full-share']) } : {}),
    ...(values['proxy-min-lift'] !== undefined ? { proxyMinLift: Number(values['proxy-min-lift']) } : {}),
    ...(configVariant ? { config: configVariant } : {}),
    ...(values['ra-lib'] ? { raLib: resolve(values['ra-lib']) } : {}),
    raCache: !values['no-ra-cache'],
    resume: values.resume,
  });

  process.stdout.write(`${model.gates.fullSalienceShare.line}\n`);
  process.stdout.write(`${model.gates.gateAUsefulness.line}\n`);

  process.stderr.write(
    `gutter bench: evaluated ${model.funnel.evaluated} PR(s), scored ${model.funnel.scored} PR(s)\n` +
      `  ${resolve(outDir, 'bench.json')}\n  ${resolve(outDir, 'bench.md')}\n  ${resolve(outDir, 'bench.html')}\n`,
  );
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    if (err instanceof RaLibUnavailableError) {
      process.stderr.write(`${err.message}\n`);
      process.exitCode = err.exitCode;
      return;
    }
    process.stderr.write(`gutter: ${(err as Error).message}\n`);
    process.exitCode = 1;
  },
);
