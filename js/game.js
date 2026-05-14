const GameState = {
  state: 'MENU',
  player: null,
  dungeon: null,
  currentFloor: 1,
  turn: 0,
  stats: { floorsCleared: 0, enemiesKilled: 0, itemsFound: 0, turnsPlayed: 0, victory: false },

  // Multiplayer — null when solo
  // { mode, myNum, isHost, roomCode, activeTurn, pendingOppCharKey }
  mp: null,
  opponent: null,

  selectCharacter(charKey) {
    this.player = createPlayer(charKey);
    this.currentFloor = 1;
    this.stats = { floorsCleared: 0, enemiesKilled: 0, itemsFound: 0, turnsPlayed: 0, victory: false };

    if (this.mp) {
      // Tell opponent which character we picked
      MP.send('char_selected', { charKey });
      const opp = this.mp.pendingOppCharKey;
      if (this.mp.isHost && opp) {
        // Both chars known — generate dungeon now
        startMPRound(opp);
      } else {
        // Wait for opponent to also select
        this.state = 'WAITING';
        document.getElementById('waiting-room-code').textContent = this.mp.roomCode;
        UI.showScreen('WAITING');
      }
    } else {
      // Solo
      this.state = 'PLAYING';
      this.dungeon = generateDungeon(this.currentFloor, this.player);
      updateFOV(this.dungeon, this.player);
      UI.clearLog();
      UI.addToLog(`${this.player.emoji} ${this.player.name} enters the dungeon...`, 'system');
      UI.addToLog('WASD/arrows to move, walk into enemies to attack', 'system');
      UI.showScreen('PLAYING');
      Renderer.render(this.dungeon, this.player);
      UI.updateHUD(this.player, this.currentFloor);
    }
  },

  descend() {
    const bossAlive = this.dungeon.entities.some(e => e.isBoss && e.alive);
    if (this.currentFloor === 5 && bossAlive) {
      UI.addToLog('🐰 BIG CHUNGUS BLOCKS THE STAIRS!', 'warn');
      UI.spawnSplash('NO PASSAGE', this.player.x, this.player.y, 'system');
      return false;
    }
    if (this.currentFloor >= 5) {
      this.stats.floorsCleared = 5;
      this.stats.victory = true;
      setTimeout(() => UI.showDeathScreen(true, this.stats), 400);
      return true;
    }
    this.currentFloor++;
    this.stats.floorsCleared = this.currentFloor - 1;
    if (this.player.special === 'rare_pepe') applyRarePepeBuff(this.player, this.currentFloor);
    this.dungeon = generateDungeon(this.currentFloor, this.player);
    updateFOV(this.dungeon, this.player);
    UI.clearLog();
    UI.addToLog(`📍 Floor ${this.currentFloor} — it gets worse`, 'system');
    if (this.currentFloor === 5) {
      UI.addToLog('💀 BIG CHUNGUS AWAITS...', 'warn');
      UI.spawnSplash('FLOOR 5: BOSS', this.player.x, this.player.y, 'boss');
    }
    Renderer.render(this.dungeon, this.player);
    UI.updateHUD(this.player, this.currentFloor);
    return true;
  }
};

window.GameState = GameState;

// ── Solo helpers ──────────────────────────────────────────────────────────────

function applyRarePepeBuff(player, floor) {
  const BUFFS = [
    () => { player.atkBonus += 3; return '+3 ATK'; },
    () => { player.defBonus += 2; return '+2 DEF'; },
    () => { player.critChance = Math.min(0.8, player.critChance + 0.1); return '+10% CRIT'; },
    () => { player.maxHp += 8; player.hp = Math.min(player.maxHp, player.hp + 8); return '+8 MAX HP'; },
    () => { player.critMult = +(player.critMult + 0.5).toFixed(1); return '+0.5x CRIT DMG'; }
  ];
  const desc = BUFFS[Math.floor(Math.random() * BUFFS.length)]();
  UI.addToLog(`🐸 RARE PEPE ACTIVATED: ${desc}!`, 'item');
  UI.spawnSplash(`RARE PEPE! ${desc}`, player.x, player.y, 'item');
}

function doPlayerTurn(dx, dy) {
  const { player, dungeon } = GameState;
  if (!player || !player.alive) return;
  const tx = player.x + dx;
  const ty = player.y + dy;
  if (tx < 0 || ty < 0 || tx >= dungeon.width || ty >= dungeon.height) return;
  if (dungeon.tiles[ty][tx] === TILE.WALL) return;

  const enemy = dungeon.entities.find(e => e.alive && e.x === tx && e.y === ty);
  if (enemy) {
    const results = playerAttack(player, enemy);
    const totalDmg = results.reduce((s, r) => s + r.damage, 0);
    const anyCrit = results.some(r => r.isCrit);
    if (anyCrit) {
      UI.addToLog(`${player.emoji} CRIT ${enemy.emoji} ${enemy.name} for ${totalDmg} dmg!`, 'crit');
      UI.spawnSplash(UI.randomCritQuip(), enemy.x, enemy.y, 'crit');
    } else {
      UI.addToLog(`${player.emoji} hits ${enemy.emoji} ${enemy.name} for ${totalDmg} dmg`, 'damage');
      UI.spawnSplash(`${totalDmg}`, enemy.x, enemy.y);
    }
    if (!enemy.alive) {
      GameState.stats.enemiesKilled++;
      UI.addToLog(`${enemy.emoji} ${enemy.name} defeated! "${enemy.deathQuip}"`, 'system');
      if (enemy.isBoss) UI.spawnSplash('BOSS SLAIN!!!', player.x, player.y, 'boss');
      else UI.spawnSplash(UI.randomQuip(), enemy.x, enemy.y);
    }
  } else {
    player.x = tx; player.y = ty;
    handleItemPickup(player, dungeon);
    handleStairs(player, dungeon);
  }
  if (player.alive) finishTurn();
}

function doWaitTurn() {
  if (!GameState.player || !GameState.player.alive) return;
  UI.addToLog('...', 'system');
  finishTurn();
}

function finishTurn() {
  const { player, dungeon } = GameState;
  GameState.stats.turnsPlayed++;
  GameState.turn++;
  const msgs = runEnemyTurns(dungeon, player);
  for (const m of msgs) {
    if (m.type === 'enemy_attack') {
      UI.addToLog(`${m.enemy.emoji} ${m.enemy.name} hits you for ${m.result.damage} dmg`, 'damage');
      UI.spawnSplash(`-${m.result.damage}`, player.x, player.y, 'crit');
      shakeHUD();
    }
  }
  updateFOV(dungeon, player);
  Renderer.render(dungeon, player);
  UI.updateHUD(player, GameState.currentFloor);
  if (!player.alive) setTimeout(() => UI.showDeathScreen(false, GameState.stats), 600);
}

function handleItemPickup(player, dungeon) {
  const item = dungeon.items.find(i => !i.picked && i.x === player.x && i.y === player.y);
  if (!item) return null;
  item.picked = true;
  GameState.stats.itemsFound++;
  ITEMS[item.itemKey].apply(player);
  UI.addToLog(`✨ Picked up ${item.emoji} ${item.name} (${item.desc})`, 'item');
  UI.spawnSplash(item.splash, player.x, player.y, 'item');
  return item;
}

function handleStairs(player, dungeon) {
  if (dungeon.tiles[player.y][player.x] !== TILE.STAIRS) return;
  GameState.descend();
}

function shakeHUD() {
  const hud = document.getElementById('hud-top');
  hud.classList.remove('shake');
  void hud.offsetWidth;
  hud.classList.add('shake');
  hud.addEventListener('animationend', () => hud.classList.remove('shake'), { once: true });
}

// ── Multiplayer ───────────────────────────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function serializePlayer(p) {
  return { x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, atk: p.atk, def: p.def,
           atkBonus: p.atkBonus, defBonus: p.defBonus, alive: p.alive,
           charKey: p.charKey, emoji: p.emoji, name: p.name };
}

function applySerializedPlayer(target, src) {
  target.x = src.x; target.y = src.y;
  target.hp = src.hp; target.maxHp = src.maxHp;
  target.atk = src.atk; target.def = src.def;
  target.atkBonus = src.atkBonus; target.defBonus = src.defBonus;
  target.alive = src.alive;
}

function syncEntities(list) {
  for (const e of list) {
    const ent = GameState.dungeon.entities.find(x => x.id === e.id);
    if (ent) { ent.hp = e.hp; ent.alive = e.alive; ent.x = e.x; ent.y = e.y; }
  }
}

function syncItems(list) {
  for (const i of list) {
    const item = GameState.dungeon.items.find(x => x.id === i.id);
    if (item) item.picked = i.picked;
  }
}

// Called when host has both character keys and should start the game
function startMPRound(oppCharKey) {
  const mp = GameState.mp;
  const p1 = GameState.player; // host is always P1
  const p2 = createPlayer(oppCharKey);
  GameState.opponent = p2;

  const dungeon = generateDungeon(GameState.currentFloor, p1);
  p2.x = dungeon.p2SpawnPoint.x;
  p2.y = dungeon.p2SpawnPoint.y;
  GameState.dungeon = dungeon;
  updateFOV(dungeon, p1);

  MP.send('dungeon_state', {
    dungeon: serializeDungeon(dungeon),
    p1: serializePlayer(p1),
    p2: serializePlayer(p2),
    floor: GameState.currentFloor
  });

  launchMPGame();
}

function launchMPGame() {
  const { mp, player, dungeon, opponent } = GameState;
  GameState.state = 'PLAYING';
  GameState.turn = 0;
  UI.clearLog();
  UI.addToLog(`${player.emoji} ${player.name} enters the dungeon...`, 'system');
  UI.addToLog(mp.mode === 'vs' ? '⚔️ VS MODE — kill your opponent or the boss!' : '🤝 CO-OP — work together!', 'system');
  UI.showScreen('PLAYING');
  Renderer.render(dungeon, player, opponent);
  UI.updateHUD(player, GameState.currentFloor);
  UI.updateMPHUD(opponent, mp.myNum === mp.activeTurn, mp.mode);
}

function isMyMPTurn() {
  return GameState.mp && GameState.mp.activeTurn === GameState.mp.myNum;
}

function doPlayerTurnMP(dx, dy) {
  const { player, dungeon, mp, opponent } = GameState;
  if (!player || !player.alive) return;
  if (!isMyMPTurn()) { UI.addToLog("Not your turn!", 'warn'); return; }

  const tx = player.x + dx;
  const ty = player.y + dy;
  if (tx < 0 || ty < 0 || tx >= dungeon.width || ty >= dungeon.height) return;
  if (dungeon.tiles[ty][tx] === TILE.WALL) return;

  let attackedOpponent = null;

  // In VS mode: walking into opponent attacks them
  if (mp.mode === 'vs' && opponent && opponent.alive && opponent.x === tx && opponent.y === ty) {
    const results = playerAttack(player, opponent);
    const totalDmg = results.reduce((s, r) => s + r.damage, 0);
    const anyCrit = results.some(r => r.isCrit);
    if (anyCrit) {
      UI.addToLog(`${player.emoji} CRIT ${opponent.emoji} ${opponent.name} for ${totalDmg} dmg!`, 'crit');
      UI.spawnSplash(UI.randomCritQuip(), tx, ty, 'crit');
    } else {
      UI.addToLog(`${player.emoji} hits ${opponent.emoji} ${opponent.name} for ${totalDmg} dmg`, 'damage');
    }
    attackedOpponent = { damage: totalDmg };
    if (!opponent.alive) UI.spawnSplash('ELIMINATED!', tx, ty, 'boss');
  } else if (opponent && opponent.alive && opponent.x === tx && opponent.y === ty) {
    // Can't move into opponent in co-op
    return;
  } else {
    const enemy = dungeon.entities.find(e => e.alive && e.x === tx && e.y === ty);
    if (enemy) {
      const results = playerAttack(player, enemy);
      const totalDmg = results.reduce((s, r) => s + r.damage, 0);
      const anyCrit = results.some(r => r.isCrit);
      if (anyCrit) {
        UI.addToLog(`${player.emoji} CRIT ${enemy.emoji} ${enemy.name} for ${totalDmg} dmg!`, 'crit');
        UI.spawnSplash(UI.randomCritQuip(), enemy.x, enemy.y, 'crit');
      } else {
        UI.addToLog(`${player.emoji} hits ${enemy.emoji} ${enemy.name} for ${totalDmg} dmg`, 'damage');
        UI.spawnSplash(`${totalDmg}`, enemy.x, enemy.y);
      }
      if (!enemy.alive) {
        GameState.stats.enemiesKilled++;
        UI.addToLog(`${enemy.emoji} ${enemy.name} defeated! "${enemy.deathQuip}"`, 'system');
        if (enemy.isBoss) UI.spawnSplash('BOSS SLAIN!!!', player.x, player.y, 'boss');
        else UI.spawnSplash(UI.randomQuip(), enemy.x, enemy.y);
      }
    } else {
      player.x = tx; player.y = ty;
      handleItemPickup(player, dungeon);
    }
  }

  // Broadcast move
  MP.send('player_move', {
    player: serializePlayer(player),
    entities: dungeon.entities.map(e => ({ id: e.id, hp: e.hp, alive: e.alive, x: e.x, y: e.y })),
    items: dungeon.items.map(i => ({ id: i.id, picked: i.picked })),
    attackedOpponent  // non-null only in VS mode when we hit opponent
  });

  // Check stairs
  if (dungeon.tiles[player.y] && dungeon.tiles[player.y][player.x] === TILE.STAIRS) {
    handleStairsMPLocal();
    return;
  }

  // Advance turn
  mp.activeTurn = mp.myNum === 1 ? 2 : 1;
  updateFOV(dungeon, player);
  Renderer.render(dungeon, player, opponent);
  UI.updateHUD(player, GameState.currentFloor);
  UI.updateMPHUD(opponent, false, mp.mode);

  // VS: win if opponent dead
  if (mp.mode === 'vs' && opponent && !opponent.alive) {
    GameState.stats.victory = true;
    MP.send('game_over', { victory: false });
    setTimeout(() => UI.showDeathScreen(true, GameState.stats), 400);
    return;
  }

  // After P2's move, host runs enemy turns
  if (mp.isHost && mp.activeTurn === 1) {
    setTimeout(broadcastEnemyTurns, 300);
  } else if (!mp.isHost && mp.activeTurn === 1) {
    // Guest just moved (guest is P2), signal host
    MP.send('request_enemy_turn', {});
  }
}

function doWaitTurnMP() {
  if (!GameState.player || !GameState.player.alive) return;
  if (!isMyMPTurn()) { UI.addToLog("Not your turn!", 'warn'); return; }
  const { player, dungeon, opponent, mp } = GameState;
  UI.addToLog('...', 'system');
  MP.send('player_move', {
    player: serializePlayer(player),
    entities: dungeon.entities.map(e => ({ id: e.id, hp: e.hp, alive: e.alive, x: e.x, y: e.y })),
    items: dungeon.items.map(i => ({ id: i.id, picked: i.picked })),
    attackedOpponent: null
  });
  mp.activeTurn = mp.myNum === 1 ? 2 : 1;
  updateFOV(dungeon, player);
  Renderer.render(dungeon, player, opponent);
  UI.updateHUD(player, GameState.currentFloor);
  UI.updateMPHUD(opponent, false, mp.mode);
  if (mp.isHost && mp.activeTurn === 1) setTimeout(broadcastEnemyTurns, 300);
  else if (!mp.isHost && mp.activeTurn === 1) MP.send('request_enemy_turn', {});
}

function broadcastEnemyTurns() {
  const { dungeon, player, opponent, mp } = GameState;
  if (!mp || !mp.isHost) return;
  GameState.stats.turnsPlayed++;
  GameState.turn++;

  const msgs = runEnemyTurnsMP(dungeon, player, opponent);

  // Apply locally to host (P1)
  for (const m of msgs) {
    if (m.type === 'enemy_attack' && m.target === player) {
      UI.addToLog(`${m.enemy.emoji} ${m.enemy.name} hits you for ${m.result.damage} dmg`, 'damage');
      UI.spawnSplash(`-${m.result.damage}`, player.x, player.y, 'crit');
      shakeHUD();
    }
  }

  // Build message payloads for guest — target inversion: what hit P1 hits "opponent" on guest
  const msgPayloads = msgs.map(m => ({
    enemyEmoji: m.enemy.emoji,
    enemyName: m.enemy.name,
    damage: m.result.damage,
    targetIsMe: m.target === opponent  // guest is P2 = opponent from host's view
  }));

  MP.send('enemy_turns', {
    entities: dungeon.entities.map(e => ({ id: e.id, hp: e.hp, alive: e.alive, x: e.x, y: e.y })),
    opponentHp: opponent ? opponent.hp : null,
    messages: msgPayloads
  });

  updateFOV(dungeon, player);
  Renderer.render(dungeon, player, opponent);
  UI.updateHUD(player, GameState.currentFloor);
  if (opponent) UI.updateMPHUD(opponent, true, mp.mode);

  if (!player.alive) {
    MP.send('game_over', { victory: false });
    setTimeout(() => UI.showDeathScreen(false, GameState.stats), 600);
    return;
  }
  mp.activeTurn = 1;
  UI.updateMPHUD(opponent, true, mp.mode);
}

function handleStairsMPLocal() {
  const { dungeon, player, mp } = GameState;
  const bossAlive = dungeon.entities.some(e => e.isBoss && e.alive);
  if (GameState.currentFloor === 5 && bossAlive) {
    UI.addToLog('🐰 BIG CHUNGUS BLOCKS THE STAIRS!', 'warn');
    mp.activeTurn = mp.myNum === 1 ? 2 : 1;
    Renderer.render(dungeon, player, GameState.opponent);
    UI.updateMPHUD(GameState.opponent, false, mp.mode);
    return;
  }
  if (GameState.currentFloor >= 5) {
    GameState.stats.victory = true;
    MP.send('game_over', { victory: true });
    setTimeout(() => UI.showDeathScreen(true, GameState.stats), 400);
    return;
  }
  if (!mp.isHost) {
    MP.send('request_floor_change', {});
    UI.addToLog('📍 Descending... waiting for host', 'system');
    mp.activeTurn = mp.myNum === 1 ? 2 : 1;
    UI.updateMPHUD(GameState.opponent, false, mp.mode);
    return;
  }
  // Host handles floor change
  changeFloorMP();
}

function changeFloorMP() {
  const { player, mp } = GameState;
  GameState.currentFloor++;
  GameState.stats.floorsCleared = GameState.currentFloor - 1;
  if (player.special === 'rare_pepe') applyRarePepeBuff(player, GameState.currentFloor);

  const dungeon = generateDungeon(GameState.currentFloor, player);
  GameState.dungeon = dungeon;
  const p2Pos = dungeon.p2SpawnPoint;
  if (GameState.opponent) { GameState.opponent.x = p2Pos.x; GameState.opponent.y = p2Pos.y; }
  updateFOV(dungeon, player);

  MP.send('floor_change', {
    floor: GameState.currentFloor,
    dungeon: serializeDungeon(dungeon),
    p1: { x: player.x, y: player.y },
    p2: { x: p2Pos.x, y: p2Pos.y }
  });

  UI.clearLog();
  UI.addToLog(`📍 Floor ${GameState.currentFloor} — it gets worse`, 'system');
  if (GameState.currentFloor === 5) {
    UI.addToLog('💀 BIG CHUNGUS AWAITS...', 'warn');
    UI.spawnSplash('FLOOR 5: BOSS', player.x, player.y, 'boss');
  }
  mp.activeTurn = 1;
  Renderer.render(dungeon, player, GameState.opponent);
  UI.updateHUD(player, GameState.currentFloor);
  UI.updateMPHUD(GameState.opponent, true, mp.mode);
}

// Central network message handler — all MP events routed here
function handleNetworkMessage({ event, payload }) {
  const mp = GameState.mp;
  if (!mp) return;

  if (event === 'char_selected') {
    // Opponent chose their character
    if (mp.isHost && GameState.player) {
      startMPRound(payload.charKey);
    } else if (mp.isHost) {
      mp.pendingOppCharKey = payload.charKey;
    } else {
      // Guest waiting for dungeon_state — nothing to do here
    }
    return;
  }

  if (event === 'dungeon_state') {
    // Guest receives initial dungeon from host
    const dungeon = deserializeDungeon(payload.dungeon);
    GameState.dungeon = dungeon;
    GameState.currentFloor = payload.floor;

    // My position is P2
    GameState.player.x = payload.p2.x;
    GameState.player.y = payload.p2.y;

    // Create opponent (P1/host) from serialized data
    const p1 = createPlayer(payload.p1.charKey);
    applySerializedPlayer(p1, payload.p1);
    GameState.opponent = p1;

    updateFOV(dungeon, GameState.player);
    launchMPGame();
    return;
  }

  if (event === 'player_move') {
    const opp = GameState.opponent;
    if (!opp) return;
    applySerializedPlayer(opp, payload.player);
    if (payload.entities) syncEntities(payload.entities);
    if (payload.items) syncItems(payload.items);

    // Check if opponent attacked me (VS mode)
    if (payload.attackedOpponent) {
      const dmg = payload.attackedOpponent.damage;
      GameState.player.hp = Math.max(0, GameState.player.hp - dmg);
      if (GameState.player.hp === 0) GameState.player.alive = false;
      UI.addToLog(`${opp.emoji} ${opp.name} hits you for ${dmg} dmg!`, 'damage');
      UI.spawnSplash(`-${dmg}`, GameState.player.x, GameState.player.y, 'crit');
      shakeHUD();
      UI.updateHUD(GameState.player, GameState.currentFloor);
      if (!GameState.player.alive) {
        setTimeout(() => UI.showDeathScreen(false, GameState.stats), 600);
        return;
      }
    }

    // Now it's our turn
    mp.activeTurn = mp.myNum;
    updateFOV(GameState.dungeon, GameState.player);
    Renderer.render(GameState.dungeon, GameState.player, opp);
    UI.updateHUD(GameState.player, GameState.currentFloor);
    UI.updateMPHUD(opp, true, mp.mode);
    return;
  }

  if (event === 'request_enemy_turn') {
    if (mp.isHost) setTimeout(broadcastEnemyTurns, 100);
    return;
  }

  if (event === 'enemy_turns') {
    if (payload.entities) syncEntities(payload.entities);

    // Apply damage to me from enemies
    if (payload.messages) {
      for (const m of payload.messages) {
        if (m.targetIsMe) {
          GameState.player.hp = Math.max(0, GameState.player.hp - m.damage);
          if (GameState.player.hp === 0) GameState.player.alive = false;
          UI.addToLog(`${m.enemyEmoji} ${m.enemyName} hits you for ${m.damage} dmg`, 'damage');
          UI.spawnSplash(`-${m.damage}`, GameState.player.x, GameState.player.y, 'crit');
          shakeHUD();
        }
      }
    }

    updateFOV(GameState.dungeon, GameState.player);
    Renderer.render(GameState.dungeon, GameState.player, GameState.opponent);
    UI.updateHUD(GameState.player, GameState.currentFloor);
    if (GameState.opponent) UI.updateMPHUD(GameState.opponent, true, mp.mode);

    if (!GameState.player.alive) {
      setTimeout(() => UI.showDeathScreen(false, GameState.stats), 600);
      return;
    }
    mp.activeTurn = mp.myNum;
    UI.updateMPHUD(GameState.opponent, true, mp.mode);
    return;
  }

  if (event === 'request_floor_change') {
    if (mp.isHost) changeFloorMP();
    return;
  }

  if (event === 'floor_change') {
    GameState.currentFloor = payload.floor;
    const dungeon = deserializeDungeon(payload.dungeon);
    GameState.dungeon = dungeon;
    const myIsP1 = mp.myNum === 1;
    const myPos = myIsP1 ? payload.p1 : payload.p2;
    const oppPos = myIsP1 ? payload.p2 : payload.p1;
    GameState.player.x = myPos.x; GameState.player.y = myPos.y;
    if (GameState.opponent) { GameState.opponent.x = oppPos.x; GameState.opponent.y = oppPos.y; }
    updateFOV(dungeon, GameState.player);
    UI.clearLog();
    UI.addToLog(`📍 Floor ${GameState.currentFloor} — it gets worse`, 'system');
    if (GameState.currentFloor === 5) UI.addToLog('💀 BIG CHUNGUS AWAITS...', 'warn');
    mp.activeTurn = 1;
    Renderer.render(dungeon, GameState.player, GameState.opponent);
    UI.updateHUD(GameState.player, GameState.currentFloor);
    UI.updateMPHUD(GameState.opponent, mp.myNum === 1, mp.mode);
    return;
  }

  if (event === 'game_over') {
    GameState.stats.victory = payload.victory;
    setTimeout(() => UI.showDeathScreen(payload.victory, GameState.stats), 600);
    return;
  }
}

// ── Input ─────────────────────────────────────────────────────────────────────

function setupInput() {
  const DIR_MAP = {
    'ArrowUp': [0, -1], 'ArrowDown': [0, 1],
    'ArrowLeft': [-1, 0], 'ArrowRight': [1, 0],
    'w': [0, -1], 's': [0, 1], 'a': [-1, 0], 'd': [1, 0],
    'W': [0, -1], 'S': [0, 1], 'A': [-1, 0], 'D': [1, 0]
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
    }

    if (GameState.state === 'MENU' || GameState.state === 'GAME_OVER') {
      if (e.key === 'Enter' || e.key === ' ') {
        if (GameState.state === 'GAME_OVER') resetGame();
      }
      return;
    }

    if (GameState.state !== 'PLAYING') return;

    const isMP = !!GameState.mp;
    if (DIR_MAP[e.key]) {
      const [dx, dy] = DIR_MAP[e.key];
      if (isMP) doPlayerTurnMP(dx, dy); else doPlayerTurn(dx, dy);
    } else if (e.key === ' ' || e.key === '.') {
      const dungeon = GameState.dungeon;
      const player = GameState.player;
      const adjacent = dungeon && dungeon.entities.find(en =>
        en.alive && chebyshev(player.x, player.y, en.x, en.y) === 1
      );
      if (adjacent) {
        const dx = adjacent.x - player.x, dy = adjacent.y - player.y;
        if (isMP) doPlayerTurnMP(dx, dy); else doPlayerTurn(dx, dy);
      } else {
        if (isMP) doWaitTurnMP(); else doWaitTurn();
      }
    }
  });

  document.getElementById('btn-restart').addEventListener('click', resetGame);
}

function resetGame() {
  if (GameState.mp) { MP.leave(); GameState.mp = null; }
  GameState.opponent = null;
  GameState.state = 'MENU';
  GameState.player = null;
  GameState.dungeon = null;
  GameState.currentFloor = 1;
  GameState.turn = 0;
  GameState.stats = { floorsCleared: 0, enemiesKilled: 0, itemsFound: 0, turnsPlayed: 0, victory: false };
  UI.clearLog();
  UI.updateMPHUD(null, false, null);
  UI.showScreen('MENU');
}

// ── Lobby setup ───────────────────────────────────────────────────────────────

function setupLobby() {
  document.getElementById('btn-create-room').addEventListener('click', async () => {
    const code = generateRoomCode();
    const mode = GameState._pendingMode;
    UI.setLobbyStatus('Connecting...', '#FFD700');
    try {
      await MP.create(code, 1);
    } catch (err) {
      UI.setLobbyStatus('Connection failed: ' + err.message, '#FF4444');
      return;
    }
    GameState.mp = { mode, myNum: 1, isHost: true, roomCode: code, activeTurn: 1, pendingOppCharKey: null };
    document.getElementById('room-code-display').textContent = code;
    document.getElementById('lobby-room-display').style.display = 'block';
    document.getElementById('waiting-room-code').textContent = code;
    UI.setLobbyStatus('Room created! Share the code, then pick your character.', '#00FF88');

    // Presence: when both players join, host goes to char select
    MP.onPresence((count) => {
      if (count >= 2 && (GameState.state === 'LOBBY' || GameState.state === 'WAITING')) {
        GameState.state = 'CHARACTER_SELECT';
        UI.showScreen('CHARACTER_SELECT');
      }
    });
  });

  document.getElementById('btn-join-room').addEventListener('click', async () => {
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (code.length !== 6) { UI.setLobbyStatus('Enter a 6-character code', '#FF4444'); return; }
    const mode = GameState._pendingMode;
    UI.setLobbyStatus('Joining...', '#FFD700');
    try {
      await MP.join(code, 2);
    } catch (err) {
      UI.setLobbyStatus('Failed: ' + err.message, '#FF4444');
      return;
    }
    GameState.mp = { mode, myNum: 2, isHost: false, roomCode: code, activeTurn: 1, pendingOppCharKey: null };
    GameState.state = 'CHARACTER_SELECT';
    UI.showScreen('CHARACTER_SELECT');
  });

  document.getElementById('btn-back-lobby').addEventListener('click', () => {
    MP.leave(); GameState.mp = null;
    GameState.state = 'MODE_SELECT';
    UI.showScreen('MODE_SELECT');
  });

  document.getElementById('btn-cancel-wait').addEventListener('click', () => {
    MP.leave(); GameState.mp = null;
    GameState.state = 'MENU';
    UI.showScreen('MENU');
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  Renderer.init();
  UI.buildCharCards();
  UI.showScreen('MENU');
  GameState.state = 'MENU';
  setupInput();
  setupLobby();

  // Single global message handler (set once; survives channel reconnects)
  MP.onMessage(handleNetworkMessage);

  // Menu buttons
  document.getElementById('btn-solo').addEventListener('click', () => {
    GameState.mp = null;
    GameState.state = 'CHARACTER_SELECT';
    UI.showScreen('CHARACTER_SELECT');
  });

  document.getElementById('btn-multiplayer').addEventListener('click', () => {
    GameState.state = 'MODE_SELECT';
    UI.showScreen('MODE_SELECT');
  });

  document.getElementById('mode-coop').addEventListener('click', () => {
    GameState._pendingMode = 'coop';
    GameState.state = 'LOBBY';
    document.getElementById('lobby-title').textContent = 'CO-OP LOBBY';
    document.getElementById('lobby-room-display').style.display = 'none';
    UI.setLobbyStatus('', '');
    UI.showScreen('LOBBY');
  });

  document.getElementById('mode-vs').addEventListener('click', () => {
    GameState._pendingMode = 'vs';
    GameState.state = 'LOBBY';
    document.getElementById('lobby-title').textContent = 'VS LOBBY';
    document.getElementById('lobby-room-display').style.display = 'none';
    UI.setLobbyStatus('', '');
    UI.showScreen('LOBBY');
  });

  document.getElementById('btn-back-mode').addEventListener('click', () => {
    GameState.state = 'MENU';
    UI.showScreen('MENU');
  });
});
