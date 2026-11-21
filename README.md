# FastTV — Dilkash Edition 2.0 (TizenBrew module)

Original, Apple TV–inspired launcher for Samsung TVs. Designed for the TU7000
(2020, Tizen 5.5) running TizenBrew.

## Features

- Attractive big-screen grid, featured artwork, smooth TV remote focus and search.
- Discovers native Samsung TV applications through an optional TizenBrew
  service. Tries the Tizen application API first; if privileges prevent it,
  reads installed UI app manifests from the TV's own package directories.
- Launches visible Samsung apps where the Tizen launch permission permits.
- Discovers and launches installed TizenBrew modules through its WebSocket.
- Favourites and search, with local preference storage.
- TV remote arrows, OK, Return and focusable star controls.
- Built-in HTML/CSS/JS with no dependencies or tracking. The optional local
  helper only listens on 127.0.0.1 and restricts requests by Origin.

## Important limitations

- Does not replace Windows, Tizen, Smart Hub, or the TV firmware.
- TizenBrew module webpages do not have native Tizen API access, so the
  optional service is required for Samsung app discovery and launch attempts.
- Samsung may restrict app information or launches; if so, native apps will
  not be shown or opened. No app tiles are invented in the actual TV version.
- An app that is on the TV might not expose a visible launchable UI entry.
- FastTV 2.0 has not yet been tested on the user's physical TV.

## Install from GitHub

TizenBrew does not load a local ZIP directly through its Add GitHub Module
button. The module source is published in this public repository.

1. Open TizenBrew > box icon > Add GitHub Module.
2. Enter `dilkashhanjraa/fasttv-tizenbrew`.
3. Return to TizenBrew Home and open **FastTV - Dilkash Edition**.
4. Select **Sync TV apps** to retry discovery if the helper was slow to start.

TizenBrew uses jsDelivr, which may cache older commits temporarily. Do not
enter an invented repository identifier before the repository exists.

## Preview and tests

- Open app/index.html in a browser: **clearly labelled preview sample apps only**.
- Run node --test tests/*.test.cjs for UI logic, manifest parsing, safety checks.
- Real app listing, launching and remote navigation require a Samsung TV test.

References:
- [TizenBrew module format](https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md)
- [TizenBrew installation](https://github.com/reisxd/TizenBrew/blob/main/docs/README.md)
