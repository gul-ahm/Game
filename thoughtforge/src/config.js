export const ISLAND = 60;
export const TAU = Math.PI * 2;

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
