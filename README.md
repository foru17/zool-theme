<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/zool-wordmark-white.svg" />
    <img src="docs/brand/zool-wordmark-ink.svg" alt="ZOOL" width="168" />
  </picture>
</p>

<p align="center">
  A calm status page for <a href="https://github.com/komari-monitor/komari">Komari</a> and
  <a href="https://github.com/nezhahq/nezha">Nezha</a>.<br />
  <sub>Thoughtful software. For everyday life.</sub>
</p>

<p align="center">
  <a href="https://github.com/foru17/zool-theme/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/foru17/zool-theme?style=flat-square&color=191B1A&label=release" /></a>
  <a href="https://github.com/foru17/zool-theme/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/foru17/zool-theme/total?style=flat-square&color=191B1A" /></a>
  <a href="https://github.com/foru17/zool-theme/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/foru17/zool-theme?style=flat-square&color=191B1A" /></a>
  <a href="https://github.com/foru17/zool-theme/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/foru17/zool-theme/ci.yml?branch=main&style=flat-square&label=ci" /></a>
  <a href="https://github.com/foru17/zool-theme/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/foru17/zool-theme?style=flat-square&color=53695A" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-53695A?style=flat-square" /></a>
  <br />
  <img alt="Komari 1.4+" src="https://img.shields.io/badge/Komari-1.4%2B-B8C8BE?style=flat-square" />
  <img alt="Nezha v1" src="https://img.shields.io/badge/Nezha-v1-B8C8BE?style=flat-square" />
  <img alt="Zero external requests" src="https://img.shields.io/badge/external%20requests-0-B8C8BE?style=flat-square" />
  <img alt="Languages" src="https://img.shields.io/badge/i18n-en%20·%20zh--CN%20·%20zh--TW%20·%20ja-B8C8BE?style=flat-square" />
</p>

<p align="center">
  English · <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img src="docs/screenshots/home-light.png" alt="ZOOL on a Komari fleet, light mode" width="880" />
</p>

## Install with an AI agent

Give this to Claude Code, Codex or any coding agent that can reach your server:

```text
Install the ZOOL theme on my <Komari|Nezha> panel at https://<host>.
Follow https://raw.githubusercontent.com/foru17/zool-theme/main/skills/zool-install/SKILL.md:
detect the panel, download the latest release and verify SHA256SUMS, back up first,
install, verify, and tell me the rollback command.
```

The skill asks before anything destructive and never deletes the theme directory. To keep it
around, copy [`skills/zool-install`](skills/zool-install) into `~/.claude/skills/`.

## Install by hand

Download `zool-komari-v1.0.0.zip` or `zool-nezha-v1.0.0.zip` from
[Releases](https://github.com/foru17/zool-theme/releases/latest).

**Komari** — Admin panel → Settings → Theme → upload the zip → select **ZOOL**.
Command line and upgrades: [docs/install-komari.md](docs/install-komari.md).

**Nezha** — unzip `zool-dist/` next to your compose file and mount it over the template the
dashboard uses:

```yaml
services:
  dashboard:
    volumes:
      - ./data:/dashboard/data
      - ./zool-dist:/dashboard/user-dist:ro   # the template selected in Settings → Theme
```

Then `docker compose up -d`. Options and rollback: [docs/install-nezha.md](docs/install-nezha.md).

## What you get

- **A fleet at a glance.** Nodes online, bandwidth, traffic, what needs attention and monthly
  cost — no averages that mean nothing.
- **Readings with a shape.** CPU, memory and disk in green, amber and red cells that sweep as
  they change; up and down side by side; square, brand-coloured system icons.
- **Cards or a ledger.** Four cards across a laptop, a dense ledger for long lists, flat or
  grouped at a press, filters by group and region you can share as a link.
- **Honest states.** Waiting is not offline. A node that drops keeps its last readings and says
  when it last reported; one that never reported says so.
- **Node pages.** Live metrics, history and latency charts, system, network and billing detail.
- **Everywhere.** Light, dark or system; English, 简体中文, 繁體中文, 日本語; built for phones.

<p align="center">
  <img src="docs/screenshots/states-light.png" alt="Offline, late and never-reported nodes" width="880" />
</p>

## Design

- **Paper and ink.** Warm paper, ink text, hairline rules; colour only where a number needs it.
- **Nothing louder than the data.** No gradients, glow or motion for its own sake.
- **Private by default.** Fonts, flags and icons ship with the theme. It talks only to your
  own panel.
- **Small and maintained.** Hand-drawn SVG instead of a chart library, about 125 KB of gzipped
  JavaScript, tested against real Komari and Nezha fleets.

## Settings

| Key | Default | Description |
| --- | --- | --- |
| `defaultAppearance` | `system` | `system`, `light` or `dark`; used until a visitor picks one |
| `defaultView` | `ledger` | `ledger` or `cards` |
| `defaultDensity` | `comfortable` | Ledger row height: `comfortable` or `compact` |
| `defaultLanguage` | `auto` | `auto`, `en`, `zh-CN`, `zh-TW` or `ja` |
| `siteTitle` | *(empty)* | Overrides the site name |
| `showOverview` | `true` | Overview band on the home page |
| `showCost` | `true` | Monthly cost, summed per currency and normalised to 30 days |
| `showGroups` | `true` | Offer the group picker |
| `defaultGrouped` | `false` | Default state of the visitor's "Show by group" button |
| `showRegions` | `true` | Region filter |
| `showBilling` | `true` | Price and expiry on cards |
| `showOffline` | `true` | List offline nodes |
| `hiddenNodes` | `[]` | Nodes hidden from the home page, search and the node switcher |
| `hideAdminEntry` | `false` | Hide the sign-in button |
| `footerNote` | *(empty)* | One line of text in the footer |

On Komari these live in the admin panel. On Nezha, edit `zool-dist/config.js`; no rebuild needed.

## Develop

Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev:demo          # synthetic fleet, every node state included
pnpm dev               # Komari: proxies /api to ZOOL_UPSTREAM
pnpm dev:nezha         # Nezha: proxies /api to ZOOL_UPSTREAM
pnpm check             # types, tests, i18n
pnpm build && pnpm check:size && pnpm package
```

Architecture and adding a backend: [docs/architecture.md](docs/architecture.md). Instrument
rules: [docs/instruments.md](docs/instruments.md).

## Credits

Built on the public APIs of [Komari](https://github.com/komari-monitor/komari) and
[Nezha](https://github.com/nezhahq/nezha). Typeface [Inter](https://rsms.me/inter/) (SIL OFL),
UI icons [Lucide](https://lucide.dev) (ISC), flags [flag-icons](https://github.com/lipis/flag-icons)
(MIT), system icons [Simple Icons](https://simpleicons.org) (CC0; marks belong to their owners,
tile colours from Simple Icons metadata, the Windows shape is drawn for this project).

## Star history

<a href="https://star-history.com/#foru17/zool-theme&Date">
  <img src="https://api.star-history.com/svg?repos=foru17/zool-theme&type=Date" alt="Star history" width="600" />
</a>

## License

[MIT](LICENSE). The ZOOL name and logo are trademarks of ZOOL LLC.

<p align="center"><sub>A theme by <a href="https://x.com/luoleiorg">@luoleiorg</a></sub></p>
