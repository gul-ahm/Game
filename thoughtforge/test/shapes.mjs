// Builds noisy hand style strokes for the tests and the bot.
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

function walk(corners, closed, noise) {
  const pts = [];
  const last = closed ? corners.length : corners.length - 1;
  for (let i = 0; i < last; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length];
    for (let t = 0; t < 1; t += 0.08) {
      pts.push({ x: a.x + (b.x - a.x) * t + rand(-noise, noise), y: a.y + (b.y - a.y) * t + rand(-noise, noise) });
    }
  }
  const end = closed ? corners[0] : corners[corners.length - 1];
  pts.push({ x: end.x + rand(-noise, noise), y: end.y + rand(-noise, noise) });
  return pts;
}

function polygon(n, cx, cy, r, squash) {
  const spin = rand(0, TAU);
  return Array.from({ length: n }, (_, i) => {
    const a = spin + (i / n) * TAU;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * squash };
  });
}

// Start a closed stroke anywhere along the outline, as a person would.
function rotateStart(pts) {
  const cut = Math.floor(rand(0, pts.length - 1));
  const body = pts.slice(0, -1);
  const turned = [...body.slice(cut), ...body.slice(0, cut)];
  return [...turned, { ...turned[0] }];
}

export function draw(shape, cx = 400, cy = 400, r = rand(50, 160), noise = r * 0.025) {
  if (shape === 'tap') return [{ x: cx, y: cy }, { x: cx + 2, y: cy + 1 }];
  if (shape === 'line') {
    const a = rand(0, TAU);
    return walk([{ x: cx - Math.cos(a) * r, y: cy - Math.sin(a) * r }, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }], false, noise);
  }
  if (shape === 'circle') {
    const start = rand(0, TAU), wobble = rand(0.9, 1.1);
    const pts = [];
    for (let t = 0; t <= 1.02; t += 0.03) {
      const a = start + t * TAU;
      pts.push({ x: cx + Math.cos(a) * r + rand(-noise, noise), y: cy + Math.sin(a) * r * wobble + rand(-noise, noise) });
    }
    return pts;
  }
  if (shape === 'triangle') return rotateStart(walk(polygon(3, cx, cy, r, rand(0.85, 1)), true, noise));
  if (shape === 'square') return rotateStart(walk(polygon(4, cx, cy, r, rand(0.7, 1)), true, noise));
  const teeth = Math.floor(rand(3, 6));
  const a = rand(0, TAU), ux = Math.cos(a), uy = Math.sin(a);
  const corners = Array.from({ length: teeth + 1 }, (_, i) => {
    const along = (i / teeth - 0.5) * 2 * r, side = (i % 2 ? 1 : -1) * r * 0.35;
    return { x: cx + ux * along - uy * side, y: cy + uy * along + ux * side };
  });
  return walk(corners, false, noise);
}
