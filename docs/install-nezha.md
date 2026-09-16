# Installing on Nezha

ZOOL works with the Nezha dashboard v1 (tested on v2.0.13).

## How Nezha finds a theme

The dashboard serves the visitor-facing frontend from the template named by `user_template` in
`data/config.yaml` (for example `user-dist` or `nazhua-dist`). For every request it first looks for a
directory with that name in its working directory (`/dashboard` in the official image) and only then falls
back to the copy built into the binary. Mounting ZOOL over one of those names therefore replaces the
frontend without rebuilding Nezha, and the admin panel keeps accepting the template name.

Nezha only serves the frontend for `/` and `/server/:id`, which is exactly what the theme uses.

## Docker Compose

1. Download `zool-nezha-v1.0.0.zip` and unzip it next to your `docker-compose.yaml`. You get a `zool-dist/` folder; `zool-dist` remains the directory name for ZOOL.
2. Check which template is active:

   ```bash
   grep user_template data/config.yaml   # e.g. user_template: user-dist
   ```

3. Mount the folder over that template and restart:

   ```yaml
   services:
     dashboard:
       image: ghcr.io/nezhahq/nezha:v2.0.13
       volumes:
         - ./data:/dashboard/data
         - ./zool-dist:/dashboard/user-dist # use the name from step 2
   ```

   ```bash
   docker compose up -d
   ```

4. Open the dashboard. `curl -s https://your-nezha/ | grep -o 'generator" content="zool v[0-9.]*'` should print the installed version.

## Configuration

Edit `zool-dist/config.js`. It sets `window.ZoolConfig`; every key is optional and documented inline.
Reload the page to see changes. The keys are the same as the Komari settings listed in the
[README](../README.md#settings); for `hiddenNodes`, use server ids as strings, e.g. `['12', '13']`.

| Setting | Default | Meaning |
| --- | --- | --- |
| `showGroups` | `true` | Offer the group filter on the home page. `false` hides the control and never sections by group, regardless of `defaultGrouped`. |
| `defaultGrouped` | `false` | Default state of the visitor's "Show by group" button (the visitor's own choice is remembered). With one group picked the page is always flat; otherwise the button decides between one flat list and sections per group. |

## Billing data

Nezha has no billing fields, so the theme reads the server's **public note** (Servers → edit → Public note)
when it contains JSON in the format used by nezha-dash and Nazhua:

```json
{
  "billingDataMod": {
    "startDate": "2026-01-01T00:00:00+08:00",
    "endDate": "2027-01-01T00:00:00+08:00",
    "autoRenewal": "1",
    "cycle": "Year",
    "amount": "$36"
  },
  "planDataMod": {
    "trafficVol": "2TB",
    "trafficType": "2"
  }
}
```

- `cycle`: `Month`, `Quarter`, `Half`, `Year` (or 月 / 季 / 半年 / 年).
- `amount`: a number with an optional currency prefix; `0` or `free` means free.
- `trafficType`: `2` counts upload + download against `trafficVol`, anything else counts the larger of the two.

Plain-text notes are ignored.

## History and latency

Nezha keeps no metric history unless its TSDB is enabled, so node charts show a live buffer that fills
while the page is open. The latency tab shows the last 24 hours of the dashboard's service monitors for that server.

## Sign-in

The sign-in dialog posts to `/api/v1/login` and then opens `/dashboard`. Nezha blocks an IP for a while
after repeated failures; the dialog says so.

## Upgrading and rollback

- Upgrade: **copy the new files over the old ones — do not delete the previous `assets/`.** Nezha serves
  `index.html` without `Cache-Control` (only `Last-Modified`), so a browser may still hold the previous
  HTML for a while; if that HTML's hashed assets are gone, Nezha answers `404` and the page stays blank.
  Leaving the old hashed files in place costs a few hundred KB and lets those visitors finish their session.
  Sweep them the next time you upgrade.
  ```bash
  unzip -o zool-nezha-v1.0.0.zip -d /tmp/zool && cp -r /tmp/zool/zool-dist/. ./zool-dist/
  ```
  No restart is needed unless you change the mount.
- Rollback: remove the volume line and `docker compose up -d`. The built-in template comes back.

## Without Docker

Put the `zool-dist` folder in the dashboard's working directory, renamed to the active template name, and restart the service.
