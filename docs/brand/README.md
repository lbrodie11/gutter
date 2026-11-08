# Gutter Brand Assets

Canonical brand marks and social preview cards for **Gutter** (`lbrodie11/gutter` / `gutter-brief`).

## Mark Concept — *The Missing Connection*

The Gutter mark is built on a `32×32` grid with a `2`-unit `#121212` outer panel frame (`<rect x="1" y="1" width="30" height="30" stroke-width="2"/>`, sitting completely inside the `0..32` viewBox), `#ffffff` paper ground, and a `-4/24` diagonal panel slant:

- **Top solid ink panel (`#121212`):** What changed (`4,4 → 28,4 → 28,10.5 → 4,14.5`).
- **Yellow gutter (`#ffd60a`):** The inference gap between panels (`4,15.75 → 28,11.75 → 28,16.25 → 4,20.25`), separated from both panels by a crisp `1.25`-unit white paper channel.
- **Bottom outlined panel (`#121212` border, `#ffffff` cutout):** The untouched companion panel waiting to be checked (`4,21.5 → 28,17.5 → 28,28 → 4,28` with inner cutout `6.5,23.58 → 25.5,20.42 → 25.5,25.5 → 6.5,25.5`).

## Palette Tokens

Matches `--f-ink`, `--f-panel`, and `--f-marker` in [`src/render/frame12-tokens.ts`](../../src/render/frame12-tokens.ts):

| Token | Light Hex | Dark Hex | Role |
|---|---|---|---|
| Ink | `#121212` | `#f1f0ea` | Frame border, panel ink, primary typography |
| Paper | `#ffffff` | `#19191a` | Panel background and gutter separation channels |
| Gutter Yellow | `#ffd60a` | `#ffd60a` | Primary accent and diagonal gutter slash |

## Asset Inventory

| File | Dimensions | Variant & Usage |
|---|---|---|
| [`icon.svg`](icon.svg) | Vector (`32×32` viewBox) | Light-mode header mark (`README.md`) & SVG favicon (`<link rel="icon" type="image/svg+xml">`) |
| [`icon-dark.svg`](icon-dark.svg) | Vector (`32×32` viewBox) | Dark-mode header mark (`README.md` `<picture>` `prefers-color-scheme: dark`) |
| [`icon-16.png`](icon-16.png) | `16×16` PNG | Hand-tuned pixel-grid favicon (`shape-rendering="crispEdges"`, whole-pixel horizontal bands without subpixel blur) |
| [`icon-32.png`](icon-32.png) | `32×32` PNG | Framed retina browser tab favicon |
| [`icon-128.png`](icon-128.png) | `128×128` PNG | Framed VS Code Marketplace extension icon |
| [`icon-180.png`](icon-180.png) | `180×180` PNG | Padded, frameless safe-zone variant for iOS / macOS `apple-touch-icon.png` (resists rounded-corner clipping) |
| [`icon-512.png`](icon-512.png) | `512×512` PNG | Padded, frameless safe-zone variant for GitHub App / OAuth / organization avatars (fits inside a circular mask) |
| [`social-preview.png`](social-preview.png) | `1280×640` PNG | GitHub repository social preview (`Settings → General → Social preview`) & OpenGraph card |

## Regenerating Assets

All vector marks, raster exports, and the `1280×640` social card are generated from [`scripts/generate-brand-assets.ts`](../../scripts/generate-brand-assets.ts):

```bash
node --experimental-strip-types scripts/generate-brand-assets.ts
```

## GitHub Actions Marketplace Branding

GitHub Actions Marketplace restricts `action.yml` `branding.icon` to a fixed allowlist of Feather v4.28.0 icons (custom SVGs and `columns` are not supported). [`action.yml`](../../action.yml) uses:

```yaml
branding:
  icon: 'layout'
  color: 'yellow'
```
