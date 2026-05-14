// Shared test definitions — no browser or Node-specific APIs.
// Assumes all game globals are already in scope (loaded before this file).
// Exposes a single function: runAllTests() → array of result objects.

function runAllTests() {
  var results = [];

  function suite(name) {
    results.push({ suite: name });
  }

  function test(name, fn) {
    try {
      fn();
      results.push({ ok: true, name: name });
    } catch (e) {
      results.push({ ok: false, name: name, error: e.message });
    }
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
  }

  function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(msg || ('expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)));
  }

  // ── CHARACTERS ────────────────────────────────────────────────────────────

  suite('Characters');

  test('all 5 characters create without error', function () {
    ['doge', 'grumpy', 'duck', 'pepe', 'raccoon'].forEach(function (k) {
      var p = createPlayer(k);
      assert(p.hp > 0, k + ' hp should be > 0');
      assert(p.alive === true, k + ' should start alive');
    });
  });

  test('player starts with hp === maxHp', function () {
    ['doge', 'grumpy', 'duck', 'pepe', 'raccoon'].forEach(function (k) {
      var p = createPlayer(k);
      assertEqual(p.hp, p.maxHp, k + ' hp should equal maxHp at start');
    });
  });

  test('Doge: critMult is 3 (much wow special)', function () {
    var p = createPlayer('doge');
    assertEqual(p.critMult, 3, 'Doge critMult should be 3');
  });

  test('Grumpy Cat: passiveDmgReduction is 0.2', function () {
    var p = createPlayer('grumpy');
    assertEqual(p.passiveDmgReduction, 0.2, 'Grumpy Cat reduction should be 0.2');
  });

  test('Duck: attackTwice is true', function () {
    var p = createPlayer('duck');
    assertEqual(p.attackTwice, true, 'Duck should have attackTwice');
  });

  test('Pepe: special key is rare_pepe', function () {
    var p = createPlayer('pepe');
    assertEqual(p.special, 'rare_pepe');
  });

  test('Raccoon: doubleItems is true', function () {
    var p = createPlayer('raccoon');
    assertEqual(p.doubleItems, true, 'Raccoon should have doubleItems');
  });

  // ── COMBAT ────────────────────────────────────────────────────────────────

  suite('Combat');

  test('basic damage = atk - def', function () {
    var orig = Math.random;
    try {
      Math.random = function () { return 1; }; // roll >= critChance → never crit
      var attacker = { atk: 10, atkBonus: 0, critChance: 0, critMult: 2, passiveDmgReduction: 0 };
      var defender = { def: 3, defBonus: 0, hp: 100, passiveDmgReduction: 0 };
      var r = resolveCombat(attacker, defender);
      assertEqual(r.damage, 7, 'damage should be 10 - 3 = 7');
      assertEqual(r.isCrit, false, 'should not be a crit');
    } finally {
      Math.random = orig;
    }
  });

  test('minimum damage is 1 when def exceeds atk', function () {
    var orig = Math.random;
    try {
      Math.random = function () { return 1; };
      var attacker = { atk: 1, atkBonus: 0, critChance: 0, critMult: 2, passiveDmgReduction: 0 };
      var defender = { def: 99, defBonus: 0, hp: 100, passiveDmgReduction: 0 };
      var r = resolveCombat(attacker, defender);
      assertEqual(r.damage, 1, 'minimum damage should be 1');
    } finally {
      Math.random = orig;
    }
  });

  test('crit: damage multiplied by critMult when roll < critChance', function () {
    var orig = Math.random;
    try {
      Math.random = function () { return 0; }; // roll = 0 < any critChance → always crit
      var attacker = { atk: 10, atkBonus: 0, critChance: 1, critMult: 2, passiveDmgReduction: 0 };
      var defender = { def: 0, defBonus: 0, hp: 100, passiveDmgReduction: 0 };
      var r = resolveCombat(attacker, defender);
      assertEqual(r.damage, 20, 'crit damage should be 10 * 2 = 20');
      assertEqual(r.isCrit, true, 'should be flagged as crit');
    } finally {
      Math.random = orig;
    }
  });

  test('Doge crit: critMult 3 applied', function () {
    var orig = Math.random;
    try {
      Math.random = function () { return 0; };
      var doge = createPlayer('doge');
      doge.atkBonus = 0;
      var defender = { def: 0, defBonus: 0, hp: 100, passiveDmgReduction: 0 };
      var r = resolveCombat(doge, defender);
      assertEqual(r.damage, doge.atk * 3, 'Doge crit should use critMult 3');
    } finally {
      Math.random = orig;
    }
  });

  test('Grumpy Cat passive reduction reduces incoming damage', function () {
    var orig = Math.random;
    try {
      Math.random = function () { return 1; };
      var grumpy = createPlayer('grumpy');
      // atk=10, grumpy.def=8 → base damage = max(1, 10-8) = 2
      // after 20% reduction: floor(2 * 0.8) = floor(1.6) = 1, then max(1,1) = 1
      var result = enemyAttack({ atk: 10 }, grumpy);
      assertEqual(result.damage, 1, 'Grumpy Cat damage should be 1 after reduction');
    } finally {
      Math.random = orig;
    }
  });

  test('enemy hp reaches 0 and alive becomes false', function () {
    var orig = Math.random;
    try {
      Math.random = function () { return 1; }; // no crits
      var player = createPlayer('doge');
      var enemy = createEnemy('wojak', 0, 0, 1);
      enemy.hp = 1; // one hit kill
      playerAttack(player, enemy);
      assertEqual(enemy.alive, false, 'enemy should be dead');
      assertEqual(enemy.hp, 0, 'enemy hp should be clamped to 0');
    } finally {
      Math.random = orig;
    }
  });

  test('Duck attacks twice (2 results)', function () {
    var orig = Math.random;
    try {
      Math.random = function () { return 1; };
      var duck = createPlayer('duck');
      var boss = createEnemy('bigchungus', 0, 0, 5); // high hp so second hit lands
      var results = playerAttack(duck, boss);
      assertEqual(results.length, 2, 'Duck should produce 2 attack results');
    } finally {
      Math.random = orig;
    }
  });

  test('non-Duck character attacks once (1 result)', function () {
    var orig = Math.random;
    try {
      Math.random = function () { return 1; };
      var doge = createPlayer('doge');
      var boss = createEnemy('bigchungus', 0, 0, 5);
      var results = playerAttack(doge, boss);
      assertEqual(results.length, 1, 'Doge should produce 1 attack result');
    } finally {
      Math.random = orig;
    }
  });

  // ── ITEMS ─────────────────────────────────────────────────────────────────

  suite('Items');

  test('health_potion restores 15 HP', function () {
    var p = createPlayer('doge');
    p.hp = 10;
    ITEMS.health_potion.apply(p);
    assertEqual(p.hp, 25, 'hp should be 10 + 15 = 25');
  });

  test('health_potion does not exceed maxHp', function () {
    var p = createPlayer('doge');
    p.hp = p.maxHp; // already full
    ITEMS.health_potion.apply(p);
    assertEqual(p.hp, p.maxHp, 'hp should not exceed maxHp');
  });

  test('atk_upgrade adds 3 to atkBonus', function () {
    var p = createPlayer('doge');
    var before = p.atkBonus;
    ITEMS.atk_upgrade.apply(p);
    assertEqual(p.atkBonus, before + 3, 'atkBonus should increase by 3');
  });

  test('def_upgrade adds 2 to defBonus', function () {
    var p = createPlayer('doge');
    var before = p.defBonus;
    ITEMS.def_upgrade.apply(p);
    assertEqual(p.defBonus, before + 2, 'defBonus should increase by 2');
  });

  test('max_hp_upgrade increases maxHp by 10', function () {
    var p = createPlayer('doge');
    var prevMax = p.maxHp;
    ITEMS.max_hp_upgrade.apply(p);
    assertEqual(p.maxHp, prevMax + 10, 'maxHp should increase by 10');
  });

  // ── DUNGEON ───────────────────────────────────────────────────────────────

  suite('Dungeon');

  test('generateDungeon returns a valid structure', function () {
    var player = createPlayer('doge');
    var d = generateDungeon(1, player);
    assert(Array.isArray(d.tiles) && d.tiles.length === DUNGEON_H, 'tiles height wrong');
    assert(d.rooms.length >= 2, 'should have at least 2 rooms');
    assert(Array.isArray(d.entities), 'should have entities array');
    assert(Array.isArray(d.items), 'should have items array');
    assert(d.stairsPos && typeof d.stairsPos.x === 'number', 'should have stairsPos');
  });

  test('player is placed on a floor or stairs tile', function () {
    var player = createPlayer('doge');
    generateDungeon(1, player);
    var tile = player; // generateDungeon mutates player.x/y
    // re-generate to get dungeon reference
    var p2 = createPlayer('doge');
    var d = generateDungeon(1, p2);
    var t = d.tiles[p2.y][p2.x];
    assert(t === TILE.FLOOR || t === TILE.STAIRS, 'player tile should be FLOOR or STAIRS, got ' + t);
  });

  test('stairs tile exists at stairsPos', function () {
    var player = createPlayer('doge');
    var d = generateDungeon(1, player);
    var t = d.tiles[d.stairsPos.y][d.stairsPos.x];
    assertEqual(t, TILE.STAIRS, 'stairsPos tile should be STAIRS');
  });

  test('floor 5 has Big Chungus boss', function () {
    var player = createPlayer('doge');
    var d = generateDungeon(5, player);
    var boss = d.entities.filter(function (e) { return e.enemyKey === 'bigchungus'; });
    assertEqual(boss.length, 1, 'floor 5 should have exactly 1 bigchungus');
    assertEqual(boss[0].isBoss, true, 'boss entity should have isBoss=true');
  });

  test('Raccoon generates double items vs same-seed Doge run', function () {
    var orig = Math.random;
    try {
      var n = 0;
      // Simple deterministic sequence
      Math.random = function () { n = (n + 0.6180339887) % 1; return n; };

      n = 0;
      var raccoon = createPlayer('raccoon');
      var dr = generateDungeon(3, raccoon);

      n = 0;
      var doge = createPlayer('doge');
      var dd = generateDungeon(3, doge);

      assert(dr.items.length > dd.items.length,
        'raccoon items (' + dr.items.length + ') should exceed doge items (' + dd.items.length + ')');
    } finally {
      Math.random = orig;
    }
  });

  test('floor 1 enemies do not include bigchungus', function () {
    var player = createPlayer('doge');
    var d = generateDungeon(1, player);
    var hasBoss = d.entities.some(function (e) { return e.enemyKey === 'bigchungus'; });
    assertEqual(hasBoss, false, 'floor 1 should not have bigchungus');
  });

  // ── UTILITIES ─────────────────────────────────────────────────────────────

  suite('Utilities');

  test('chebyshev: cardinal adjacent = 1', function () {
    assertEqual(chebyshev(5, 5, 6, 5), 1, 'right = 1');
    assertEqual(chebyshev(5, 5, 4, 5), 1, 'left = 1');
    assertEqual(chebyshev(5, 5, 5, 6), 1, 'down = 1');
    assertEqual(chebyshev(5, 5, 5, 4), 1, 'up = 1');
  });

  test('chebyshev: diagonal adjacent = 1', function () {
    assertEqual(chebyshev(5, 5, 6, 6), 1, 'diagonal = 1');
    assertEqual(chebyshev(5, 5, 4, 4), 1, 'diagonal = 1');
  });

  test('chebyshev: same tile = 0', function () {
    assertEqual(chebyshev(3, 7, 3, 7), 0, 'same tile = 0');
  });

  test('chebyshev: larger distance = max of abs diffs', function () {
    assertEqual(chebyshev(0, 0, 5, 3), 5, 'max(5,3) = 5');
    assertEqual(chebyshev(0, 0, 2, 8), 8, 'max(2,8) = 8');
  });

  test('getEligibleEnemyKeys: floor 1 excludes boss and floor-2 enemies', function () {
    var floor1 = getEligibleEnemyKeys(1);
    assert(floor1.indexOf('bigchungus') === -1, 'boss must not appear on floor 1');
    assert(floor1.indexOf('chad') === -1, 'chad (floorMin 2) must not appear on floor 1');
    assert(floor1.indexOf('trollface') !== -1, 'trollface should be on floor 1');
    assert(floor1.indexOf('wojak') !== -1, 'wojak should be on floor 1');
  });

  test('getEligibleEnemyKeys: floor 2 includes chad and nyancat', function () {
    var floor2 = getEligibleEnemyKeys(2);
    assert(floor2.indexOf('chad') !== -1, 'chad should appear on floor 2');
    assert(floor2.indexOf('nyancat') !== -1, 'nyancat should appear on floor 2');
    assert(floor2.indexOf('bigchungus') === -1, 'boss must not appear via getEligibleEnemyKeys');
  });

  test('enemy stats scale with floor', function () {
    var e1 = createEnemy('trollface', 0, 0, 1);
    var e3 = createEnemy('trollface', 0, 0, 3);
    assert(e3.hp > e1.hp, 'floor 3 enemy should have more HP than floor 1');
    assert(e3.atk > e1.atk, 'floor 3 enemy should have more ATK than floor 1');
  });

  return results;
}
