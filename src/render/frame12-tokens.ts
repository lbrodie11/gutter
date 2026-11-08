/**
 * FRAME/12 tokens, copied from registry/styles/frame12.css (MIT, © Laqwan Brodie).
 * https://github.com/lbrodie11/frame12
 *
 * This block is the ONLY place a color literal or font family may appear in a
 * Gutter page; `lintPage()` enforces that, mirroring scripts/check-frame12.mjs.
 * When FRAME/12 ships a tokens-only export, replace this copy with it.
 */
export const TOKENS_ID = 'f12-tokens';

export const FRAME12_TOKENS = `
:root {
  --font-f-display: "Dela Gothic One", "Arial Black", "Helvetica Neue", sans-serif;
  --font-f-body: "Zen Kaku Gothic New", "Hiragino Sans", "Helvetica Neue", Arial, sans-serif;
  --font-f-mono: "M PLUS 1 Code", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --f-gutter-pair: 12px;
  --f-gutter-scene: 20px;
  --f-gutter-change: 32px;
  --f-stroke: 2.5px;
  --f-pose: 83.33ms;
  --f-shadow-sheet: 0 1px 0 rgba(0, 0, 0, 0.05), 0 18px 40px -26px rgba(0, 0, 0, 0.5);
  --f-desk: #e2e3e5;
  --f-sheet: #ffffff;
  --f-panel: #ffffff;
  --f-ink: #121212;
  --f-ink-2: #4b4b4b;
  --f-rule: #121212;
  --f-tone: #121212;
  --f-grid: #e3e3e3;
  --f-marker: #ffd60a;
  --f-marker-ink: #121212;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --f-desk: #000000;
    --f-sheet: #050505;
    --f-panel: #19191a;
    --f-ink: #f1f0ea;
    --f-ink-2: #b9b8b1;
    --f-rule: #f1f0ea;
    --f-tone: #f1f0ea;
    --f-grid: #2c2c2d;
    --f-marker: #ffd60a;
    --f-marker-ink: #121212;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --f-desk: #000000;
  --f-sheet: #050505;
  --f-panel: #19191a;
  --f-ink: #f1f0ea;
  --f-ink-2: #b9b8b1;
  --f-rule: #f1f0ea;
  --f-tone: #f1f0ea;
  --f-grid: #2c2c2d;
  --f-marker: #ffd60a;
  --f-marker-ink: #121212;
  color-scheme: dark;
}
`;
