# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gate Rush: a free, ad-free crowd-runner lane shooter (Veterans Day edition) that runs in any phone or desktop
browser. The player picks a military branch (Army, Marine Corps, Navy, Air Force, Space Force, Coast Guard),
steers a squad through +/- gates, shoots enemy squads, and fights a last stand. Static site, no build step,
no server, no tracking; progress lives in the player's `localStorage`.

Live at https://wardnb.github.io/gate-game/ (GitHub Pages, deploys from `main` root about a minute after a push).
Repo: https://github.com/wardnb/gate-game. Nick plays it on his phone, so every change must work at phone width.

## Running and developing

- Serve the folder: `python3 -m http.server 8771 --bind 127.0.0.1` then open `http://127.0.0.1:8771/`.
  Port 8765 is taken on this machine (amazon-shopping MCP). Opening `index.html` directly mostly works, but
  audio fetches and the module script need HTTP.
- Balance study (headless, runs the real game code in Node with bot players):
  `node tools/sim.js` · `LV=1,5,12 node tools/sim.js '{}' 60` · `UP=10,10,8 node tools/sim.js` (all upgrades) ·
  `node tools/sim.js '{"bossBase":1.8}'` (try a TUNE constant). Run it after any change to `a_core.js`/`c_game.js`.
  Expected ballpark: careful bot ~100% early, ~80–95% at mission 20; never-steers bot near 0%.
- Syntax checks: `node --check js/a_core.js` etc. For the ES module: copy to a `.mjs` and `node --check` it.
- URL flags: `?3d=force` keeps the 3D renderer even on software GL; `?3d=off` forces the 2D renderer.

## Code layout

| File | Role |
|---|---|
| `index.html` | Markup, CSS (HUD, cards, branch picker, armory), import map for Three.js |
| `js/a_core.js` | Config, save data, `BRANCHES` table, audio engine (recorded SFX + synth fallback), weapons, `TUNE`, level generation |
| `js/b_draw.js` | 2D canvas: the fallback world renderer, plus labels, sparks, popups and HUD drawn over the 3D view |
| `js/c_game.js` | Game loop, rules, support calls, results, armory, input, branch picker wiring |
| `js/d_three.js` | 3D renderer (ES module, Three.js 0.170 from jsDelivr): soldiers, props, landmarks, particles, post-processing |
| `tools/sim.js` | Headless bot balance study (loads a/b/c only, never d) |
| `sfx/` | Recorded CC0 sounds as mono MP3; sources in `sfx/CREDITS.md` |

## Conventions and gotchas

- **Rules never depend on rendering.** `d_three.js` only reads globals (`pz`, `px`, `items`, `bullets`, `count`...).
  Keep it that way: the sim loads a/b/c in a Node `vm` with stubbed DOM, so new code in those files must not
  touch DOM APIs the stub lacks (guard with `window.R3&&R3.ok`, `document.documentElement&&`, try/catch).
- **Branches are cosmetic.** Uniforms, camo, scenery props, landmarks, support-call names and wording all come
  from `BRANCHES` in `a_core.js`. Balance is identical across branches; don't add per-branch stats without a sim pass.
  No official seals or insignia.
- **Units in 3D:** game x is in half-road units (×`RH`=4 m), game z units ×`ZS`=0.5 m, world −Z is forward.
  `R3.proj(x,zr)` maps game coords to screen so 2D effects line up with the 3D view.
- **Props vs landmarks:** near props come from `land.props` (names → `PREFAB` in `d_three.js`, every 22 z-units,
  alternating sides, `off` = extra metres from the road). Big set pieces come from `land.marks` (→ `MARK`, one per
  600 z-units, 60–150 m out). Prefabs are built once and cloned; `userData.fire/vent/bob/beam/spin` drive effects.
- **3D fallback:** software GL (SwiftShader/llvmpipe) → 2D at load; frames slow for ~3 s → 2D at runtime;
  adaptive quality drops bloom, then shadows. This desktop's Chrome has **no GPU** (SwiftShader, ~2 fps in 3D), so
  test 3D with `?3d=force` and step the game manually in JS (`update(1/60)` loops, then `draw()`) for screenshots.
  Real-device performance is unverified; ask Nick to try his phone.
- **Depth precision:** the post-processing target has a 16-bit-ish depth buffer. Coplanar-ish surfaces z-fight
  (this once turned the road into sand). Use `polygonOffset` on ground (+) and flat decals (−) instead of tiny y gaps.
- **Audio:** recorded clips load after the first tap (`initAudio` → `loadSfx`); every call site falls back to the
  old synth beep if a clip is missing. The music loop is exactly 44.304 s; `startMusic` skips MP3 encoder padding.
  Audio suspends when the page is hidden and resumes on return or the next tap. Use MP3 (iOS lacks reliable OGG).
- **Music:** separate from sound effects (`save.music`, the "Music" button on the menu and pause cards). Each branch plays
  `sfx/song_<branch>.mp3` (titles in `SONGS`); only the chosen branch's song is fetched, and only while music is on.
  If it fails, `music.mp3` (the generic march) plays. Service songs must be public domain: U.S. military band
  recordings of public-domain compositions. The official Air Force song is still copyrighted, so don't add it.
- **New sounds:** CC0 only, add to `SFX_LIST` and `sfx/CREDITS.md`. Kenney packs need a browser download
  (donation popup → "Continue without donating"); don't spoof user agents with curl.
- **Mobile-first:** 44 px touch targets, 16 px side gutter, support buttons use `pointerdown` so a second thumb works
  while the first steers. Popups auto-shrink to fit the width.
- Commit messages end with the Claude attribution lines; pushing to `main` publishes the site.
