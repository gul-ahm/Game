export const ARENA = 90;
export const TAU = Math.PI * 2;

export const rand = (a, b) => a + Math.random() * (b - a);
export const near = (a, b, r) => {
  const dx = a.x - b.x, dz = a.z - b.z;
  return dx * dx + dz * dz < r * r;
};
