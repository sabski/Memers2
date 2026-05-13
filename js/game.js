const GameState = {
  state: 'MENU',
  player: null,
  dungeon: null,
  currentFloor: 1,
  turn: 0,
  stats: {
    floorsCleared: 0,
    enemiesKilled: 0,
    itemsFound: 0,
    turnsPlayed: 0,
    victory: false
  },

  selectCharacter(charKey) {
    this.player = createPlayer(charKey);
    this.currentFloor = 1;
    this.turn = 0;
    this.stats = { floorsCleared: 0, enemiesKilled: 0, itemsFound: 0, turnsPlayed: 0, victory: false };
    this.dungeon = generateDungeon(this.currentFloor, this.player);
    updateFOV(this.dungeon, this.player);
    UI.clearLog();
    UI.addToLog(`${this.player.emoji} ${this.player.name} enters the dungeon...`, 'system');
    UI.addToLog('WASD/arrows to move, walk into enemies to attack', 'system');
    UI.showScreen('PLAYING');
    Renderer.render(this.dungeon, this.player);
    UI.updateHUD(this.player, this.currentFloor);
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

    // Pepe gets a buff on new floors
    if (this.player.special === 'rare_pepe') {
      applyRarePepeBuff(this.player, this.currentFloor, this.player.x, this.player.y);
    }

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

function applyRarePepeBuff(player, floor, tx, ty) {
  const BUFFS = [
    () => { player.atkBonus += 3; return '+3 ATK'; },
    () => { player.defBonus += 2; return '+2 DEF'; },
    () => { player.critChance = Math.min(0.8, player.critChance + 0.1); return '+10% CRIT'; },
    () => { player.maxHp += 8; player.hp = Math.min(player.maxHp, player.hp + 8); return '+8 MAX HP'; },
    () => { player.critMult = +(player.critMult + 0.5).toFixed(1); return `+0.5x CRIT DMG`; }
  ];
  const chosen = BUFFS[Math.floor(Math.random() * BUFFS.length)];
  const desc = chosen();
  UI.addToLog(`🐸 RARE PEPE ACTIVATED: ${desc}!`, 'item');
  UI.spawnSplash(`RARE PEPE! ${desc}`, tx, ty, 'item');
}

function doPlayerTurn(dx, dy) {
  const { player, dungeon } = GameState;
  if (!player || !player.alive) return;

  const tx = player.x + dx;
  const ty = player.y + dy;

  if (tx < 0 || ty < 0 || tx >= dungeon.width || ty >= dungeon.height) return;

  const tile = dungeon.tiles[ty][tx];
  if (tile === TILE.WALL) return; // wall — don't consume turn

  const enemy = dungeon.entities.find(e => e.alive && e.x === tx && e.y === ty);

  if (enemy) {
    const results = playerAttack(player, enemy);
    let totalDmg = results.reduce((s, r) => s + r.damage, 0);
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
      if (enemy.isBoss) {
        UI.spawnSplash('BOSS SLAIN!!!', player.x, player.y, 'boss');
      } else {
        UI.spawnSplash(UI.randomQuip(), enemy.x, enemy.y);
      }
    }
  } else {
    player.x = tx;
    player.y = ty;
    handleItemPickup();
    handleStairs();
  }

  if (player.alive) {
    finishTurn();
  }
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

  const enemyMessages = runEnemyTurns(dungeon, player);

  for (const msg of enemyMessages) {
    if (msg.type === 'enemy_attack') {
      const { enemy, result } = msg;
      UI.addToLog(`${enemy.emoji} ${enemy.name} hits you for ${result.damage} dmg`, 'damage');
      UI.spawnSplash(`-${result.damage}`, player.x, player.y, 'crit');
      // Shake the HUD
      const hud = document.getElementById('hud-top');
      hud.classList.remove('shake');
      void hud.offsetWidth; // reflow
      hud.classList.add('shake');
      hud.addEventListener('animationend', () => hud.classList.remove('shake'), { once: true });
    }
  }

  updateFOV(dungeon, player);
  Renderer.render(dungeon, player);
  UI.updateHUD(player, GameState.currentFloor);

  if (!player.alive) {
    setTimeout(() => UI.showDeathScreen(false, GameState.stats), 600);
  }
}

function handleItemPickup() {
  const { player, dungeon } = GameState;
  const item = dungeon.items.find(i => !i.picked && i.x === player.x && i.y === player.y);
  if (!item) return;

  item.picked = true;
  GameState.stats.itemsFound++;
  ITEMS[item.itemKey].apply(player);
  UI.addToLog(`✨ Picked up ${item.emoji} ${item.name} (${item.desc})`, 'item');
  UI.spawnSplash(item.splash, player.x, player.y, 'item');
}

function handleStairs() {
  const { player, dungeon } = GameState;
  const tile = dungeon.tiles[player.y][player.x];
  if (tile !== TILE.STAIRS) return;
  GameState.descend();
}

function setupInput() {
  const DIR_MAP = {
    'ArrowUp': [0, -1], 'ArrowDown': [0, 1],
    'ArrowLeft': [-1, 0], 'ArrowRight': [1, 0],
    'w': [0, -1], 's': [0, 1], 'a': [-1, 0], 'd': [1, 0],
    'W': [0, -1], 'S': [0, 1], 'A': [-1, 0], 'D': [1, 0]
  };

  document.addEventListener('keydown', (e) => {
    if (GameState.state === 'MENU' || GameState.state === 'GAME_OVER') {
      if (e.key === 'Enter') {
        if (GameState.state === 'MENU') {
          UI.showScreen('CHARACTER_SELECT');
          GameState.state = 'CHARACTER_SELECT';
        } else {
          resetGame();
        }
      }
      return;
    }

    if (GameState.state === 'CHARACTER_SELECT') return;

    if (GameState.state === 'PLAYING') {
      if (DIR_MAP[e.key]) {
        e.preventDefault();
        const [dx, dy] = DIR_MAP[e.key];
        doPlayerTurn(dx, dy);
      } else if (e.key === ' ' || e.key === '.') {
        e.preventDefault();
        doWaitTurn();
      }
    }
  });

  document.getElementById('btn-restart').addEventListener('click', resetGame);
}

function resetGame() {
  GameState.state = 'MENU';
  GameState.player = null;
  GameState.dungeon = null;
  GameState.currentFloor = 1;
  GameState.turn = 0;
  GameState.stats = { floorsCleared: 0, enemiesKilled: 0, itemsFound: 0, turnsPlayed: 0, victory: false };
  UI.clearLog();
  UI.showScreen('MENU');
}

window.addEventListener('DOMContentLoaded', () => {
  Renderer.init();
  UI.buildCharCards();
  UI.showScreen('MENU');
  GameState.state = 'MENU';
  setupInput();

  // Wire character select state tracking
  const origSelectChar = GameState.selectCharacter.bind(GameState);
  GameState.selectCharacter = function(key) {
    GameState.state = 'PLAYING';
    origSelectChar(key);
  };
});
