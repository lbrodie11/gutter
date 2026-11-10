/**
 * Drives the blinded labeling page in a real browser (Playwright + Chromium).
 *
 * Skips when Playwright or its browser is unavailable, unless GUTTER_REQUIRE_PLAYWRIGHT=1
 * (set in CI on the job that installs Chromium), where a missing browser fails the test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { renderCompareLabelHtml, sampleCompare } from '../src/bench/label.ts';
import { benchModel, labelFixturePrs } from './bench-fixtures.ts';

type Playwright = typeof import('playwright');

async function loadPlaywright(): Promise<{ pw: Playwright } | { reason: string }> {
  try {
    const pw = (await import('playwright')) as Playwright;
    const browser = await pw.chromium.launch();
    await browser.close();
    return { pw };
  } catch (err) {
    return { reason: (err as Error).message.split('\n')[0] ?? 'unavailable' };
  }
}

const required = process.env.GUTTER_REQUIRE_PLAYWRIGHT === '1';
const loaded = await loadPlaywright();
const skip = 'reason' in loaded && !required ? `Playwright/Chromium unavailable: ${loaded.reason}` : false;

test('label page in a browser: outcome hidden until labeled, progress survives reload, export has the documented shape', { skip }, async () => {
  if ('reason' in loaded) assert.fail(`GUTTER_REQUIRE_PLAYWRIGHT=1 but Playwright is unavailable: ${loaded.reason}`);
  const prs = labelFixturePrs(12);
  prs[0]!.subject = 'fix: <img src=x onerror="window.__pwned=1"> (#1)';
  const sample = sampleCompare(benchModel(prs), { seed: 5, gutter: 4, recent: 2, popularNear: 2 });
  const page = renderCompareLabelHtml(sample);

  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/label.html`;

  const browser = await loaded.pw.chromium.launch();
  try {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 375, height: 800 } });
    const tab = await context.newPage();
    const pageErrors: string[] = [];
    tab.on('pageerror', (e) => pageErrors.push(e.message));
    // The page must work offline: block anything that is not the page itself.
    await tab.route('**/*', (route) => (route.request().url() === url ? route.continue() : route.abort()));
    await tab.goto(url);

    const cards = tab.locator('[data-item]');
    assert.equal(await cards.count(), 8);
    assert.equal(await tab.evaluate(() => (window as unknown as { __pwned?: number }).__pwned), undefined, 'hostile title did not execute');
    assert.equal(await tab.locator('[data-progress]').textContent(), '0 / 8 labeled');

    // No card shows a source, evidence, or outcome before it is labeled.
    for (let i = 0; i < 8; i++) {
      const card = cards.nth(i);
      assert.equal(await card.locator('[data-revealed]').isVisible(), false);
      assert.doesNotMatch((await card.innerText()) ?? '', /Gutter asked|Baseline|Automatic outcome/);
    }

    await tab.locator('[data-labeler]').fill('ana');
    const picks = ['useful', 'irrelevant', 'wrong'] as const;
    for (let i = 0; i < 3; i++) {
      const card = cards.nth(i);
      if (i === 2) await card.locator('[data-note]').fill('touches an unrelated adapter');
      await card.locator(`[data-label="${picks[i]}"]`).click();
      const reveal = card.locator('[data-revealed]');
      assert.equal(await reveal.isVisible(), true, `item ${i + 1} reveals after labeling`);
      assert.match(await reveal.innerText(), /Automatic outcome/);
      assert.match(await reveal.innerText(), /Gutter asked|Baseline: (recent|popular-near)/);
      assert.equal(await card.locator(`[data-label="${picks[i]}"]`).getAttribute('aria-pressed'), 'true');
    }
    assert.equal(await cards.nth(3).locator('[data-revealed]').isVisible(), false, 'unlabeled items stay hidden');
    assert.equal(await tab.locator('[data-progress]').textContent(), '3 / 8 labeled');

    // Progress is restored from localStorage after a reload.
    await tab.reload();
    assert.equal(await tab.locator('[data-progress]').textContent(), '3 / 8 labeled');
    assert.equal(await tab.locator('[data-labeler]').inputValue(), 'ana');
    assert.equal(await cards.nth(0).locator('[data-revealed]').isVisible(), true);
    assert.equal(await cards.nth(2).locator('[data-note]').inputValue(), 'touches an unrelated adapter');

    // Changing a label after the reveal is allowed but recorded.
    await cards.nth(1).locator('[data-label="useful"]').click();

    const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('[data-export]').click()]);
    assert.equal(download.suggestedFilename(), 'labels.json');
    const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
    assert.equal(exported.kind, 'gutter-labels');
    assert.equal(exported.mode, 'compare');
    assert.equal(exported.schemaVersion, 1);
    assert.equal(exported.sampleId, sample.sampleId);
    assert.equal(exported.total, 8);
    assert.equal(exported.labels.length, 3);
    for (const l of exported.labels) {
      assert.deepEqual(Object.keys(l).sort(), [
        'changedAfterReveal', 'firstLabel', 'itemId', 'label', 'labeledAt', 'labeler', 'note', 'questionId', 'source',
      ]);
      assert.equal(l.labeler, 'ana');
      assert.ok(!Number.isNaN(Date.parse(l.labeledAt)));
      const item = sample.items.find((x) => x.itemId === l.itemId)!;
      assert.equal(l.questionId, item.questionId);
      assert.equal(l.source, item.source);
    }
    const byItem = new Map(exported.labels.map((l: { itemId: string }) => [l.itemId, l]));
    const ids = sample.items.slice(0, 3).map((i) => i.itemId);
    assert.deepEqual(byItem.get(ids[0]), { ...(byItem.get(ids[0]) as object), label: 'useful', changedAfterReveal: false });
    assert.deepEqual(byItem.get(ids[1]), { ...(byItem.get(ids[1]) as object), label: 'useful', firstLabel: 'irrelevant', changedAfterReveal: true });
    assert.equal((byItem.get(ids[2]) as { note: string }).note, 'touches an unrelated adapter');

    // Storage blocked (private mode, sandboxed previews): the page still works and warns.
    const blocked = await context.newPage();
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
    });
    await blocked.goto(url);
    assert.equal(await blocked.locator('[data-storage-warning]').isVisible(), true);
    await blocked.locator('[data-item]').first().locator('[data-label="useful"]').click();
    assert.equal(await blocked.locator('[data-progress]').textContent(), '1 / 8 labeled');

    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
