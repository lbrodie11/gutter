#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildBrief } from './brief.ts';
import { parseGutterConfigObject, type GutterConfig } from './config.ts';
import type { GutterBrief } from './contract.ts';
import { runBench } from './bench/runner.ts';
import { writeBrief } from './output.ts';
import { renderComic, lintPage } from './render/comic.ts';
import { renderMarkdown } from './render/markdown.ts';
import { loadJson, type RaBacktest, type RaDiff } from './sources/archaeology.ts';
import { RaLibUnavailableError } from './sources/archaeology-lib.ts';
import { GUTTER_VERSION } from './version.ts';

const HELP = `gutter ${GUTTER_VERSION}: a one-page, evidence-backed briefing for a change

Usage
  gutter brief --base <ref> [options]     analyze <base>...HEAD and write gutter.json, brief.md, gutter.html
  gutter bench [options]                  replay merged PRs as-of each PR and write bench.json, bench.md, bench.html
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
  --max-forgotten <n>     companions to show (default 3)

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
`;

const COMMANDS = new Set(['brief', 'bench', 'render']);

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

  const fg = result.forgotten;
  process.stderr.write(
    `gutter: ${result.salience.level} · ${result.changes.totals.files} file${result.changes.totals.files === 1 ? '' : 's'} · ` +
      `${result.checklist.length} question${result.checklist.length === 1 ? '' : 's'} · ` +
      `${fg.items.length} likely-forgotten (${fg.status}) · calibration ${result.calibration.status}\n` +
      `  ${paths.json}\n  ${paths.markdown}\n  ${paths.html}\n`,
  );
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
    configVariant = parseGutterConfigObject(raw);
    // A preregistered variant must run exactly as written: refuse keys or values the config parser drops.
    const rawKeys = raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.keys(raw) : [];
    const dropped = rawKeys.filter((k) => !(k in configVariant!));
    if (dropped.length > 0) {
      process.stderr.write(`error: --config ${values.config}: unknown or invalid key(s): ${dropped.join(', ')}\n`);
      return 2;
    }
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
