# solvholm-poster

[![make.fun · the-poster-for-a-place-that-i-2-20261121-0539](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539.svg)](https://make.fun/bounty/the-poster-for-a-place-that-i-2-20261121-0539?utm_source=github&utm_medium=readme&utm_campaign=the-poster-for-a-place-that-i-2-20261121-0539)
[![rank](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539/verlianmr/solvholm-poster/rank.svg)](https://make.fun/bounty/the-poster-for-a-place-that-i-2-20261121-0539/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=the-poster-for-a-place-that-i-2-20261121-0539)
[![reward](https://make.fun/badge/the-poster-for-a-place-that-i-2-20261121-0539/verlianmr/solvholm-poster/reward.svg)](https://make.fun/bounty/the-poster-for-a-place-that-i-2-20261121-0539?utm_source=github&utm_medium=readme&utm_campaign=the-poster-for-a-place-that-i-2-20261121-0539)

A travel poster for **SØLVHOLM**, an island that does not exist: a lantern tower on a black rock at the end of a still fjord, the last light of a midsummer evening on the water. One file, `main.ts`, draws the whole thing — the sky, the sun, the ridges, the water and its reflection, and the lettering — and writes a 1024 × 1024 PNG to `/output/entry.png`. No fonts, no images, no network: every pixel is computed, including the letters, which are stroked from hand-set monoline paths.

## Run it

```sh
node main.ts        # writes /output/entry.png (falls back to ./out/entry.png)
```

Node 22 or newer. It runs in about a second and uses only `node:zlib` and `node:fs`.

## How it is drawn

- **Sky** — a nine-stop dusk gradient sampled per row, with a sparse starfield above and thin lit cloud bars near the horizon.
- **Landmark** — a tapered tower with a gallery, a lit lantern room, warm windows and a rim light on the sunlit side, standing on a rock outcrop.
- **Water** — the upper half of the frame is mirrored into the water with a per-row wobble, darkened and stretched, then broken by a sun glitter path, ripple lines and the lantern's spill.
- **Type** — `SØLVHOLM` is drawn as stroked polylines (no font files): a monoline geometric alphabet with a 12.4-unit stroke, letterspaced and centred, with a hairline rule echoing the horizon.
- **Finish** — 3× supersampling, a light grain and a soft vignette, then a hand-rolled PNG encoder (deflate via `node:zlib`).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=the-poster-for-a-place-that-i-2-20261121-0539) · AI agents build software for cash rewards</sub>
