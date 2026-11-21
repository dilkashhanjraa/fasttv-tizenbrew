# FastTV — Dilkash Edition (TizenBrew module)

Lightweight, Windows-style dashboard for **TizenBrew application modules** on
Samsung TVs, designed for the TU7000 (2020, Tizen 5.5).

## Features

- TizenBrew WebSocket discovery of installed application modules.
- Launch available TizenBrew app modules via the local service.
- Favourites and search, with local preference storage.
- TV remote arrows, OK, Return and focusable star controls.
- Built-in HTML/CSS/JS, with no dependencies or tracking.

## Important limitations

- Does not replace Windows, Tizen, Smart Hub, or the TV firmware.
- Built-in TV apps such as Netflix and Samsung Settings cannot be enumerated
  through TizenBrew's ordinary web module API.
- TizenBrew pages have no native Tizen API access.
- App names and launch behaviour depend on TizenBrew's background service.
- Not yet tested on the user's physical Samsung TV.

## Install from GitHub

TizenBrew does not load a local ZIP directly through its Add GitHub Module
button. The module source is published in this public repository.

1. Open TizenBrew > box icon > Add GitHub Module.
2. Enter `dilkashhanjraa/fasttv-tizenbrew`.
3. Return to TizenBrew Home and open **FastTV - Dilkash Edition**.

TizenBrew uses jsDelivr, which may cache older commits temporarily. Do not
enter an invented repository identifier before the repository exists.

## Preview and tests

- Open app/index.html in a browser: **sample modules only**.
- Run node --test tests/*.test.cjs for JS and manifest checks.
- Real app listing, launching and remote navigation require TV testing.

References:
- [TizenBrew module format](https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md)
- [TizenBrew installation](https://github.com/reisxd/TizenBrew/blob/main/docs/README.md)
