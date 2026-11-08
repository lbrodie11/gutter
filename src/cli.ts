#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildBrief } from './brief.ts';
import type { GutterBrief } from './contract.ts';
import { writeBrief } from './output.ts';
import { renderComic, lintPage } from './render/comic.ts';
import { renderMarkdown } from './render/markdown.ts';
import { loadJson, type RaBacktest, type RaDiff } from './sources/archaeology.ts';
import { GUTTER_VERSION } from './version.ts';

const HELP = `gutter ${GUTTER_VERSION}: a one-page, evidence-backed briefing for a change

Usage
  gutter brief --base <ref> [options]     analyze <base>...HEAD and write gutter.json, brief.md, gutter.html
  gutter render <gutter.json> [--format md|html]   re-render a saved brief to stdout
  gutter --version

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
  --ra-version <spec>     npm version spec when running repo-archaeology via npx (default ^0.3.0)
  --no-history            skip co-change history entirely
  --no-calibration        skip the per-repo accuracy backtest
  --max-forgotten <n>     companions to show (default 3)
`;

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === '-v' || cmd === '--version') {
    process.stdout.write(`${GUTTER_VERSION}\n`);
    return 0;
  }
  if (cmd === 'brief') return brief(rest);
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
      'no-history': { type: 'boolean', default: false },
      'no-calibration': { type: 'boolean', default: false },
      'max-forgotten': { type: 'string', default: '3' },
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
    noHistory: values['no-history'],
    noCalibration: values['no-calibration'],
    maxForgotten: Number.isFinite(Number(values['max-forgotten'])) ? Math.max(0, Math.trunc(Number(values['max-forgotten']))) : 3,
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

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`gutter: ${(err as Error).message}\n`);
  process.exitCode = 1;
}
