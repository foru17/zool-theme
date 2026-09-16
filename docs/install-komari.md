# Installing on Komari

ZOOL works with Komari 1.4 and later (tested on 1.5.0).

## From the admin panel

1. Download `zool-komari-v1.0.0.zip` from the releases page.
2. Open **Settings → Theme** in the Komari admin panel and upload the zip.
3. Select **ZOOL**. The theme's own settings appear on the same page.

## By hand

The zip contains `komari-theme.json`, `preview.png` and `dist/`. Komari identifies a theme by the `short`
field of `komari-theme.json` (`zool-theme`), and the directory name must match it.
`zool-theme` remains the directory name and Komari `short` identifier for ZOOL.

```bash
# on the Komari host: the directory mounted at /app/data
DATA=/path/to/komari/data
unzip zool-komari-v1.0.0.zip -d "$DATA"/theme/zool-theme
```

Then select **ZOOL** under Settings → Theme in the admin panel.

Check it: `curl -s https://your-komari/api/public | jq -r .data.theme` prints `zool-theme`.

### Blank page after switching themes

Komari's built-in frontend is a PWA: it registers `/sw.js`, which precaches `index.html` and answers
navigations from that cache. Visitors who opened the site under an earlier theme can therefore keep
getting that theme's HTML, pointing at hashed assets the new theme does not have — a blank page.

It shows as a blank page rather than the old theme because Komari answers unknown static paths with the
SPA fallback: a request for a hashed asset that no longer exists returns `index.html` with
`content-type: text/html`, and the module script fails to parse.

ZOOL ships a `sw.js` that replaces the stale worker, clears every cache, unregisters itself and
reloads, and `index.html` unregisters leftover workers as well. One reload heals the page — verified by
reproducing the failure locally against a precaching worker. A visitor who wants it fixed immediately can
hard-reload, or unregister the worker in DevTools → Application → Service workers.

If you reproduce this yourself, serve the new build with something that does not answer
`If-Modified-Since` with `304` (and give the new `sw.js` a newer mtime than the old one). Otherwise the
browser is told the script is unchanged, never installs it, and the fix looks broken. Komari itself sends
no `Last-Modified` for `/sw.js`, so it is not affected.

### Behind a CDN

Assets in `dist/assets/` have content hashes in their names, so long cache lifetimes are safe for them.
`index.html`, `favicon.svg` and `preview.png` keep their names; purge them after an upgrade if your CDN caches them.

## Upgrading

Upload the new zip (or copy the new files over the directory) and restart Komari. Theme settings are kept.

**Do not wipe the old `dist/assets/` when upgrading by hand.** Komari answers unknown static paths with
the SPA fallback — a request for a hashed asset that no longer exists returns `index.html` as
`text/html`, and a browser still holding the previous HTML then parses markup as JavaScript and shows a
blank page. Copying over the directory keeps the old hashed files around for visitors mid-session:

```bash
unzip -o zool-komari-v1.0.0.zip -d /tmp/zool
DATA=/path/to/komari/data
sudo cp -r /tmp/zool/. "$DATA"/theme/zool-theme/
sudo docker restart komari
```

## Rollback

Select another theme in the admin panel. If the admin panel itself will not load, back up the
database and switch it from the host:

```bash
DATA=/path/to/komari/data
sqlite3 "$DATA"/komari.db ".backup $DATA/komari.db.bak-$(date +%Y%m%d)"
sqlite3 "$DATA"/komari.db "UPDATE configs SET value='\"default\"' WHERE key='theme';"
docker restart komari
```

## Settings

All options are listed in the [README](../README.md#settings). They are stored by Komari and served to
visitors through `/api/public`, so any key the theme does not know is ignored and any missing key falls back to its default.

| Setting | Default | Meaning |
| --- | --- | --- |
| `showGroups` | `true` | Offer the group filter on the home page. `false` hides the control and never sections by group, regardless of `defaultGrouped`. |
| `defaultGrouped` | `false` | Default state of the visitor's "Show by group" button (the visitor's own choice is remembered). With one group picked the page is always flat; otherwise the button decides between one flat list and sections per group. |
