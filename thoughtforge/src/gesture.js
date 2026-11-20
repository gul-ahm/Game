// Reads a hand drawn stroke and names the shape.
// Works on plain {x, y} points, so it runs the same in the browser and in tests.

const SAMPLES = 64;
const TAP_SIZE = 24;
const IDEAL = { circle: 1, square: 0.785, triangle: 0.605 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(pts) {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += dist(pts[i - 1], pts[i]);
  return sum;
}

// Evenly spaced points along the stroke, so drawing speed does not matter.
export function resample(pts, n = SAMPLES) {
  const step = pathLength(pts) / (n - 1);
  const out = [pts[0]];
  let prev = pts[0];
  let carried = 0;
  for (let i = 1; i < pts.length; i++) {
    let seg = dist(prev, pts[i]);
    while (carried + seg >= step && out.length < n && seg > 0) {
      const t = (step - carried) / seg;
      prev = { x: prev.x + (pts[i].x - prev.x) * t, y: prev.y + (pts[i].y - prev.y) * t };
      out.push(prev);
      seg = dist(prev, pts[i]);
      carried = 0;
    }
    carried += seg;
    prev = pts[i];
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}

// Ramer Douglas Peucker: keeps only the points where the stroke really bends.
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  const len = dist(a, b);
  let far = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    // On a closed outline the two ends meet, so measure from the start point instead.
    const d = len < eps
      ? dist(p, a)
      : Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
    if (d > far) {
      far = d;
      at = i;
    }
  }
  if (far <= eps) return [a, b];
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)];
}

function area(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function turn(a, b, c) {
  const one = Math.atan2(b.y - a.y, b.x - a.x);
  const two = Math.atan2(c.y - b.y, c.x - b.x);
  return Math.abs(Math.atan2(Math.sin(two - one), Math.cos(two - one)));
}

// Corners of a closed outline. The stroke may begin in the middle of a side,
// so the join only counts when the outline really bends there.
function closedCorners(pts, eps) {
  const key = simplify(pts, eps);
  let corners = key.length - 2;
  if (key.length >= 3 && turn(key[key.length - 2], key[0], key[1]) > 0.6) corners++;
  return corners;
}

export function recognise(raw) {
  if (!raw || raw.length < 2) return null;
  const pts = resample(raw);
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const size = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const result = (shape, clarity) => ({ shape, clarity: Math.min(1, Math.max(0, clarity)), size });

  if (size < TAP_SIZE) return result('tap', 1);

  const length = pathLength(pts);
  const chord = dist(pts[0], pts[pts.length - 1]);
  const straight = chord / length;
  if (straight > 0.93) return result('line', (straight - 0.93) / 0.06);

  if (chord < size * 0.3) {
    const round = (4 * Math.PI * area(pts)) / (length * length);
    if (round > 0.87) return result('circle', 1 - (1 - round) * 4);
    const shape = closedCorners(pts, size * 0.09) <= 3 ? 'triangle' : 'square';
    return result(shape, 1 - Math.abs(round - IDEAL[shape]) * 4);
  }

  const bends = simplify(pts, size * 0.1).length - 2;
  if (bends >= 2) return result('zigzag', 0.4 + bends * 0.2);
  return result('line', straight * 0.5);
}
