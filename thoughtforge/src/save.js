const KEY = 'thoughtforge.save';
const blank = () => ({ best: 0, goals: {} });

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
