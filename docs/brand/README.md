# Gutter Brand Assets

Canonical brand marks and social preview cards for **Gutter** (`lbrodie11/gutter` / `gutter-brief`).

## Mark Concept — *The Missing Connection*

The Gutter mark is built on a `32×32` grid with a `2px` `#121212` outer panel frame, `#ffffff` paper ground, and a `-4/24` diagonal panel slant:

- **Top solid ink panel (`#121212`):** What changed (`4,4 → 28,4 → 28,10.5 → 4,14.5`).
- **Yellow gutter (`#ffd60a`):** The inference gap between panels (`4,15.75 → 28,11.75 → 28,16.25 → 4,20.25`), separated from both panels by a crisp `1.25`-unit white paper channel.
- **Bottom outlined panel (`#121212` border, `#ffffff` cutout):** The untouched companion panel waiting to be checked (`4,21.5 → 28,17.5 → 28,28 → 4,28`).

## Palette Tokens

| Token | Hex | Role |
|---|---|---|
| Ink | `#121212` | Frame border, panel ink, primary typography |
| Paper | `#ffffff` | Panel background and gutter separation channels |
| Gutter Yellow | `#ffd60a` | Primary accent and diagonal gutter slash |

## Asset Inventory

| File | Dimensions | Usage |
|---|---|---|
| [`icon.svg`](icon.svg) | Vector (`32×32` viewBox) | `README.md` header, launch site (`GU-19`) favicon (`<link rel="icon" type="image/svg+xml">`) |
| [`icon-16.png`](icon-16.png) | `16×16` PNG | Browser tab / legacy favicon fallback |
| [`icon-32.png`](icon-32.png) | `32×32` PNG | Retina browser tab favicon |
| [`icon-128.png`](icon-128.png) | `128×128` PNG | VS Code Marketplace extension icon (`GU-24` `package.json` `"icon"`) |
| [`icon-180.png`](icon-180.png) | `180×180` PNG | iOS / macOS `apple-touch-icon.png` (`GU-19`) |
| [`icon-512.png`](icon-512.png) | `512×512` PNG | GitHub App / OAuth App / organization avatar (`GU-21`) |
| [`social-preview.png`](social-preview.png) | `1280×640` PNG | GitHub repository social preview (`Settings → General → Social preview`) & OpenGraph card (`GU-19`) |

## GitHub Actions Marketplace Branding

GitHub Actions Marketplace restricts `action.yml` `branding.icon` to a fixed allowlist of Feather v4.28.0 icons (custom SVGs and `columns` are not supported). [`action.yml`](../../action.yml) uses:

```yaml
branding:
  icon: 'layout'
  color: 'yellow'
```
