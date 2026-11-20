const UPGRADES = [
  { id: 'rate', icon: '≫', name: 'Rapid Fire', desc: 'Fire 18% faster', max: 6, apply: p => (p.fireRate *= 0.82) },
  { id: 'damage', icon: '◆', name: 'Heavy Rounds', desc: 'Shots deal 25% more damage', max: 8, apply: p => (p.damage *= 1.25) },
  { id: 'split', icon: '⋔', name: 'Split Shot', desc: 'Fire one more shot each time', max: 4, apply: p => p.shots++ },
  { id: 'pierce', icon: '↟', name: 'Piercing Core', desc: 'Shots pass through one more enemy', max: 3, apply: p => p.pierce++ },
  { id: 'speed', icon: '▲', name: 'Thrusters', desc: 'Move 12% faster', max: 5, apply: p => (p.speed *= 1.12) },
  { id: 'hull', icon: '✚', name: 'Strong Hull', desc: 'Add 25 max hull and repair fully', max: 6, apply: p => (p.hp = p.maxHp += 25) },
  {
    id: 'shield', icon: '◯', name: 'Shield Cell', desc: 'Add 20 shield and recharge faster', max: 5,
    apply: p => {
      p.maxShield += 20;
      p.shieldRegen += 3;
    },
  },
  { id: 'magnet', icon: '∩', name: 'Tractor Beam', desc: 'Pull crystals from 50% further', max: 4, apply: p => (p.magnet *= 1.5) },
  { id: 'dash', icon: '»', name: 'Quick Dash', desc: 'Dash recharges 25% faster', max: 4, apply: p => (p.dashCd *= 0.75) },
  { id: 'nova', icon: '✹', name: 'Nova Burst', desc: 'Dash releases a ring of shots', max: 3, apply: p => p.nova++ },
  { id: 'well', icon: '◉', name: 'Dense Core', desc: 'Gravity well lasts longer and reaches further', max: 3, apply: p => p.wellPower++ },
  { id: 'orbs', icon: '●', name: 'Guard Orbs', desc: 'Add an orb that circles and burns enemies', max: 4, apply: p => p.orbs++ },
];

const RELICS = [
  { id: 'twin', icon: '⋕', name: 'Twin Cannons', desc: 'Fire two more shots each time', max: 2, apply: p => (p.shots += 2) },
  { id: 'leech', icon: '♥', name: 'Leech Core', desc: 'Every kill repairs 1 hull', max: 3, apply: p => p.leech++ },
  { id: 'blast', icon: '✸', name: 'Volatile Rounds', desc: 'Enemies explode and hurt others nearby', max: 3, apply: p => p.blast++ },
  {
    id: 'aegis', icon: '⬡', name: 'Aegis', desc: 'Add 40 shield. It recharges after one second', max: 1,
    apply: p => {
      p.maxShield += 40;
      p.shieldWait = 1;
    },
  },
  {
    id: 'clock', icon: '◷', name: 'Overclock', desc: 'Fire 30% faster and move 15% faster', max: 2,
    apply: p => {
      p.fireRate *= 0.7;
      p.speed *= 1.15;
    },
  },
  { id: 'prism', icon: '◈', name: 'Crystal Prism', desc: 'Every crystal counts double', max: 1, apply: p => (p.gemValue *= 2) },
];

const ALL = [...UPGRADES, ...RELICS];
export const findUpgrade = id => ALL.find(u => u.id === id);

export function rollUpgrades(player, n, kind) {
  const pool = (kind === 'relic' ? RELICS : UPGRADES).filter(u => (player.taken[u.id] || 0) < u.max);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n).map(u => ({ ...u, relic: kind === 'relic' }));
}
