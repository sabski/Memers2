const CHARACTERS = {
  doge: {
    name: 'Doge',
    emoji: '🐕',
    flavor: 'wow such damage',
    baseHp: 30,
    baseAtk: 8,
    baseDef: 3,
    critChance: 0.35,
    critMult: 2,
    special: 'much_wow',
    specialDesc: 'Crits deal 3x instead of 2x damage',
    color: '#FFD700',
    applySpecial(player) { player.critMult = 3; }
  },
  grumpy: {
    name: 'Grumpy Cat',
    emoji: '🐱',
    flavor: 'No.',
    baseHp: 35,
    baseAtk: 5,
    baseDef: 8,
    critChance: 0.1,
    critMult: 2,
    special: 'no',
    specialDesc: 'Passive 20% damage reduction',
    color: '#9370DB',
    applySpecial(player) { player.passiveDmgReduction = 0.2; }
  },
  duck: {
    name: 'Duck w/ Knife',
    emoji: '🦆',
    flavor: 'unhinged energy',
    baseHp: 22,
    baseAtk: 14,
    baseDef: 2,
    critChance: 0.2,
    critMult: 2,
    special: 'unhinged',
    specialDesc: 'Attacks twice per turn',
    color: '#FF6600',
    applySpecial(player) { player.attackTwice = true; }
  },
  pepe: {
    name: 'Pepe the Frog',
    emoji: '🐸',
    flavor: 'feels bad man',
    baseHp: 28,
    baseAtk: 9,
    baseDef: 5,
    critChance: 0.2,
    critMult: 2,
    special: 'rare_pepe',
    specialDesc: 'Random stat buff each floor',
    color: '#00CC44',
    applySpecial(player) { /* triggered on floor entry */ }
  },
  raccoon: {
    name: 'Trash Panda',
    emoji: '🦝',
    flavor: 'dumpster fire energy',
    baseHp: 28,
    baseAtk: 8,
    baseDef: 5,
    critChance: 0.2,
    critMult: 2,
    special: 'dumpster_dive',
    specialDesc: 'Finds double items',
    color: '#AAAAAA',
    applySpecial(player) { player.doubleItems = true; }
  }
};

function createPlayer(charKey) {
  const def = CHARACTERS[charKey];
  const player = {
    charKey,
    emoji: def.emoji,
    name: def.name,
    color: def.color,
    x: 0,
    y: 0,
    maxHp: def.baseHp,
    hp: def.baseHp,
    atk: def.baseAtk,
    def: def.baseDef,
    critChance: def.critChance,
    critMult: def.critMult,
    special: def.special,
    passiveDmgReduction: 0,
    attackTwice: false,
    rareBuffActive: false,
    doubleItems: false,
    atkBonus: 0,
    defBonus: 0,
    alive: true
  };
  def.applySpecial(player);
  return player;
}
