# Gate Rush

A free, ad-free crowd-runner lane shooter that runs in any phone or desktop browser. Veterans Day edition.

Steer a squad down the road, pick gates that grow it, shoot down the red squads charging at you, and arrive at the last stand with enough troops to win. No ads, no purchases, no tracking, no server: progress is saved in the browser it is played in.

## Play

Open `index.html` in a browser, or serve the folder with any static file server:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. The game needs no build step. It loads Three.js and two Google Fonts from CDNs. If Three.js cannot load (offline), or the device has no GPU acceleration, or 3D frames stay very slow, it falls back to the 2D renderer automatically. Add `?3d=force` or `?3d=off` to the URL to override that for testing.

## How it plays

- **Drag** left or right to steer (arrow keys or A/D on a keyboard).
- Troops fire straight ahead on their own. Red squads always reach you, so line up and shoot them down first.
- **Blue gates** add troops, **red gates** cost troops. A **gold-top gate** rises as you shoot it.
- **Barrels** hold troops, a weapon or an extra support call. Shoot them open; do not run into them.
- **Minefields** cover half the road. Steer to the clear side.
- **Support buttons** (or keys 1 to 3): drones, artillery and an air strike. Save them for the giant.
- Win medals, spend them in the Armory on permanent upgrades, and collect all eight weapons.

## Branches

On first launch you pick a branch, and you can change it from the menu at any time. Progress, medals and upgrades are shared.
The branch changes the look and the words, not the rules, so every branch plays and balances the same.

| Branch | Troops | Setting | Support calls |
|---|---|---|---|
| Army | Soldiers | Desert road, tents, sandbags | Drone, Artillery, Air strike |
| Marine Corps | Marines | Beach landing, palms, amphibious vehicles | Drone, Mortars, Air support |
| Navy | Sailors | Causeway over open water, buoys, boats | Drone, Naval guns, Jet strike |
| Air Force | Airmen | Airfield, hangars, control tower, wind sock | Drone, Gunship, Air strike |
| Space Force | Guardians | Launch complex, radar dishes, rocket on the pad | Drone, GPS strike, Air strike |
| Coast Guard | Coast Guardsmen | Coastline, lighthouse, cutters, ice | Drone, Deck gun, Helo strike |

Each branch also has its own uniform colours, road-edge colours and menu accent. No official seals or insignia are used.
Branches are defined in the `BRANCHES` table in `js/a_core.js`.

## Weapons

| Weapon | Round | Behaviour | First appears |
|---|---|---|---|
| M16A4 | 5.56mm | Slow, accurate single shots | Start |
| M4A1 | 5.56mm | Quicker follow-up shots | Mission 1 |
| M249 SAW | 5.56mm | Four times the rate of fire, sprays | Mission 1 |
| M1014 Shotgun | 12 gauge | Five-pellet fan, half the range | Mission 2 |
| M240B | 7.62mm | Punches through one squad into the next | Mission 3 |
| M320 Launcher | 40mm | Blast hits neighbouring squads, ignores shields | Mission 5 |
| M2 Browning | .50 cal | Goes through everything, shields included | Mission 7 |
| M134 Minigun | 7.62mm | Strongest overall, sprays wide | Mission 9 |

## Code layout

| File | What it holds |
|---|---|
| `index.html` | Markup and styles for the HUD, cards and Armory |
| `js/a_core.js` | Config, save data, audio, weapons table, level generation |
| `js/b_draw.js` | 2D canvas drawing: the fallback world renderer, plus the labels, sparks and HUD drawn over the 3D view |
| `js/d_three.js` | 3D renderer (Three.js, loaded from a CDN): soldiers, gates, enemies, branch scenery, water, lighting and shadows |
| `js/c_game.js` | Game loop, rules, support calls, results, input, UI wiring |
| `tools/sim.js` | Headless bot study used to tune difficulty |

Difficulty constants live in the `TUNE` object in `js/a_core.js`.

## Balance study

`tools/sim.js` runs the real game code in Node with three bot players (careful, casual, and one that never steers) and prints win rates per mission:

```
node tools/sim.js                 # default missions, 150 runs each
LV=1,5,12 node tools/sim.js '{}' 60
UP=10,10,8 node tools/sim.js      # with all upgrades bought
node tools/sim.js '{"bossBase":1.8}'   # try a different constant
```

Results at the time of writing, no upgrades:

| Mission | Careful | Casual | Never steers |
|---|---|---|---|
| 1 | 100% | 72% | 17% |
| 5 | 99% | 34% | 2% |
| 12 | 95% | 19% | 1% |
| 20 | 86% | 7% | 1% |

## Status

Tested in headless Chromium with touch emulation. Not yet verified by ear or on a physical phone.
