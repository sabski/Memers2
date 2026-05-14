const UI = (() => {
  const QUIPS = ['LMAO', 'XD', 'OMG', 'REKT', 'GG EZ', 'POGGERS', 'BASED', 'L + RATIO', 'NO CAP', 'YIKES', 'BRUH'];
  const CRIT_QUIPS = ['CRITICAL!!!', 'OMEGALUL', 'DELETE', 'DESTROYED', 'OBLITERATED', 'DEMOLISHED'];
  const DEATH_QUIPS = ['SKILL ISSUE', 'F IN CHAT', 'NOT DARK SOULS', 'RIP BOZO', 'TOUCH GRASS', 'L'];

  let logLines = [];

  function buildCharCards() {
    const container = document.getElementById('char-cards');
    container.innerHTML = '';
    for (const [key, ch] of Object.entries(CHARACTERS)) {
      const card = document.createElement('div');
      card.className = 'char-card';
      card.dataset.key = key;
      card.innerHTML = `
        <span class="char-emoji">${ch.emoji}</span>
        <span class="char-name">${ch.name}</span>
        <span class="char-flavor">"${ch.flavor}"</span>
        <div class="char-stats">
          ❤️ ${ch.baseHp} &nbsp; ⚔️ ${ch.baseAtk} &nbsp; 🛡️ ${ch.baseDef}<br>
          🎯 crit ${Math.round(ch.critChance * 100)}%
        </div>
        <div class="char-special">✨ ${ch.specialDesc}</div>
      `;
      card.addEventListener('click', () => {
        if (window.GameState) window.GameState.selectCharacter(key);
      });
      container.appendChild(card);
    }
  }

  function showScreen(stateName) {
    document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; });
    const el = document.getElementById('screen-' + stateName.toLowerCase());
    if (el) el.style.display = 'flex';

    const hud = document.getElementById('hud');
    const canvas = document.getElementById('canvas-container');
    const isPlaying = stateName === 'PLAYING';
    hud.style.display = isPlaying ? 'block' : 'none';
    canvas.style.display = isPlaying ? 'block' : 'none';
  }

  function updateMPHUD(opponent, isMyTurn, mode) {
    const oppSection = document.getElementById('opponent-section');
    const turnEl = document.getElementById('turn-indicator');

    if (!opponent) {
      oppSection.style.display = 'none';
      turnEl.style.display = 'none';
      return;
    }

    oppSection.style.display = 'flex';
    turnEl.style.display = 'block';

    const hp = Math.max(0, opponent.hp);
    const pct = (hp / opponent.maxHp) * 100;
    document.getElementById('opponent-text').textContent =
      `${opponent.emoji} ${opponent.name}: ${hp}/${opponent.maxHp}`;
    document.getElementById('opponent-bar-fill').style.width = pct + '%';

    if (isMyTurn) {
      turnEl.textContent = 'YOUR TURN';
      turnEl.className = 'your-turn';
    } else {
      turnEl.textContent = "OPPONENT'S TURN";
      turnEl.className = 'their-turn';
    }
  }

  function setLobbyStatus(text, color) {
    const el = document.getElementById('lobby-status');
    if (el) { el.textContent = text; el.style.color = color || '#00FF88'; }
  }

  function updateHUD(player, floor) {
    const pct = Math.max(0, player.hp / player.maxHp) * 100;
    document.getElementById('hp-bar-fill').style.width = pct + '%';
    document.getElementById('hp-text').textContent = `HP: ${Math.max(0, player.hp)}/${player.maxHp}`;
    document.getElementById('floor-display').textContent = `FLOOR ${floor}`;
    document.getElementById('char-info').textContent = `${player.emoji} ${player.name}`;
    document.getElementById('stats-display').textContent =
      `ATK ${player.atk + player.atkBonus}  DEF ${player.def + player.defBonus}  CRIT ${Math.round(player.critChance * 100)}%`;
  }

  function addToLog(message, type) {
    logLines.unshift({ text: message, type: type || '' });
    if (logLines.length > 5) logLines.length = 5;
    for (let i = 0; i < 5; i++) {
      const el = document.getElementById('log-' + i);
      if (!el) continue;
      if (i < logLines.length) {
        el.textContent = logLines[i].text;
        el.className = 'log-line' + (logLines[i].type ? ' log-' + logLines[i].type : '');
      } else {
        el.textContent = '';
        el.className = 'log-line';
      }
    }
  }

  function clearLog() {
    logLines = [];
    for (let i = 0; i < 5; i++) {
      const el = document.getElementById('log-' + i);
      if (el) { el.textContent = ''; el.className = 'log-line'; }
    }
  }

  function spawnSplash(text, tx, ty, cls) {
    const pos = Renderer.tileToScreen(tx, ty);
    const el = document.createElement('div');
    el.className = 'splash' + (cls ? ' ' + cls : '');
    el.textContent = text;
    el.style.left = (pos.x - 40) + 'px';
    el.style.top = (pos.y - 20) + 'px';
    document.getElementById('splash-container').appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function showDeathScreen(victory, stats) {
    const title = document.getElementById('death-title');
    const emoji = document.getElementById('death-emoji');
    const quip = document.getElementById('death-quip');
    const score = document.getElementById('death-score');

    if (victory) {
      title.textContent = 'YOU WIN LOL';
      title.className = 'victory';
      emoji.textContent = '🏆';
      quip.textContent = 'BIG CHUNGUS HAS BEEN DEFEATED';
    } else {
      title.textContent = 'YOU DIED';
      title.className = '';
      emoji.textContent = '💀';
      quip.textContent = DEATH_QUIPS[Math.floor(Math.random() * DEATH_QUIPS.length)];
    }

    score.innerHTML = `
      <span class="score-label">Floors cleared:</span> ${stats.floorsCleared}<br>
      <span class="score-label">Enemies slain:</span> ${stats.enemiesKilled}<br>
      <span class="score-label">Items found:</span> ${stats.itemsFound}<br>
      <span class="score-label">Turns survived:</span> ${stats.turnsPlayed}
    `;

    showScreen('GAME_OVER');
  }

  function randomQuip() { return QUIPS[Math.floor(Math.random() * QUIPS.length)]; }
  function randomCritQuip() { return CRIT_QUIPS[Math.floor(Math.random() * CRIT_QUIPS.length)]; }

  return { buildCharCards, showScreen, updateHUD, updateMPHUD, setLobbyStatus, addToLog, clearLog, spawnSplash, showDeathScreen, randomQuip, randomCritQuip };
})();
