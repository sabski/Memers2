function resolveCombat(attacker, defender) {
  const atkVal = attacker.atk + (attacker.atkBonus || 0);
  const defVal = defender.def + (defender.defBonus || 0);
  let damage = Math.max(1, atkVal - defVal);

  const isCrit = Math.random() < (attacker.critChance || 0);
  if (isCrit) {
    damage = Math.floor(damage * (attacker.critMult || 2));
  }

  if (defender.passiveDmgReduction) {
    damage = Math.floor(damage * (1 - defender.passiveDmgReduction));
  }

  damage = Math.max(1, damage);
  defender.hp -= damage;

  return { damage, isCrit };
}

function playerAttack(player, enemy) {
  const results = [];
  const r1 = resolveCombat(player, enemy);
  results.push(r1);

  if (player.attackTwice && enemy.hp > 0) {
    const r2 = resolveCombat(player, enemy);
    results.push(r2);
  }

  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.alive = false;
  }

  return results;
}

function enemyAttack(enemy, player) {
  const atkVal = enemy.atk;
  const defVal = player.def + (player.defBonus || 0);
  let damage = Math.max(1, atkVal - defVal);

  if (player.passiveDmgReduction) {
    damage = Math.floor(damage * (1 - player.passiveDmgReduction));
  }

  damage = Math.max(1, damage);
  player.hp -= damage;

  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
  }

  return { damage, isCrit: false };
}
