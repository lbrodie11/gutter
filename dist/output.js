import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderComic } from "./render/comic.js";
import { renderMarkdown } from "./render/markdown.js";
/** Write the contract plus both renderings. JSON first: it is the product. */
export function writeBrief(brief, outDir, md = {}) {
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
