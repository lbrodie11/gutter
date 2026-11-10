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
/** The one-line CLI summary `gutter brief` prints to stderr (facts only; no prediction wording). */
export function summaryLine(brief) {
    const fg = brief.forgotten;
    const n = brief.changes.totals.files;
    const items = brief.checklist.length;
    return (`gutter: ${brief.salience.level} · ${n} file${n === 1 ? '' : 's'} · ` +
        `${items} checklist item${items === 1 ? '' : 's'} · ` +
        `${fg.items.length} usually-changes-with pair${fg.items.length === 1 ? '' : 's'} (history ${fg.status}) · calibration ${brief.calibration.status}`);
}
