const Renderer = (() => {
  let canvas, ctx;
  let CSS_SCALE = 1;
  let currentCamera = { camX: 0, camY: 0 };

  const COLORS = {
    wall: '#1a1a1a',
    wallDim: '#0f0f0f',
    floor: '#2a2018',
    floorDim: '#161008',
    stairs: '#004400',
    black: '#000000'
  };

  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    updateScale();
    window.addEventListener('resize', updateScale);
  }

  function updateScale() {
    const container = document.getElementById('canvas-container');
    const dpadH = window.innerWidth < 700 ? 220 : 0;
    const hudH = 70;
    const scaleX = window.innerWidth / (VIEWPORT_W * TILE_SIZE);
    const scaleY = (window.innerHeight - hudH - dpadH) / (VIEWPORT_H * TILE_SIZE);
    CSS_SCALE = Math.min(scaleX, scaleY);
    container.style.transform = `translate(-50%, -50%) scale(${CSS_SCALE})`;

    // Shift canvas centre up to leave room for d-pad on mobile
    const topOffset = dpadH > 0 ? -(dpadH / 2) : 0;
    container.style.top = `calc(50% + ${topOffset}px)`;
  }

  function getCamera(player, dungeon) {
    const halfW = Math.floor(VIEWPORT_W / 2);
    const halfH = Math.floor(VIEWPORT_H / 2);
    const camX = Math.max(halfW, Math.min(player.x, dungeon.width  - halfW - 1));
    const camY = Math.max(halfH, Math.min(player.y, dungeon.height - halfH - 1));
    return { camX, camY };
  }

  function worldToScreen(wx, wy, cam) {
    return {
      sx: (wx - cam.camX + Math.floor(VIEWPORT_W / 2)) * TILE_SIZE,
      sy: (wy - cam.camY + Math.floor(VIEWPORT_H / 2)) * TILE_SIZE
    };
  }

  function inViewport(sx, sy) {
    return sx > -TILE_SIZE && sx < VIEWPORT_W * TILE_SIZE &&
           sy > -TILE_SIZE && sy < VIEWPORT_H * TILE_SIZE;
  }

  function render(dungeon, player) {
    currentCamera = getCamera(player, dungeon);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTiles(dungeon, currentCamera);
    drawItems(dungeon, currentCamera);
    drawEnemies(dungeon, currentCamera);
    drawPlayer(player, currentCamera);
  }

  function drawTiles(dungeon, cam) {
    const { tiles, explored, visible } = dungeon;
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        if (!explored[y][x]) continue;
        const { sx, sy } = worldToScreen(x, y, cam);
        if (!inViewport(sx, sy)) continue;

        const isVisible = visible[y][x];
        const tile = tiles[y][x];

        if (tile === TILE.WALL) {
          ctx.fillStyle = isVisible ? COLORS.wall : COLORS.wallDim;
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          if (isVisible) {
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
          }
        } else if (tile === TILE.FLOOR) {
          ctx.fillStyle = isVisible ? COLORS.floor : COLORS.floorDim;
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        } else if (tile === TILE.STAIRS) {
          ctx.fillStyle = isVisible ? COLORS.stairs : '#002200';
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          if (isVisible) {
            drawEmoji('🔽', sx, sy, 22);
          }
        }
      }
    }
  }

  function drawItems(dungeon, cam) {
    const { visible, items } = dungeon;
    for (const item of items) {
      if (item.picked) continue;
      if (!visible[item.y] || !visible[item.y][item.x]) continue;
      const { sx, sy } = worldToScreen(item.x, item.y, cam);
      if (!inViewport(sx, sy)) continue;
      drawEmoji(item.emoji, sx, sy, 22);
    }
  }

  function drawEnemies(dungeon, cam) {
    const { visible, entities } = dungeon;
    for (const enemy of entities) {
      if (!enemy.alive) continue;
      if (!visible[enemy.y] || !visible[enemy.y][enemy.x]) continue;
      const { sx, sy } = worldToScreen(enemy.x, enemy.y, cam);
      if (!inViewport(sx, sy)) continue;
      drawEmoji(enemy.emoji, sx, sy, enemy.isBoss ? 28 : 24);
      drawHPBar(enemy, sx, sy);
    }
  }

  function drawHPBar(enemy, sx, sy) {
    const barW = TILE_SIZE - 4;
    const barH = 4;
    const bx = sx + 2;
    const by = sy - 6;
    const pct = enemy.hp / enemy.maxHp;

    ctx.fillStyle = '#440000';
    ctx.fillRect(bx, by, barW, barH);

    const fillColor = pct > 0.5 ? '#00CC00' : pct > 0.25 ? '#FFAA00' : '#FF2200';
    ctx.fillStyle = fillColor;
    ctx.fillRect(bx, by, Math.round(barW * pct), barH);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);
  }

  function drawPlayer(player, cam) {
    const { sx, sy } = worldToScreen(player.x, player.y, cam);
    ctx.fillStyle = 'rgba(255, 255, 100, 0.15)';
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    drawEmoji(player.emoji, sx, sy, 26);
  }

  function drawEmoji(emoji, sx, sy, size) {
    ctx.save();
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
    ctx.restore();
  }

  function tileToScreen(tx, ty) {
    const cam = currentCamera;
    const sx = (tx - cam.camX + Math.floor(VIEWPORT_W / 2)) * TILE_SIZE + TILE_SIZE / 2;
    const sy = (ty - cam.camY + Math.floor(VIEWPORT_H / 2)) * TILE_SIZE + TILE_SIZE / 2;
    const canvasCX = (VIEWPORT_W * TILE_SIZE) / 2;
    const canvasCY = (VIEWPORT_H * TILE_SIZE) / 2;
    const dpadH = window.innerWidth < 700 ? 220 : 0;
    return {
      x: window.innerWidth  / 2 + (sx - canvasCX) * CSS_SCALE,
      y: window.innerHeight / 2 - dpadH / 2 + (sy - canvasCY) * CSS_SCALE
    };
  }

  function getScale() { return CSS_SCALE; }

  return { init, render, tileToScreen, getScale };
})();
