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
