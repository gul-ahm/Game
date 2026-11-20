export const GLOW = 0x7cf7ff;

export const CONSTRUCTS = {
  tap: { name: 'Bolt', cost: 6, hint: 'Quick shot at the spot you click' },
  line: { name: 'Lance', cost: 16, hint: 'Piercing spear thrown along your stroke' },
  circle: { name: 'Aegis / Cage', cost: 24, hint: 'Around you: a shield. Elsewhere: a cage' },
  triangle: { name: 'Hammer', cost: 30, hint: 'Giant hammer that slams the spot' },
  square: { name: 'Wall', cost: 18, hint: 'Solid wall. Blocks shots, and you can climb it' },
  zigzag: { name: 'Storm', cost: 28, hint: 'Lightning that jumps between targets' },
};

export const NAMES = { bolt: 'Bolt', lance: 'Lance', aegis: 'Aegis', cage: 'Cage', hammer: 'Hammer', wall: 'Wall', storm: 'Storm' };

export const GOALS = [
  { id: 'all', text: 'Forge all six shapes' },
  { id: 'perfect', text: 'Draw a perfect form (90% or better)' },
  { id: 'climb', text: 'Stand on top of a wall you forged' },
  { id: 'launch', text: 'Launch a crate into the air with a hammer' },
  { id: 'chain', text: 'Chain one storm through three targets' },
  { id: 'cage', text: 'Trap three Hollows in one cage' },
  { id: 'block', text: 'Block 10 enemy shots' },
  { id: 'ringout', text: 'Knock a foe off the island' },
  { id: 'wave5', text: 'Clear wave 5 in the Trial' },
];
