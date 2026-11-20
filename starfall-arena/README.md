# Starfall Arena

A 3D space survival shooter that runs in the browser. Built with Three.js.

## Play

Open `index.html` in Chrome, Edge, Safari or Firefox. No install is needed.

## Controls

| Key | Action |
| --- | --- |
| W A S D or arrows | Move |
| Mouse | Aim |
| Left click (hold) | Fire |
| Space | Dash, you take no damage for a short moment |
| Right click or Q | Gravity well |
| P or Esc | Pause |
| M | Sound on or off |
| 1 2 3 | Pick an upgrade |
| Enter | Start or restart |

## How it works

* Right click or Q opens a gravity well. It drags enemies in, swallows their shots and fires them back.
* Your best past runs return as echo ships that fight beside you.
* Pick one of four modes: Cadet, Pilot, Veteran or Nightmare. Harder modes pay more score and credits.
* Enemies arrive in waves. Every five waves form a sector with its own colors.
* Seven enemy types appear over time. From wave 7 some enemies are gold elites that drop a power up.
* Destroyed enemies and asteroids drop green crystals. Crystals fill the level bar.
* Each new level lets you pick one of three upgrades.
* Every fifth wave brings the Warden. Beating it gives a rare relic.
* Gold rings are power ups: Overdrive, Tractor Pulse or Shockwave.
* Quick kills build a combo that multiplies your score, up to x8.
* Pink orbs repair the hull. The shield refills by itself after a short time without damage.
* Runs earn credits. Spend them in the Hangar on permanent ship parts.
* Twelve medals give extra credits. Nightmare unlocks after you beat the Warden on Veteran.
* Progress is saved in the browser.

## Change the game

The source is in `src`. After a change, rebuild the bundle:

```
npm install
npm run build
```

`npm run dev` rebuilds on every save and serves the game on a local address.
`npm test` plays the game logic without a browser and reports any error.

| File | Purpose |
| --- | --- |
| `main.js` | Renderer, bloom effect, main loop |
| `game.js` | Game state, waves, collisions, score, camera |
| `player.js` | Ship model, movement, weapons, dash |
| `enemies.js` | Enemy types, movement, boss attacks |
| `world.js` | Nebula, stars, arena, planet, asteroids |
| `bullets.js` `particles.js` `pickups.js` | Pooled objects drawn in batches |
| `gravity.js` `echo.js` | Gravity well and echo ships |
| `upgrades.js` | Upgrades and relics, easy to extend |
| `meta.js` `save.js` | Modes, sectors, hangar parts, medals, saved progress |
| `hud.js` `audio.js` `input.js` | Interface, sound, controls |

See `docs/DESIGN.md` for the ideas behind the game and how the code is laid out.
