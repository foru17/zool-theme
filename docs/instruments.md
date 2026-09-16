# Instruments

The home page offers a ledger and cards: one row or card per node. Each instrument owns
exactly one kind of meaning, so no two readings on a row ever look alike. That is the whole
trick behind "quiet but not monotonous" — monotony comes from repeating one shape, not from
using few colours.

| Instrument | Meaning | Shape | Component |
| --- | --- | --- | --- |
| Ticks | share of capacity | discrete vertical ticks | `TickBar` |
| Blocks | countable amount | small squares | `BlockGrid` |
| Spark | trend over time | mirrored line around a baseline | `MirrorSpark` |
| Run | history of a state | row of dots | `DotRun` |
| Notch | a threshold | 1px rule drawn on the instrument it belongs to | `TickBar` prop |

## Levels and colour

`levelFor` in `src/components/instruments.tsx` judges the displayed percentage, after
`formatPercent`, rather than the raw value: a disk at 91.6% displays 92% and is already red.

| Metric | `good` — green, no action needed | `warn` — yellow, keep an eye on it | `danger` — red, needs handling |
| --- | --- | --- | --- |
| CPU | < 50% | ≥ 50%, < 85% | ≥ 85% |
| Memory | < 70% | ≥ 70%, < 90% | ≥ 90% |
| Disk | < 80% | ≥ 80%, < 92% | ≥ 92% |

`LEVEL_COLOR` uses these fill tokens from `src/styles/app.css` in both views:

| Level | Fill token | Light | Dark |
| --- | --- | --- | --- |
| `good` | `--good` | `#3F7D5A` | `#7FB894` |
| `warn` | `--warn-fill` | `#B07316` | `#E0A54A` |
| `danger` | `--danger` | `#b3261e` | `#f2837a` |

Card percentage numbers stay in `--ink` at `good`, so routine readings stay quiet and colour
draws the eye to action. Only `warn` and `danger` numbers take a status colour: `--warn`
(`#9a5b0b` light / `#e0a54a` dark) and `--danger`. The yellow fill has its own token because
small filled cells and text need different contrast. "Needs attention" counts each online
node with any yellow or red reading once; the lower thresholds can increase that count.

## Ticks — CPU

In the ledger and on the node page, one tick per core, so a 4-core box at 37% fills
**1.48 of 4 ticks**: "one and a half cores busy". Neither backend exposes per-core data,
so this is the most honest core-level reading
available. Above 32 cores, or when the core count is unknown, it falls back to 10 ticks and
reads as plain percent.

- Up to 3px wide and 2px apart, 11px tall in comfortable density, 9px in compact. The width is
  derived from the 68px box, so a 32-core machine thins its ticks instead of spilling into the
  next column; enlarged readings on the node page solve the same equation against 150px.
- A partial tick is a solid `.cell-fill` scaled over its empty track (see Motion).
- The notch marks `load1 / cores`; past 1.0 the run is longer than the machine is wide.
- CPU warns at 50%, alerts at 85%, using the displayed value.
- Cards use twelve equal cells stretched across the column for every node; core counts are
  written in the card's text.

## Blocks — memory

In the ledger and on the node page, at most twelve blocks keep the reading scannable: the step
grows with the machine (1, 2, 4, 8… GB per block) and is reported next to the reading rather
than left to be guessed. Swap gets its own
hollow blocks after a gap, so "swapping" reads as a different material, not a longer bar.
Memory warns at 70%, alerts at 90%. Cards use twelve equal cells stretched across the column;
capacity is written below the percentage. Disk uses blocks too, with thresholds of 80% / 92%.

## Spark — network

Upload above the baseline, download mirrored below it. Direction carries the meaning, which
keeps the reading colour-blind safe and lets both series share one strip (22px by default).

Both halves share one scale. Normalising each half to its own peak makes 100 KB/s of upload
look exactly like 10 MB/s of download — a quiet lie a monitor must not tell. Where the shape
matters more than the comparison, `independentScales` is available and the label then has to
carry both peaks.

- Up to 15 minutes of the live ring buffer, bucketed to 24 points (`recentBuckets`). The window
  stretches to the history that exists, so a freshly opened page still shows a shape.
- Empty buckets break the path instead of interpolating across a gap.
- One filled dot marks the current value on each half. The peak is reported as text, not as
  a second dot, to keep the strip calm at ledger density.
- `stretch` makes `MirrorSpark` fill its parent's width with `width="100%"` and
  `preserveAspectRatio="none"`. Paths are drawn in `width` units, then stretched horizontally;
  non-scaling strokes keep the lines 1px thick. End dots use zero-length round-capped lines
  so they stay round as the column widens.
- Cards place the rate label above a 32px-high spark stretched across the full content width.
  Upload and download rates sit side by side in equal columns on one 24px-high row, using the
  same 20px type as the CPU / memory / disk readings (18px on narrow cards). Traffic follows
  on one 13px line, with its label, upload and download totals, and the quota note at the right.
  The four rows are spaced 8px apart.

## Run — reported or silent

12 capsules covering the live window, so each one is countable rather than a dotted rule.

- filled sage dot — the node reported in that window
- hollow red ring — silence
- faint grey dot — we were not watching: before the buffer started, and any stretch where the
  socket was down or the tab was asleep. "We were not looking" must never render as "it was down".

## Notch — thresholds

Thresholds are drawn, not just coloured, so the reader can see *why* something turned amber.
The same 1px rule marks a traffic quota on a strip and the 80/90 marks on a detail chart.

## Dark mode

`--wash` sits close to `--paper`, so empty ticks and blocks would disappear. In dark mode the
empty state uses `--line-strong` as an inset outline instead of a fill, and hollow dots keep
their 1px stroke. Spark area fills remain 8% ink for upload and 5% for download in both themes.

## Motion

Every tick and block has a permanent `.cell-empty` track with an inner `.cell-fill`. Its fill
is clamped to 0–1 and drawn with `scaleX` from the left edge, so increases and decreases keep
the same cells instead of replacing their backgrounds.

Cards and node-page readings enable `animate` on `TickBar` and `BlockGrid`. A change sweeps
through the cells at one linear speed — 140ms a cell, at least 200ms and at most 0.7s: moving from 3.5 to 5.5 fills cell 4, then 5,
then 6, rather than growing all three at once by different amounts (which reads as a staircase
until the last frame). `useSweep` in `instruments.tsx` remembers the previous value and gives
each cell the slice of the move it covers as `--sweep-delay` and `--sweep-duration`; shrinking
runs from the right. Colour changes ease over 0.7s on their own clock. Ledger readings leave
`animate` off and update immediately, keeping a dense list still. Spark paths redraw directly.

`prefers-reduced-motion: reduce` disables these transitions through the global override in
`app.css`, which zeroes both durations and delays; the status pulse only runs with
`no-preference`.

## OS icons

`OsGlyph` draws system marks from the same-origin sprite `public/os/sprite.svg`: 26 marks
from simple-icons 16.31.0 (CC0-1.0) plus the project's own generic four-pane Windows graphic,
for 27 keys. The licence and trademark notice ship in `public/os/LICENSE.txt`. Icons identify
the node's system; their trademarks belong to their respective owners and imply no endorsement.

The component uses `<use href="/os/sprite.svg?v=<version>#key">`, where `<version>` is the build's
`__ZOOL_VERSION__` and `key` is the resolved OS key. The browser can cache the sprite separately
from JavaScript, and the version query refreshes it on a release.

Marks are shown as square app-style icons: `.os-tile` is filled with the brand colour recorded in
simple-icons metadata (Windows uses #0078D4), and the mark sits on it in white when white reaches
3:1 against the tile, otherwise black. `OS_COLORS` in the generated `src/core/os.manifest.ts`
holds both. An inset 1px ring keeps black (Apple, AlmaLinux) and light grey (Synology) tiles
visible on either theme. Cards use a 20px tile with a 13px mark; the ledger uses 16px with 11px
(14px with 9px in compact density). A bare mark without a tile takes `currentColor`. If the sprite
fails to load, `<use>` fires no error and the tile stays an empty coloured square.

Mapping rules live in `src/core/os.ts`. Product names take precedence over base distributions,
so Proxmox on Debian gets its own mark; iStoreOS and ImmortalWrt map to `openwrt`. Arch matching
uses word boundaries so `aarch64` cannot be mistaken for Arch. Unknown strings fall back to
`linux`; a Nezha node reporting only `linux` therefore shows the generic Linux mark rather
than an inferred distribution.

Regenerate with `pnpm icons:os`. `scripts/import-os-icons.mjs` verifies the installed
simple-icons version and licence, then writes the sprite, licence and `src/core/os.manifest.ts`.

## Testing hooks

Every instrument carries `data-instrument` (`ticks`, `blocks`, `spark`, `run`) and `TickBar`
also exposes `data-filled`, so acceptance checks can assert "this row shows five different
instruments" and "4 cores at 37% fills 1.48" without screenshot diffing.
