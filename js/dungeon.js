const TILE = { WALL: 0, FLOOR: 1, STAIRS: 2 };
const TILE_SIZE = 32;
const DUNGEON_W = 50;
const DUNGEON_H = 38;
const VIEWPORT_W = 25;
const VIEWPORT_H = 19;

function generateDungeon(floor, player) {
  const tiles = [];
  const explored = [];
  const visible = [];

  for (let y = 0; y < DUNGEON_H; y++) {
    tiles[y] = new Array(DUNGEON_W).fill(TILE.WALL);
    explored[y] = new Array(DUNGEON_W).fill(false);
    visible[y] = new Array(DUNGEON_W).fill(false);
  }

  const rooms = [];
  const maxRooms = Math.min(14, 6 + floor * 2);

  for (let attempt = 0; attempt < maxRooms * 6; attempt++) {
    if (rooms.length >= maxRooms) break;
    const w = randInt(5, 12);
    const h = randInt(4, 9);
    const x = randInt(1, DUNGEON_W - w - 2);
    const y = randInt(1, DUNGEON_H - h - 2);

    if (!roomOverlaps(rooms, x, y, w, h)) {
      carveRoom(tiles, x, y, w, h);
      rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
    }
  }

  if (rooms.length < 2) {
    // Fallback: force two rooms
    carveRoom(tiles, 2, 2, 8, 6);
    rooms.push({ x: 2, y: 2, w: 8, h: 6, cx: 6, cy: 5 });
    carveRoom(tiles, 30, 20, 8, 6);
    rooms.push({ x: 30, y: 20, w: 8, h: 6, cx: 34, cy: 23 });
  }

  // Sort rooms left to right for consistent connectivity
  rooms.sort((a, b) => a.cx - b.cx);

  // Connect adjacent rooms with L-shaped corridors
  for (let i = 0; i < rooms.length - 1; i++) {
    carveCorridor(tiles, rooms[i].cx, rooms[i].cy, rooms[i + 1].cx, rooms[i + 1].cy);
  }

  const spawnRoom = rooms[0];
  const exitRoom = rooms[rooms.length - 1];
  const spawnPoint = { x: spawnRoom.cx, y: spawnRoom.cy };
  // P2 spawns slightly offset from P1 in the same room
  const p2SpawnPoint = { x: spawnRoom.cx + 1, y: spawnRoom.cy };
  const stairsPos = { x: exitRoom.cx, y: exitRoom.cy };
  tiles[stairsPos.y][stairsPos.x] = TILE.STAIRS;

  // Place player
  if (player) {
    player.x = spawnPoint.x;
    player.y = spawnPoint.y;
  }

  const entities = [];
  const items = [];

  const eligibleKeys = getEligibleEnemyKeys(floor);

  if (floor === 5) {
    // Boss only in last room
    const bx = exitRoom.cx;
    const by = exitRoom.cy - 2;
    const safeBy = Math.max(exitRoom.y + 1, by);
    entities.push(createEnemy('bigchungus', bx, safeBy, floor));
  }

  // Place enemies in rooms 1..last (skip spawn room; skip boss room on floor 5)
  const enemyRooms = floor === 5 ? rooms.slice(1, -1) : rooms.slice(1);
  for (const room of enemyRooms) {
    const count = randInt(1, Math.min(3, 1 + floor));
    for (let i = 0; i < count; i++) {
      const pos = randomFloorInRoom(tiles, room, stairsPos, entities, []);
      if (!pos) continue;
      const key = eligibleKeys[randInt(0, eligibleKeys.length - 1)];
      entities.push(createEnemy(key, pos.x, pos.y, floor));
    }
  }

  // Place items
  const baseCount = 2 + floor;
  const itemCount = (player && player.doubleItems) ? baseCount * 2 : baseCount;
  for (let i = 0; i < itemCount; i++) {
    const room = rooms[randInt(0, rooms.length - 1)];
    const pos = randomFloorInRoom(tiles, room, stairsPos, entities, items);
    if (!pos) continue;
    const key = pickWeightedItem();
    items.push(createItem(key, pos.x, pos.y));
  }

  return { width: DUNGEON_W, height: DUNGEON_H, tiles, rooms, entities, items, explored, visible, spawnPoint, p2SpawnPoint, stairsPos };
}

function carveRoom(tiles, x, y, w, h) {
  for (let ry = y; ry < y + h; ry++) {
    for (let rx = x; rx < x + w; rx++) {
      tiles[ry][rx] = TILE.FLOOR;
    }
  }
}

function carveCorridor(tiles, x1, y1, x2, y2) {
  // Horizontal then vertical (or random flip)
  const hFirst = Math.random() < 0.5;
  if (hFirst) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) tiles[y1][x] = TILE.FLOOR;
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) tiles[y][x2] = TILE.FLOOR;
  } else {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) tiles[y][x1] = TILE.FLOOR;
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) tiles[y2][x] = TILE.FLOOR;
  }
}

function roomOverlaps(rooms, x, y, w, h) {
  const margin = 1;
  for (const r of rooms) {
    if (x - margin < r.x + r.w && x + w + margin > r.x &&
        y - margin < r.y + r.h && y + h + margin > r.y) {
      return true;
    }
  }
  return false;
}

function randomFloorInRoom(tiles, room, stairsPos, entities, items) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = randInt(room.x + 1, room.x + room.w - 2);
    const y = randInt(room.y + 1, room.y + room.h - 2);
    if (tiles[y][x] !== TILE.FLOOR) continue;
    if (x === stairsPos.x && y === stairsPos.y) continue;
    if (entities.some(e => e.x === x && e.y === y)) continue;
    if (items.some(i => i.x === x && i.y === y)) continue;
    return { x, y };
  }
  return null;
}

function updateFOV(dungeon, player) {
  const { tiles, rooms, explored, visible } = dungeon;

  // Reset visible
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      visible[y][x] = false;
    }
  }

  // Find the room the player is in
  const playerRoom = rooms.find(r =>
    player.x >= r.x && player.x < r.x + r.w &&
    player.y >= r.y && player.y < r.y + r.h
  );

  if (playerRoom) {
    // Reveal the entire room
    for (let ry = playerRoom.y; ry < playerRoom.y + playerRoom.h; ry++) {
      for (let rx = playerRoom.x; rx < playerRoom.x + playerRoom.w; rx++) {
        visible[ry][rx] = true;
        explored[ry][rx] = true;
      }
    }
  }

  // Peek 4 tiles in each cardinal direction (corridor reveal)
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  for (const [dx, dy] of dirs) {
    for (let step = 1; step <= 4; step++) {
      const nx = player.x + dx * step;
      const ny = player.y + dy * step;
      if (nx < 0 || ny < 0 || nx >= dungeon.width || ny >= dungeon.height) break;
      if (tiles[ny][nx] === TILE.WALL) break;
      visible[ny][nx] = true;
      explored[ny][nx] = true;
    }
  }

  // Always reveal tile player stands on
  visible[player.y][player.x] = true;
  explored[player.y][player.x] = true;
}

function getEntityAt(dungeon, player, x, y) {
  if (player && player.x === x && player.y === y) return player;
  return dungeon.entities.find(e => e.alive && e.x === x && e.y === y) || null;
}

function runEnemyTurns(dungeon, player) {
  const messages = [];
  for (const enemy of dungeon.entities) {
    if (!enemy.alive || !player.alive) continue;

    const dist = chebyshev(enemy.x, enemy.y, player.x, player.y);
    if (dist <= enemy.aggroRange) enemy.aiState = 'aggro';

    if (enemy.aiState !== 'aggro') continue;

    if (dist === 1) {
      const result = enemyAttack(enemy, player);
      messages.push({ type: 'enemy_attack', enemy, result });
    } else {
      const dx = Math.sign(player.x - enemy.x);
      const dy = Math.sign(player.y - enemy.y);
      const moved = tryMoveEnemy(dungeon, player, enemy, dx, dy);
      if (!moved) {
        // Try horizontal only then vertical only
        tryMoveEnemy(dungeon, player, enemy, dx, 0) ||
        tryMoveEnemy(dungeon, player, enemy, 0, dy);
      }
    }
  }
  return messages;
}

function tryMoveEnemy(dungeon, player, enemy, dx, dy) {
  if (dx === 0 && dy === 0) return false;
  const nx = enemy.x + dx;
  const ny = enemy.y + dy;
  if (nx < 0 || ny < 0 || nx >= dungeon.width || ny >= dungeon.height) return false;
  const tile = dungeon.tiles[ny][nx];
  if (tile === TILE.WALL) return false;
  if (getEntityAt(dungeon, player, nx, ny)) return false;
  enemy.x = nx;
  enemy.y = ny;
  return true;
}

// Multiplayer enemy turns — takes both players so enemies don't walk into either
function runEnemyTurnsMP(dungeon, p1, p2) {
  const messages = [];
  const activePlayers = [p1, p2].filter(p => p && p.alive);
  for (const enemy of dungeon.entities) {
    if (!enemy.alive) continue;
    if (activePlayers.length === 0) continue;

    // Aggro to nearest player
    let nearest = null;
    let nearestDist = Infinity;
    for (const p of activePlayers) {
      const d = chebyshev(enemy.x, enemy.y, p.x, p.y);
      if (d < nearestDist) { nearestDist = d; nearest = p; }
    }
    if (!nearest) continue;

    if (nearestDist <= enemy.aggroRange) enemy.aiState = 'aggro';
    if (enemy.aiState !== 'aggro') continue;

    if (nearestDist === 1) {
      const result = enemyAttack(enemy, nearest);
      messages.push({ type: 'enemy_attack', enemy, target: nearest, result });
    } else {
      const dx = Math.sign(nearest.x - enemy.x);
      const dy = Math.sign(nearest.y - enemy.y);
      // Pass p2 as extra blocked position
      const moved = tryMoveEnemyMP(dungeon, activePlayers, enemy, dx, dy);
      if (!moved) {
        tryMoveEnemyMP(dungeon, activePlayers, enemy, dx, 0) ||
        tryMoveEnemyMP(dungeon, activePlayers, enemy, 0, dy);
      }
    }
  }
  return messages;
}

function tryMoveEnemyMP(dungeon, players, enemy, dx, dy) {
  if (dx === 0 && dy === 0) return false;
  const nx = enemy.x + dx;
  const ny = enemy.y + dy;
  if (nx < 0 || ny < 0 || nx >= dungeon.width || ny >= dungeon.height) return false;
  const tile = dungeon.tiles[ny][nx];
  if (tile === TILE.WALL) return false;
  for (const p of players) {
    if (p.x === nx && p.y === ny) return false;
  }
  if (dungeon.entities.some(e => e.alive && e !== enemy && e.x === nx && e.y === ny)) return false;
  enemy.x = nx;
  enemy.y = ny;
  return true;
}

// Minimal serialization for sending dungeon state to P2 on join
function serializeDungeon(dungeon) {
  return JSON.stringify({
    width: dungeon.width,
    height: dungeon.height,
    tiles: dungeon.tiles,
    rooms: dungeon.rooms,
    entities: dungeon.entities.map(e => ({
      id: e.id, enemyKey: e.enemyKey, x: e.x, y: e.y,
      hp: e.hp, maxHp: e.maxHp, atk: e.atk, def: e.def,
      emoji: e.emoji, name: e.name, deathQuip: e.deathQuip,
      isBoss: e.isBoss, aggroRange: e.aggroRange, aiState: e.aiState,
      alive: e.alive
    })),
    items: dungeon.items.map(i => ({
      id: i.id, itemKey: i.itemKey, x: i.x, y: i.y,
      emoji: i.emoji, name: i.name, desc: i.desc, splash: i.splash,
      picked: i.picked
    })),
    explored: dungeon.explored,
    visible: dungeon.visible,
    spawnPoint: dungeon.spawnPoint,
    p2SpawnPoint: dungeon.p2SpawnPoint,
    stairsPos: dungeon.stairsPos
  });
}

function deserializeDungeon(json) {
  const d = JSON.parse(json);
  // Reconstruct apply functions for items (not serialized)
  for (const item of d.items) {
    if (ITEMS[item.itemKey]) {
      item.apply = ITEMS[item.itemKey].apply;
    }
  }
  return d;
}

function chebyshev(x1, y1, x2, y2) {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function debugDungeon(dungeon) {
  let out = '';
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const t = dungeon.tiles[y][x];
      out += t === TILE.WALL ? '#' : t === TILE.STAIRS ? '>' : '.';
    }
    out += '\n';
  }
  console.log(out);
}
