# Changelog

## 1.0.0 — 2026-09-17

The theme is now called ZOOL, and a machine that is not reporting says why.

- **Name.** The theme shows as ZOOL in the Komari theme list and the footer. Release files are
  `zool-komari-v1.0.0.zip` and `zool-nezha-v1.0.0.zip`; they still install into `zool-theme/`
  and `zool-dist/`, so existing installs upgrade in place and keep their settings.
- **Honest states.** A node that is not live keeps its card or row whole and states its
  condition instead of a bare "Offline":
  - *Offline · last report 3 min ago*, in amber for the first ten minutes and red after, with
    the last readings kept and dimmed. A Komari node that drops during a visit no longer stays
    "online" until reload. Komari does not send readings for nodes that were already down when
    the page opened, so those show "Offline" with placeholders.
  - *Reported 7 min ago* — listed as online but silent for over five minutes; readings dim.
  - *No reports yet* — a node that has never reported shows placeholders, not zeros.
  - Expired billing is written next to the condition; a used-up quota stays on the traffic line.
  - Figures the backend cannot mean (negative or not a number) read as zero, and CPU is capped
    at 100%.
- **Install with an AI agent.** `skills/zool-install` walks a coding agent through detecting
  the panel, downloading and checksumming the release, backing up, installing, verifying and
  rolling back. It asks before anything destructive.
- **README** rewritten in English and Chinese, with install first.
- **Size gate.** `pnpm check:size` fails the build when the entry script passes 128 KB gzipped;
  CI runs it.
- Demo data covers every node condition (`pnpm dev:demo`).

## Before 1.0

0.1.0 – 0.9.0 were released on 2026-09-16 as zool-theme.

- **0.9** — Waiting is not offline: skeletons in the page's real shape until the first frame, a
  refresh button that keeps scroll and filters, readings that dim instead of vanishing while the
  connection recovers.
- **0.8** — Up and down side by side; a two-line phone ledger with fixed columns; a "Show by
  group" switch; touch-sized segmented controls.
- **0.7** — Green, amber and red cells (CPU 50/85, memory 70/90, disk 80/92) that sweep as they
  change; larger live rates; brand-coloured system icons from one cached sprite.
- **0.6** — One flat list until groups are picked; filters in the address; region flags shipped
  with the theme; four cards across a laptop.
- **0.5** — An overview band of figures replaces the headline; twelve equal cells per card
  reading; readings judged on the figure shown.
- **0.4** — Cards rebuilt around three equal readings with the number leading.
- **0.3** — Cards return next to the ledger (`defaultView`).
- **0.2** — The ledger: ticks, blocks, spark, reporting run and notches, each with one meaning.
- **0.1** — First release: Komari and Nezha from one codebase, node pages with charts, search,
  sign-in, light and dark, four languages.
