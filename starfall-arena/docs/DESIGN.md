# Design notes

## Goal

A browser arena shooter where the player controls space and time as well as a gun.
Two systems carry that idea.

### Gravity well

Right click or Q opens a well at the cursor for a few seconds.

* Enemies inside its reach are dragged toward the core. The boss resists most of the pull.
* Enemy shots bend toward the core and are swallowed when they reach it.
* When the well closes it collapses. It damages enemies close to the core and fires a ring of
  player shots. Each swallowed shot adds two shots to the ring and five damage to the collapse.

This turns enemy fire into a resource. A dense bullet pattern is a reason to cast the well, not
only a thing to dodge.

### Echoes

Every run records the ship ten times per second: position, facing and whether it was firing.
The three best runs are kept in the browser. At the start of a new run the best one or more of
them return as ghost ships that follow the old path and fire weaker shots.

An echo ends at the moment the old run ended. It leaves a power up at that spot, so the place
where you lost last time becomes a reward this time.

## Structure

The game logic never touches the page. `Game` receives a scene, a camera, and three small
helpers for display, input and sound. The tests pass in plain stand ins for those helpers, so
the whole game can run in Node without a browser.

| Layer | Files | Notes |
| --- | --- | --- |
| Loop and rules | `game.js` | State, waves, collisions, rewards |
| Actors | `player.js` `enemies.js` `gravity.js` `echo.js` | Each owns its meshes and update step |
| Pools | `bullets.js` `particles.js` `pickups.js` | Fixed size, drawn as one batch each |
| Data | `meta.js` `upgrades.js` | Modes, sectors, shop, medals, upgrades, relics |
| Shell | `main.js` `hud.js` `input.js` `audio.js` `save.js` | Browser only code |

All moving things live on one flat plane and store plain `x` and `z` numbers. Collision is a
circle check on those numbers, which keeps every system simple and fast.

## Balance

Each mode scales enemy health, speed, damage and wave pace with one row in `meta.js`.
Enemy health grows ten percent per wave. Level cost grows 22 percent per level.

## Tests

`npm test` runs unit tests for rules and rewards, then a bot plays every mode for several
minutes of game time and fails on any error or invalid number.
