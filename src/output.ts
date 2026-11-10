import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GutterBrief } from './contract.ts';
import { renderComic } from './render/comic.ts';
import { renderMarkdown, type MarkdownOptions } from './render/markdown.ts';

export interface WrittenBrief { json: string; markdown: string; html: string }

/** Write the contract plus both renderings. JSON first: it is the product. */
export function writeBrief(brief: GutterBrief, outDir: string, md: MarkdownOptions = {}): WrittenBrief {
  mkdirSync(outDir, { recursive: true });
  const paths = {
    json: join(outDir, 'gutter.json'),
    markdown: join(outDir, 'brief.md'),
    html: join(outDir, 'gutter.html'),
  };
  writeFileSync(paths.json, JSON.stringify(brief, null, 2) + '\n');
  writeFileSync(paths.markdown, renderMarkdown(brief, md));
  writeFileSync(paths.html, renderComic(brief));
  return paths;
}

/** The one-line CLI summary `gutter brief` prints to stderr (facts only; no prediction wording). */
export function summaryLine(brief: GutterBrief): string {
  const fg = brief.forgotten;
  const n = brief.changes.totals.files;
  const items = brief.checklist.length;
  return (
    `gutter: ${brief.salience.level} · ${n} file${n === 1 ? '' : 's'} · ` +
    `${items} checklist item${items === 1 ? '' : 's'} · ` +
    `${fg.items.length} usually-changes-with pair${fg.items.length === 1 ? '' : 's'} (history ${fg.status}) · calibration ${brief.calibration.status}`
  );
}
