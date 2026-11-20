const KEY = 'starfall.save';
const blank = () => ({ credits: 0, shop: {}, medals: {}, best: {}, mode: 'normal' });

export function load() {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return blank();
  }
}

export function store(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

const ECHO_KEY = 'starfall.echoes';

export function loadEchoes() {
  try {
    return JSON.parse(localStorage.getItem(ECHO_KEY)) || [];
  } catch {
    return [];
  }
}

export function storeEcho(run, keep = 3) {
  const runs = [...loadEchoes(), run].sort((a, b) => b.score - a.score).slice(0, keep);
  try {
    localStorage.setItem(ECHO_KEY, JSON.stringify(runs));
  } catch {}
}
