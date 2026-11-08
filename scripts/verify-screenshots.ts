/**
 * Visual & layout verification for `docs/example/gutter.html` using Playwright.
 *
 * Verifies at desktop (1280×900 light), mobile (390×844 light), and dark (1280×900 dark):
 *  - No horizontal overflow (`scrollWidth <= clientWidth`)
 *  - All 6 panels (`C-01`…`C-06`) are visible with non-zero bounding boxes
 *  - Captures screenshots to `--out <dir>` and optionally updates `docs/images/*` (`--update-docs-images`)
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlaywrightElementHandle {
  boundingBox(): Promise<BoundingBox | null>;
  screenshot(opts: { path: string }): Promise<Buffer>;
}

interface PlaywrightPage {
  goto(url: string, opts?: { waitUntil?: string }): Promise<unknown>;
  evaluate<R>(fn: () => R): Promise<R>;
  screenshot(opts: { path: string; fullPage?: boolean; clip?: BoundingBox }): Promise<Buffer>;
  $(selector: string): Promise<PlaywrightElementHandle | null>;
}

interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightBrowser {
  newContext(opts: {
    viewport: { width: number; height: number };
    colorScheme: 'light' | 'dark';
    reducedMotion: 'reduce';
    deviceScaleFactor?: number;
  }): Promise<PlaywrightContext>;
  close(): Promise<void>;
}

interface PlaywrightModule {
  chromium: { launch(): Promise<PlaywrightBrowser> };
}

function loadPlaywright(): PlaywrightModule {
  const anchors = [
    join(ROOT, 'package.json'),
    ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(':').filter(Boolean).map((p) => join(p, 'playwright', 'package.json')) : []),
    '/Users/brodie/Workspace/frame12/package.json',
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

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      html: { type: 'string', default: join(ROOT, 'docs', 'example', 'gutter.html') },
      out: { type: 'string', default: join(ROOT, '.gutter', 'screenshots') },
      'update-docs-images': { type: 'boolean', default: false },
    },
  });

  const htmlPath = resolve(values.html!);
  const outDir = resolve(values.out!);
  mkdirSync(outDir, { recursive: true });

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();

  try {
    const configs: {
      name: string;
      width: number;
      height: number;
      scheme: 'light' | 'dark';
      docsTarget?: string;
    }[] = [
      {
        name: 'after-desktop-1280.png',
        width: 1280,
        height: 900,
        scheme: 'light',
        docsTarget: join(ROOT, 'docs', 'images', 'hono-example.png'),
      },
      {
        name: 'after-mobile-390.png',
        width: 390,
        height: 844,
        scheme: 'light',
        docsTarget: join(ROOT, 'docs', 'images', 'hono-example-mobile.png'),
      },
      {
        name: 'after-dark-1280.png',
        width: 1280,
        height: 900,
        scheme: 'dark',
      },
    ];

    for (const cfg of configs) {
      const ctx = await browser.newContext({
        viewport: { width: cfg.width, height: cfg.height },
        colorScheme: cfg.scheme,
        reducedMotion: 'reduce',
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const cuts = Array.from(document.querySelectorAll('[data-cut]')).map((el) => {
          const rect = el.getBoundingClientRect();
          const num = el.querySelector('.cap .num')?.textContent?.trim() ?? '';
          return {
            cut: el.getAttribute('data-cut') ?? '',
            num,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        });
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          cuts,
        };
      });

      assert.ok(
        metrics.scrollWidth <= metrics.clientWidth,
        `${cfg.name}: horizontal overflow detected (scrollWidth=${metrics.scrollWidth} > clientWidth=${metrics.clientWidth})`,
      );
      assert.deepEqual(
        metrics.cuts.map((c) => c.cut),
        ['C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06'],
        `${cfg.name}: expected sequential C-01..C-06 data-cut attributes`,
      );
      assert.deepEqual(
        metrics.cuts.map((c) => c.num),
        ['C-01', 'C-02', 'C-03', 'C-04', 'C-05', 'C-06'],
        `${cfg.name}: expected sequential C-01..C-06 .num captions`,
      );
      for (const c of metrics.cuts) {
        assert.ok(c.width > 0 && c.height > 0, `${cfg.name}: panel ${c.cut} has zero size (${c.width}x${c.height})`);
      }

      const shotPath = join(outDir, cfg.name);
      await page.screenshot({ path: shotPath, fullPage: true });
      if (values['update-docs-images'] && cfg.docsTarget) {
        await page.screenshot({ path: cfg.docsTarget, fullPage: true });
      }

      if (values['update-docs-images'] && cfg.name === 'after-desktop-1280.png') {
        const heroPanel = await page.$('[data-cut="C-04"]');
        if (heroPanel) {
          await heroPanel.screenshot({ path: join(ROOT, 'docs', 'images', 'hono-hero-crop.png') });
        }
      }

      await ctx.close();
      console.log(`✓ ${cfg.name} (${cfg.width}px ${cfg.scheme}): scrollWidth=${metrics.scrollWidth}/${metrics.clientWidth}, cuts=C-01..C-06`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
