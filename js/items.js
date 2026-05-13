const ITEMS = {
  health_potion: {
    name: 'Dank Potion',
    emoji: '🧪',
    desc: '+15 HP',
    rarity: 0.4,
    splash: 'HEALED LOL',
    apply(player) {
      player.hp = Math.min(player.maxHp, player.hp + 15);
    }
  },
  atk_upgrade: {
    name: 'Big Iron',
    emoji: '⚔️',
    desc: '+3 ATK',
    rarity: 0.3,
    splash: 'SWOLE',
    apply(player) {
      player.atkBonus += 3;
    }
  },
  def_upgrade: {
    name: 'Meme Shield',
    emoji: '🛡️',
    desc: '+2 DEF',
    rarity: 0.2,
    splash: 'BLOCKED XD',
    apply(player) {
      player.defBonus += 2;
    }
  },
  max_hp_upgrade: {
    name: 'Sigma Grindset',
    emoji: '💊',
    desc: '+10 Max HP',
    rarity: 0.1,
    splash: 'GIGACHAD',
    apply(player) {
      player.maxHp += 10;
      player.hp = Math.min(player.maxHp, player.hp + 10);
    }
  }
};

let _itemIdCounter = 0;

function pickWeightedItem() {
  const keys = Object.keys(ITEMS);
  const total = keys.reduce((s, k) => s + ITEMS[k].rarity, 0);
  let r = Math.random() * total;
  for (const k of keys) {
    r -= ITEMS[k].rarity;
    if (r <= 0) return k;
  }
  return keys[0];
}

function createItem(itemKey, x, y) {
  const def = ITEMS[itemKey];
  return {
    id: 'i_' + (++_itemIdCounter),
    itemKey,
    emoji: def.emoji,
    name: def.name,
    desc: def.desc,
    splash: def.splash,
    x,
    y,
    picked: false
  };
}
