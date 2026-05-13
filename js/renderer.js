const Renderer = (() => {
  let canvas, ctx;
  let CSS_SCALE = 0.6;

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
    const scaleX = window.innerWidth / (DUNGEON_W * TILE_SIZE);
    const scaleY = (window.innerHeight - 60) / (DUNGEON_H * TILE_SIZE);
    CSS_SCALE = Math.min(scaleX, scaleY, 1);
    container.style.transform = `translate(-50%, -50%) scale(${CSS_SCALE})`;
  }

  function render(dungeon, player) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTiles(dungeon);
    drawItems(dungeon);
    drawEnemies(dungeon);
    drawPlayer(player);
  }

  function drawTiles(dungeon) {
    const { tiles, explored, visible } = dungeon;
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        if (!explored[y][x]) continue;

        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const isVisible = visible[y][x];
        const tile = tiles[y][x];

        if (tile === TILE.WALL) {
          ctx.fillStyle = isVisible ? COLORS.wall : COLORS.wallDim;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          if (isVisible) {
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
          }
        } else if (tile === TILE.FLOOR) {
          ctx.fillStyle = isVisible ? COLORS.floor : COLORS.floorDim;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (tile === TILE.STAIRS) {
          ctx.fillStyle = isVisible ? COLORS.stairs : '#002200';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          if (isVisible) {
            drawEmoji('🔽', px, py, 22);
          }
        }
      }
    }
  }

  function drawItems(dungeon) {
    const { visible, items } = dungeon;
    for (const item of items) {
      if (item.picked) continue;
      if (!visible[item.y] || !visible[item.y][item.x]) continue;
      drawEmoji(item.emoji, item.x * TILE_SIZE, item.y * TILE_SIZE, 22);
    }
  }

  function drawEnemies(dungeon) {
    const { visible, entities } = dungeon;
    for (const enemy of entities) {
      if (!enemy.alive) continue;
      if (!visible[enemy.y] || !visible[enemy.y][enemy.x]) continue;

      const px = enemy.x * TILE_SIZE;
      const py = enemy.y * TILE_SIZE;

      drawEmoji(enemy.emoji, px, py, enemy.isBoss ? 28 : 24);
      drawHPBar(enemy, px, py);
    }
  }

  function drawHPBar(enemy, px, py) {
    const barW = TILE_SIZE - 4;
    const barH = 4;
    const bx = px + 2;
    const by = py - 6;
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

  function drawPlayer(player) {
    const px = player.x * TILE_SIZE;
    const py = player.y * TILE_SIZE;

    // Highlight tile
    ctx.fillStyle = 'rgba(255, 255, 100, 0.15)';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    drawEmoji(player.emoji, px, py, 26);
  }

  function drawEmoji(emoji, px, py, size) {
    ctx.save();
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
    ctx.restore();
  }

  function tileToScreen(tx, ty) {
    const canvasCenterX = (DUNGEON_W * TILE_SIZE) / 2;
    const canvasCenterY = (DUNGEON_H * TILE_SIZE) / 2;
    const screenCX = window.innerWidth / 2;
    const screenCY = window.innerHeight / 2;
    return {
      x: screenCX + (tx * TILE_SIZE + TILE_SIZE / 2 - canvasCenterX) * CSS_SCALE,
      y: screenCY + (ty * TILE_SIZE + TILE_SIZE / 2 - canvasCenterY) * CSS_SCALE
    };
  }

  function getScale() { return CSS_SCALE; }

  return { init, render, tileToScreen, getScale };
})();
