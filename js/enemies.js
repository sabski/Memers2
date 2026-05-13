const ENEMIES = {
  trollface: {
    name: 'Trollface',
    emoji: '😈',
    baseHp: 18,
    baseAtk: 7,
    baseDef: 2,
    aggroRange: 6,
    xpValue: 5,
    floorMin: 1,
    isBoss: false,
    color: '#FF4444',
    deathQuip: 'Problem? lol'
  },
  wojak: {
    name: 'Wojak',
    emoji: '😢',
    baseHp: 14,
    baseAtk: 5,
    baseDef: 1,
    aggroRange: 4,
    xpValue: 3,
    floorMin: 1,
    isBoss: false,
    color: '#AAAAAA',
    deathQuip: 'feels bad man'
  },
  chad: {
    name: 'Chad',
    emoji: '💪',
    baseHp: 30,
    baseAtk: 12,
    baseDef: 5,
    aggroRange: 5,
    xpValue: 10,
    floorMin: 2,
    isBoss: false,
    color: '#4488FF',
    deathQuip: 'L + ratio'
  },
  nyancat: {
    name: 'Nyan Cat',
    emoji: '🌈',
    baseHp: 22,
    baseAtk: 8,
    baseDef: 3,
    aggroRange: 8,
    xpValue: 7,
    floorMin: 2,
    isBoss: false,
    color: '#FF69B4',
    deathQuip: 'nyaaaan...'
  },
  bigchungus: {
    name: 'BIG CHUNGUS',
    emoji: '🐰',
    baseHp: 80,
    baseAtk: 18,
    baseDef: 8,
    aggroRange: 99,
    xpValue: 100,
    floorMin: 5,
    isBoss: true,
    color: '#FF8800',
    deathQuip: 'YOU WIN LOL GG'
  }
};

let _enemyIdCounter = 0;

function createEnemy(enemyKey, x, y, floor) {
  const def = ENEMIES[enemyKey];
  const scale = def.isBoss ? 1 : (1 + (floor - 1) * 0.2);
  return {
    id: 'e_' + (++_enemyIdCounter),
    enemyKey,
    emoji: def.emoji,
    name: def.name,
    color: def.color,
    isBoss: def.isBoss || false,
    deathQuip: def.deathQuip,
    x,
    y,
    hp: Math.round(def.baseHp * scale),
    maxHp: Math.round(def.baseHp * scale),
    atk: Math.round(def.baseAtk * scale),
    def: Math.round(def.baseDef * scale),
    aggroRange: def.aggroRange,
    alive: true,
    aiState: 'idle'
  };
}

function getEligibleEnemyKeys(floor) {
  return Object.keys(ENEMIES).filter(k => {
    const e = ENEMIES[k];
    return !e.isBoss && e.floorMin <= floor;
  });
}
