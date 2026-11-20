# Game

Two 3D games for the browser, built with Three.js. Each game is a self contained folder.

| Game | Folder | Idea |
| --- | --- | --- |
| **ThoughtForge** | [`thoughtforge`](thoughtforge) | Draw a shape with the mouse and it becomes a weapon made of light on a floating island |
| **Starfall Arena** | [`starfall-arena`](starfall-arena) | Space arena shooter with a gravity well that throws enemy fire back, and echoes of your past runs |

## Play

Open `index.html` inside either folder in a modern browser. The built bundle is in each `dist` folder,
so nothing needs to be installed to play.

## Develop

Both games use the same scripts:

```
cd thoughtforge        # or starfall-arena
npm install
npm run dev            # rebuild on save and serve locally
npm test               # unit tests, then a bot plays the game
npm run build          # write dist/game.js
```

CI runs the tests and the build for both games on every push.
