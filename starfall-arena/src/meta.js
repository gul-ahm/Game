export const MODES = {
  easy: { name: 'Cadet', note: 'Weaker enemies and slower waves. Good for a first flight.', hp: 0.75, speed: 0.9, dmg: 0.7, pace: 1.25, score: 0.75, credits: 0.75 },
  normal: { name: 'Pilot', note: 'The standard fight.', hp: 1, speed: 1, dmg: 1, pace: 1, score: 1, credits: 1 },
  hard: { name: 'Veteran', note: 'Tougher, faster enemies and bigger waves. Pays more credits.', hp: 1.35, speed: 1.12, dmg: 1.4, pace: 0.8, score: 1.6, credits: 1.5 },
  insane: { name: 'Nightmare', note: 'Everything hits hard and the waves never slow down.', hp: 1.8, speed: 1.25, dmg: 1.9, pace: 0.62, score: 2.5, credits: 2.2 },
};

export const SECTORS = [
  { name: 'Azure Drift', deep: 0x05050f, cloud: 0x6b2fb0, mist: 0x0070a8, grid: 0x3355ff, edge: 0x33ccff },
  { name: 'Ember Reach', deep: 0x0f0504, cloud: 0xa83a1c, mist: 0x8a5a00, grid: 0xff5533, edge: 0xff8833 },
  { name: 'Verdant Rift', deep: 0x040f08, cloud: 0x1f8a4a, mist: 0x2a7a8a, grid: 0x22cc77, edge: 0x44ffaa },
  { name: 'Void Crown', deep: 0x0c040f, cloud: 0x9a2070, mist: 0x6a3aa8, grid: 0xcc44ff, edge: 0xff66dd },
];

export const SHOP = [
  { id: 'armor', name: 'Plated Hull', desc: 'Start with 10 more hull per rank', max: 5, cost: 60 },
  { id: 'reactor', name: 'Shield Reactor', desc: 'Start with 10 more shield per rank', max: 5, cost: 60 },
  { id: 'cannon', name: 'Tuned Cannons', desc: 'Deal 6% more damage per rank', max: 5, cost: 80 },
  { id: 'engine', name: 'Ion Engine', desc: 'Fly 4% faster per rank', max: 5, cost: 50 },
  { id: 'scanner', name: 'Salvage Scanner', desc: 'Earn 10% more credits per rank', max: 5, cost: 100 },
  { id: 'echo', name: 'Echo Chamber', desc: 'One more echo of a past run fights beside you per rank', max: 2, cost: 200 },
  { id: 'head', name: 'Head Start', desc: 'Begin each run with a free upgrade per rank', max: 2, cost: 250 },
];

export const shopCost = (item, rank) => item.cost * (rank + 1);

export const MEDALS = [
  { id: 'first', name: 'First Blood', desc: 'Destroy your first enemy', reward: 20, test: g => g.kills >= 1 },
  { id: 'hunter', name: 'Hunter', desc: 'Destroy 100 enemies in one run', reward: 60, test: g => g.kills >= 100 },
  { id: 'reaper', name: 'Reaper', desc: 'Destroy 400 enemies in one run', reward: 150, test: g => g.kills >= 400 },
  { id: 'combo', name: 'Chain Master', desc: 'Reach a x8 combo', reward: 80, test: g => g.combo >= 8 },
  { id: 'clean', name: 'Untouchable', desc: 'Clear a wave after wave 2 without taking a hit', reward: 80, test: g => g.cleanWaves >= 1 },
  { id: 'crystals', name: 'Collector', desc: 'Collect 300 crystals in one run', reward: 80, test: g => g.crystals >= 300 },
  { id: 'loaded', name: 'Fully Loaded', desc: 'Reach level 15', reward: 120, test: g => g.level >= 15 },
  { id: 'horizon', name: 'Event Horizon', desc: 'Swallow 25 enemy shots with one gravity well', reward: 100, test: g => g.well.best >= 25 },
  { id: 'warden', name: 'Warden Down', desc: 'Defeat the Warden', reward: 100, test: g => g.bossKills >= 1 },
  { id: 'veteran', name: 'Hardened', desc: 'Defeat the Warden on Veteran or above', reward: 200, test: g => g.bossKills >= 1 && g.mode.hp > 1 },
  { id: 'wave10', name: 'Deep Space', desc: 'Reach wave 10', reward: 100, test: g => g.wave >= 10 },
  { id: 'wave20', name: 'Far Edge', desc: 'Reach wave 20', reward: 250, test: g => g.wave >= 20 },
  { id: 'fearless', name: 'No Fear', desc: 'Reach wave 10 on Nightmare', reward: 400, test: g => g.wave >= 10 && g.save.mode === 'insane' },
];
