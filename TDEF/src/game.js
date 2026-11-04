import * as B from '@babylonjs/core';

const CONFIG = Object.freeze({
  startingGold: 100,
  baseHealth: 20, // Prototype placeholder; replace when base HP is approved.
  enemiesPerWave: wave => 8 + wave * 2,
  spawnInterval: 0.85,
  enemy: { hp: 40, speed: 2, reward: 10, baseDamage: 1 },
  gunner: { cost: 50, range: 6, damage: 8, reloadTime: 0.3, projectileSpeed: 18 }
});

export function attachGame({ B: Babylon, scene, engine, curve, pads }) {
  const ui = {
    gold: document.getElementById('goldValue'),
    base: document.getElementById('baseValue'),
    wave: document.getElementById('waveValue'),
    kills: document.getElementById('killsValue'),
    state: document.getElementById('gameMessage'),
    build: document.getElementById('buildGunner'),
    start: document.getElementById('startWave'),
    pause: document.getElementById('pauseGame'),
    speed: document.getElementById('gameSpeed'),
    selected: document.getElementById('selectedPad')
  };
  const path = curve.map(p => p.clone());
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + B.Vector3.Distance(path[i - 1], path[i]));
  const pathLength = lengths[lengths.length - 1];
  const enemies = [], towers = [], projectiles = [];
  let gold = CONFIG.startingGold, baseHealth = CONFIG.baseHealth, wave = 0, kills = 0;
  let spawnLeft = 0, spawnTimer = 0, active = false, paused = false, speed = 1;
  let buildMode = false, selectedPad = -1, gameOver = false;

  const mat = (name, color, emissive = false) => {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = B.Color3.FromHexString(color);
    if (emissive) m.emissiveColor = B.Color3.FromHexString(color);
    return m;
  };
  const enemyMat = mat('tdefEnemyMat', '#a83232');
  const towerMat = mat('tdefGunnerMat', '#596b77');
  const metalMat = mat('tdefGunnerMetal', '#a7b4b7');
  const bulletMat = mat('tdefBulletMat', '#ffd36a', true);

  function message(text) { ui.state.textContent = text; }
  function refresh() {
    ui.gold.textContent = String(gold);
    ui.base.textContent = String(baseHealth);
    ui.wave.textContent = String(wave);
    ui.kills.textContent = String(kills);
    ui.start.disabled = active || gameOver;
    ui.build.disabled = gameOver;
    ui.pause.disabled = !active;
    ui.pause.textContent = paused ? 'Продолжить' : 'Пауза';
    ui.speed.disabled = !active;
    ui.selected.textContent = selectedPad < 0 ? 'Не выбрана' : 'Площадка ' + (selectedPad + 1);
  }
  function pointAt(distance) {
    const d = Math.max(0, Math.min(pathLength, distance));
    let lo = 0, hi = lengths.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] < d) lo = mid; else hi = mid;
    }
    const span = lengths[hi] - lengths[lo];
    return B.Vector3.Lerp(path[lo], path[hi], span > 0 ? (d - lengths[lo]) / span : 0);
  }
  function makeTower(index) {
    const p = pads[index];
    const root = new B.TransformNode('gunnerRoot' + index, scene);
    root.position.set(p[0], p[1] + 0.5, p[2]);
    const base = B.MeshBuilder.CreateCylinder('gunnerBase' + index, { diameter: 1.05, height: 0.55, tessellation: 12 }, scene);
    base.parent = root; base.position.y = 0.28; base.material = towerMat;
    const head = B.MeshBuilder.CreateCylinder('gunnerHead' + index, { diameter: 0.68, height: 0.42, tessellation: 12 }, scene);
    head.parent = root; head.position.y = 0.76; head.material = metalMat;
    const barrel = B.MeshBuilder.CreateBox('gunnerBarrel' + index, { width: 0.22, height: 0.22, depth: 0.95 }, scene);
    barrel.parent = root; barrel.position.set(0, 0.78, 0.56); barrel.material = towerMat;
    const ring = B.MeshBuilder.CreateTorus('gunnerRange' + index, { diameter: CONFIG.gunner.range * 2, thickness: 0.025, tessellation: 64 }, scene);
    ring.parent = root; ring.position.y = 0.035; ring.rotation.x = Math.PI / 2;
    const rangeMat = mat('gunnerRangeMat' + index, '#e8d18b', true);
    rangeMat.alpha = 0.22; ring.material = rangeMat; ring.isVisible = false; ring.isPickable = false;
    return { index, root, head, barrel, ring, cooldown: 0, cost: CONFIG.gunner.cost };
  }
  function build(index) {
    if (towers.some(t => t.index === index)) { selectedPad = index; message('На площадке уже стоит Gunner.'); refresh(); return; }
    if (gold < CONFIG.gunner.cost) { message('Недостаточно золота: Gunner стоит 50.'); return; }
    gold -= CONFIG.gunner.cost;
    const tower = makeTower(index); towers.push(tower); selectedPad = index;
    buildMode = false; ui.build.classList.remove('active');
    message('Gunner построен. Выберите площадку для просмотра дальности.');
    refresh();
  }
  function spawnEnemy() {
    const mesh = B.MeshBuilder.CreateSphere('normalEnemy' + (kills + enemies.length), { diameter: 0.72, segments: 10 }, scene);
    mesh.position.copyFrom(pointAt(0)); mesh.position.y = 0.62; mesh.material = enemyMat;
    const barBack = B.MeshBuilder.CreateBox('enemyHealthBack', { width: 0.9, height: 0.09, depth: 0.07 }, scene);
    const barFill = B.MeshBuilder.CreateBox('enemyHealthFill', { width: 0.86, height: 0.07, depth: 0.08 }, scene);
    const backMat = mat('enemyHealthBackMat', '#351e1e'), fillMat = mat('enemyHealthFillMat', '#68d36e');
    barBack.material = backMat; barFill.material = fillMat;
    enemies.push({ mesh, barBack, barFill, hp: CONFIG.enemy.hp, distance: 0, dead: false });
  }
  function removeEnemy(enemy, reachedBase = false) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.mesh.dispose(); enemy.barBack.dispose(); enemy.barFill.dispose();
    const i = enemies.indexOf(enemy); if (i >= 0) enemies.splice(i, 1);
    if (reachedBase) {
      baseHealth = Math.max(0, baseHealth - CONFIG.enemy.baseDamage);
      if (baseHealth === 0) { gameOver = true; active = false; message('Поражение: база уничтожена.'); }
    } else { gold += CONFIG.enemy.reward; kills++; }
    refresh();
  }
  function fire(tower, enemy) {
    tower.cooldown = CONFIG.gunner.reloadTime;
    const origin = tower.root.position.add(new B.Vector3(0, 1.0, 0));
    const bullet = B.MeshBuilder.CreateSphere('gunnerBullet', { diameter: 0.19, segments: 8 }, scene);
    bullet.position.copyFrom(origin); bullet.material = bulletMat;
    projectiles.push({ mesh: bullet, target: enemy, damage: CONFIG.gunner.damage, speed: CONFIG.gunner.projectileSpeed });
    const direction = enemy.mesh.position.subtract(origin);
    tower.head.rotation.y = Math.atan2(direction.x, direction.z);
    tower.barrel.rotation.y = tower.head.rotation.y;
  }
  function update(dt) {
    if (!active || paused || gameOver) return;
    const delta = dt * speed;
    if (spawnLeft > 0) {
      spawnTimer -= delta;
      while (spawnLeft > 0 && spawnTimer <= 0) {
        spawnEnemy(); spawnLeft--; spawnTimer += CONFIG.spawnInterval;
      }
    }
    for (const enemy of [...enemies]) {
      enemy.distance += CONFIG.enemy.speed * delta;
      if (enemy.distance >= pathLength) { removeEnemy(enemy, true); continue; }
      const p = pointAt(enemy.distance); enemy.mesh.position.set(p.x, 0.62, p.z);
      enemy.barBack.position.set(p.x, 1.18, p.z);
      enemy.barFill.position.set(p.x - 0.02, 1.18, p.z);
      enemy.barFill.scaling.x = Math.max(0.01, enemy.hp / CONFIG.enemy.hp);
    }
    for (const tower of towers) {
      tower.cooldown -= delta;
      const center = tower.root.position;
      const target = enemies.filter(e => !e.dead && e.distance <= pathLength)
        .filter(e => B.Vector3.Distance(new B.Vector3(e.mesh.position.x, 0, e.mesh.position.z), new B.Vector3(center.x, 0, center.z)) <= CONFIG.gunner.range)
        .sort((a, b) => b.distance - a.distance)[0];
      if (target && tower.cooldown <= 0) fire(tower, target);
    }
    for (const shot of [...projectiles]) {
      if (!shot.target || shot.target.dead) {
        shot.mesh.dispose(); projectiles.splice(projectiles.indexOf(shot), 1); continue;
      }
      const destination = shot.target.mesh.position.add(new B.Vector3(0, 0.1, 0));
      const diff = destination.subtract(shot.mesh.position), step = shot.speed * delta;
      if (diff.length() <= step) {
        shot.target.hp -= shot.damage; shot.mesh.dispose(); projectiles.splice(projectiles.indexOf(shot), 1);
        if (shot.target.hp <= 0) removeEnemy(shot.target);
      } else shot.mesh.position.addInPlace(diff.normalize().scale(step));
    }
    if (active && spawnLeft === 0 && enemies.length === 0) {
      active = false; message('Волна ' + wave + ' отражена. Награда за волну: ' + (20 + 5 * wave) + '.');
      gold += 20 + 5 * wave; refresh();
    }
  }
  function startWave() {
    if (active || gameOver) return;
    wave++; spawnLeft = CONFIG.enemiesPerWave(wave); spawnTimer = 0; active = true; paused = false;
    message('Волна ' + wave + ': идут обычные враги.'); refresh();
  }

  scene.onPointerObservable.add(info => {
    if (info.type !== B.PointerEventTypes.POINTERPICK || !info.pickInfo?.hit) return;
    const index = info.pickInfo.pickedMesh?.metadata?.tdefPadIndex;
    if (!Number.isInteger(index) || gameOver) return;
    selectedPad = index;
    if (buildMode) build(index);
    else {
      const tower = towers.find(t => t.index === index);
      towers.forEach(t => { t.ring.isVisible = t === tower; });
      message(tower ? 'Gunner · урон 8 · дальность 6 · перезарядка 0,3 с.' : 'Площадка свободна. Нажмите «Построить Gunner».');
      refresh();
    }
  });
  ui.build.addEventListener('click', () => {
    if (gameOver) return;
    buildMode = !buildMode; ui.build.classList.toggle('active', buildMode);
    message(buildMode ? 'Выберите одну из восьми площадок.' : 'Режим строительства отменён.');
  });
  ui.start.addEventListener('click', startWave);
  ui.pause.addEventListener('click', () => { paused = !paused; refresh(); message(paused ? 'Игра на паузе.' : 'Волна продолжается.'); });
  ui.speed.addEventListener('change', () => { speed = Number(ui.speed.value) || 1; });
  scene.onBeforeRenderObservable.add(() => update(Math.min(engine.getDeltaTime() / 1000, 0.05)));
  document.addEventListener('visibilitychange', () => { if (document.hidden && active) { paused = true; refresh(); message('Пауза: вкладка неактивна.'); } });
  refresh();
  message('Постройте Gunner на площадке, затем запустите волну.');
  window.__TDEF_GAME__ = { startWave, getState: () => ({ gold, baseHealth, wave, kills, enemies: enemies.length, towers: towers.length }) };
}
