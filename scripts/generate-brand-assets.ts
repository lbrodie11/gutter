/**
 * Generator for `docs/brand/*` assets.
 *
 * Usage:
 *   node --experimental-strip-types scripts/generate-brand-assets.ts
 *
 * Requires Playwright (`npm i -D playwright` or `NODE_PATH` pointing to an installed `playwright` package).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND_DIR = join(ROOT_DIR, 'docs', 'brand');

interface PlaywrightPage {
  setContent(html: string, opts?: { waitUntil?: string }): Promise<void>;
  evaluate<R>(fn: () => R): Promise<R>;
  screenshot(opts: { path: string; omitBackground?: boolean }): Promise<Buffer>;
  close(): Promise<void>;
}

interface PlaywrightBrowser {
  newPage(opts: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightModule {
  chromium: { launch(opts?: { channel?: string }): Promise<PlaywrightBrowser> };
}

function loadPlaywright(): PlaywrightModule {
  const nodePathEntries = process.env.NODE_PATH ? process.env.NODE_PATH.split(delimiter).filter(Boolean) : [];
  const anchors = [
    join(ROOT_DIR, 'package.json'),
    ...nodePathEntries.flatMap((p) => [join(p, 'playwright', 'package.json'), join(p, '..', 'package.json')]),
  ];
  for (const anchor of anchors) {
    if (!existsSync(anchor)) continue;
    try {
      const req = createRequire(anchor);
      return req('playwright') as PlaywrightModule;
    } catch {
      // try next anchor
    }
  }
  throw new Error('Playwright not found. Install with `npm i -D playwright` or set NODE_PATH.');
}

async function launchBrowser(chromium: PlaywrightModule['chromium']): Promise<PlaywrightBrowser> {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ channel: 'chrome' });
  }
}

/**
 * Canonical 32x32 SVG mark ("The Missing Connection").
 * - Outer 2-unit #121212 frame centered at x=1,y=1..31,31 so all 2 units sit inside viewBox 0..32.
 * - 1.25-unit #ffffff paper channels separating the #ffd60a gutter slash from both panels.
 */
export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="1" y="1" width="30" height="30" fill="#ffffff" stroke="#121212" stroke-width="2"/>
  <polygon points="4,4 28,4 28,10.5 4,14.5" fill="#121212"/>
  <polygon points="4,15.75 28,11.75 28,16.25 4,20.25" fill="#ffd60a"/>
  <path fill="#121212" fill-rule="evenodd" d="M4,21.5 L28,17.5 L28,28 L4,28 Z M6.5,23.58 L25.5,20.42 L25.5,25.5 L6.5,25.5 Z"/>
</svg>
`;

/**
 * Dark-mode 32x32 SVG mark using FRAME/12 dark tokens (--f-panel: #19191a, --f-ink: #f1f0ea, --f-marker: #ffd60a).
 */
export const ICON_DARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="1" y="1" width="30" height="30" fill="#19191a" stroke="#f1f0ea" stroke-width="2"/>
  <polygon points="4,4 28,4 28,10.5 4,14.5" fill="#f1f0ea"/>
  <polygon points="4,15.75 28,11.75 28,16.25 4,20.25" fill="#ffd60a"/>
  <path fill="#f1f0ea" fill-rule="evenodd" d="M4,21.5 L28,17.5 L28,28 L4,28 Z M6.5,23.58 L25.5,20.42 L25.5,25.5 L6.5,25.5 Z"/>
</svg>
`;

/**
 * Hand-tuned 16x16 pixel-grid favicon variant.
 * Uses straight horizontal bands aligned to whole pixels with no subpixel channels so 16x16 renders without blur.
 */
export const ICON_16_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="#121212"/>
  <rect x="1" y="1" width="14" height="14" fill="#ffffff"/>
  <rect x="2" y="2" width="12" height="4" fill="#121212"/>
  <rect x="2" y="6" width="12" height="3" fill="#ffd60a"/>
  <rect x="2" y="9" width="12" height="5" fill="#121212"/>
  <rect x="3" y="10" width="10" height="3" fill="#ffffff"/>
</svg>
`;

/**
 * Padded, frameless safe-zone variant for surfaces that apply rounded-corner or circular masks
 * (180x180 apple-touch-icon and 512x512 GitHub App / organization avatar).
 * All corners sit within [6..26] (distance 14.14 from center < 16 inscribed circle radius).
 */
export const ICON_PADDED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#ffffff"/>
  <polygon points="6,6 26,6 26,11.5 6,15" fill="#121212"/>
  <polygon points="6,16.25 26,12.75 26,16.5 6,20" fill="#ffd60a"/>
  <path fill="#121212" fill-rule="evenodd" d="M6,21.25 L26,17.75 L26,26 L6,26 Z M8.25,23.1 L23.75,20.38 L23.75,23.75 L8.25,23.75 Z"/>
</svg>
`;

export function buildSocialCardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=M+PLUS+1+Code:wght@500;700&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 640px;
    overflow: hidden;
    background: #e2e3e5;
    font-family: "Zen Kaku Gothic New", "Helvetica Neue", Arial, sans-serif;
    color: #121212;
    padding: 36px;
  }
  .sheet {
    width: 100%;
    height: 100%;
    background: #ffffff;
    border: 4px solid #121212;
    box-shadow: 10px 10px 0 #121212;
    display: grid;
    grid-template-columns: 1.18fr 0.82fr;
    position: relative;
    overflow: hidden;
  }
  .left {
    padding: 46px 48px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-right: 4px solid #121212;
    z-index: 2;
    background: #ffffff;
  }
  .brand-row {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .brand-row svg {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
  }
  .kicker {
    font-family: "M PLUS 1 Code", monospace;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #4b4b4b;
  }
  .wordmark {
    font-family: "Dela Gothic One", "Arial Black", sans-serif;
    font-size: 38px;
    line-height: 1;
    letter-spacing: 0.02em;
    color: #121212;
  }
  .headline {
    font-size: 44px;
    font-weight: 900;
    line-height: 1.18;
    letter-spacing: -0.02em;
    color: #121212;
  }
  .headline mark {
    display: inline-block;
    background: #ffd60a;
    color: #121212;
    padding: 2px 10px 4px;
    margin-top: 4px;
    line-height: 1.1;
  }
  .sub {
    font-size: 20px;
    font-weight: 500;
    color: #4b4b4b;
    line-height: 1.4;
    margin-top: 14px;
  }
  .pills {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .pill {
    font-family: "M PLUS 1 Code", monospace;
    font-size: 14px;
    font-weight: 700;
    padding: 7px 12px;
    border: 2.5px solid #121212;
    background: #ffffff;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .pill.accent {
    background: #ffd60a;
  }
  .right {
    background: #f4f4f5;
    padding: 24px 30px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 10px;
  }
  .cut {
    background: #ffffff;
    border: 3px solid #121212;
    padding: 12px 16px;
  }
  .cut.alert {
    box-shadow: inset 8px 0 0 #ffd60a, 6px 6px 0 #121212;
    padding-left: 22px;
  }
  .cut-tag {
    font-family: "M PLUS 1 Code", monospace;
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4b4b4b;
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
    white-space: nowrap;
  }
  .cut-tag .sha {
    text-transform: none;
  }
  .cut-title {
    font-size: 15.5px;
    font-weight: 900;
    color: #121212;
    margin-bottom: 5px;
  }
  .cut-title:last-child {
    margin-bottom: 0;
  }
  .cut-code {
    font-family: "M PLUS 1 Code", monospace;
    font-size: 12.5px;
    color: #121212;
    background: #f4f4f5;
    padding: 5px 8px;
    border: 1.5px solid #121212;
  }
  .gutter-slash {
    height: 18px;
    background: #ffd60a;
    border: 2.5px solid #121212;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "M PLUS 1 Code", monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .colophon-bar {
    border-top: 2.5px solid #121212;
    padding-top: 10px;
    font-family: "M PLUS 1 Code", monospace;
    font-size: 12px;
    color: #121212;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .colophon-bar .label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4b4b4b;
  }
  .colophon-bar .metric {
    font-family: "Zen Kaku Gothic New", "Helvetica Neue", Arial, sans-serif;
    font-size: 14.5px;
    font-weight: 900;
    color: #121212;
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="left">
      <div class="brand-row">
        ${ICON_SVG.trim()}
        <div>
          <div class="kicker">GitHub Action &amp; CLI · gutter-brief</div>
          <div class="wordmark">GUTTER</div>
        </div>
      </div>
      <div>
        <div class="headline">What changed.<br>What it touches.<br><mark>What might be missing.</mark></div>
        <div class="sub">One-page evidence-backed PR briefings with static import reach, test-file links, and Wilson-scored co-change receipts.</div>
      </div>
      <div class="pills">
        <span class="pill accent">Deterministic · No AI</span>
        <span class="pill">Wilson 95% CI</span>
        <span class="pill">Commit Receipts</span>
      </div>
    </div>
    <div class="right">
      <div class="cut">
        <div class="cut-tag"><span>C-01 · INTENT</span><span>2 FILES · +10/−0</span></div>
        <div class="cut-title">feat(serve-static): add cacheControl option</div>
        <div class="cut-code">src/middleware/serve-static/index.ts</div>
      </div>
      <div class="gutter-slash">THE GUTTER · HISTORICAL CO-CHANGE EVIDENCE</div>
      <div class="cut alert">
        <div class="cut-tag"><span>C-04 · LIKELY FORGOTTEN</span><span>85% · 17 OF 20 COMMITS</span></div>
        <div class="cut-title">Changed in 17 of 20 commits touching index.ts</div>
        <div class="cut-code">src/middleware/serve-static/index.test.ts</div>
      </div>
      <div class="cut">
        <div class="cut-tag"><span>C-06 · CHECK THESE</span><span>RECEIPTS · <span class="sha">d54720d</span> · <span class="sha">588ec13</span></span></div>
        <div class="cut-title">Does index.test.ts need a matching change?</div>
      </div>
      <div class="colophon-bar">
        <span class="label">Footer calibration · 375 commits replayed</span>
        <span class="metric">73% hit rate (57% precision) · 6.8× over busy-file guessing</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function main(): Promise<void> {
  mkdirSync(BRAND_DIR, { recursive: true });
  writeFileSync(join(BRAND_DIR, 'icon.svg'), ICON_SVG);
  writeFileSync(join(BRAND_DIR, 'icon-dark.svg'), ICON_DARK_SVG);

  const { chromium } = loadPlaywright();
  const browser = await launchBrowser(chromium);
  try {
    const iconSpecs: Array<{ file: string; size: number; svg: string }> = [
      { file: 'icon-16.png', size: 16, svg: ICON_16_SVG },
      { file: 'icon-32.png', size: 32, svg: ICON_SVG },
      { file: 'icon-128.png', size: 128, svg: ICON_SVG },
      { file: 'icon-180.png', size: 180, svg: ICON_PADDED_SVG },
      { file: 'icon-512.png', size: 512, svg: ICON_PADDED_SVG },
    ];

    for (const { file, size, svg } of iconSpecs) {
      const page = await browser.newPage({
        viewport: { width: size, height: size },
        deviceScaleFactor: 1,
      });
      await page.setContent(
        `<!doctype html><html><body style="margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent">${svg.replace(
          '<svg ',
          `<svg width="${size}" height="${size}" style="display:block" `,
        )}</body></html>`,
      );
      await page.screenshot({
        path: join(BRAND_DIR, file),
        omitBackground: true,
      });
      await page.close();
    }

    const socialPage = await browser.newPage({
      viewport: { width: 1280, height: 640 },
      deviceScaleFactor: 1,
    });
    await socialPage.setContent(buildSocialCardHtml(), { waitUntil: 'networkidle' });
    await socialPage.evaluate(() => document.fonts.ready);
    await socialPage.screenshot({
      path: join(BRAND_DIR, 'social-preview.png'),
    });
    await socialPage.close();
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
