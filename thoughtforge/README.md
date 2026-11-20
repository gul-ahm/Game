# ThoughtForge

A 3D playground in the browser where you fight with your imagination.
Draw a shape with the mouse and Vey, the Will Bearer, forges it into a weapon made of light.

Built with Three.js.

## Play

Open `index.html` in Chrome, Edge, Safari or Firefox. No install is needed.

## Forging

Hold the left mouse button, draw a shape anywhere on the screen, and let go.
Where you draw matters: the construct appears at that spot on the island.

| Shape | Construct | What it does |
| --- | --- | --- |
| Tap | Bolt | Quick shot at the spot or foe you click |
| Line | Lance | Piercing spear thrown along the line you drew |
| Circle around Vey | Aegis | Shield that soaks damage and shoves foes away |
| Circle elsewhere | Cage | Traps every foe inside and burns them slowly |
| Triangle | Hammer | Giant hammer swings down and blasts the spot |
| Square | Wall | Solid wall that blocks shots. You can climb on it |
| Zigzag | Storm | Lightning that jumps from foe to foe |

Every construct costs will. Will refills on its own, faster when you rest.
A cleaner drawing makes a stronger construct, and a 90% form is a Perfect cast.

## Modes

* **Playground**: training dummies, crates and nine training goals. You cannot get hurt. Press H to summon Hollows.
* **Trial**: waves of Hollows, spitters and brutes. Score as much as you can before your health runs out.

## Controls

| Key | Action |
| --- | --- |
| Left drag | Draw a shape |
| W A S D | Move |
| Shift | Run |
| Space | Jump |
| Right drag, Q, E | Turn the camera |
| Mouse wheel | Zoom |
| H | Summon Hollows in the Playground |
| P or Esc | Pause |
| M | Sound on or off |

## Develop

```
npm install
npm run build   # bundle src into dist/game.js
npm run dev     # rebuild on save and serve locally
npm test        # unit tests, then a bot plays both modes
```

See `docs/DESIGN.md` for how the game works inside.
