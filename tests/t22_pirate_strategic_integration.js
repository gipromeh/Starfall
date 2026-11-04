const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 900, height: 520 }, dpr: 1 });
  const page = await L.openGame(ctx);
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.evaluate(() => { lift(); QL.setMode('low'); });
  await page.waitForFunction(() => state === 'play' && typeof pirateStrategicSystem === 'function', null, { timeout: 30000 });
  await page.waitForFunction(() => pirateAssetsReady === true, null, { timeout: 60000 });

  const raid = await page.evaluate(() => {
    const data = pirateStrategicSystem(sy, true);
    const group = data.groups.find(g => g.source === 'patrol');
    if (!group) throw new Error('No persistent patrol group was initialized');
    const before = nv.length;
    spawnPlanetFreighter(2);
    if (nv.length !== before + 1) throw new Error('Production route freighter did not spawn');
    const npc = nv[nv.length - 1];
    if (!npc.route || !npc.passengerTransport) throw new Error('Production passenger freighter has no route metadata');
    npc.g.position.copy(P).add(new THREE.Vector3(4500, 0, 0));
    npc.route.destination.copy(npc.g.position).add(new THREE.Vector3(2500, 0, 0));
    npc.route.direction.copy(npc.route.destination).sub(npc.g.position).normalize();
    npc.route.speed = 0;
    npc.hp = 18;
    npc.mx = 18;
    const expectedCargo = npc.route.cargo;
    group.position = pirateStrategicArray(npc.g.position);
    group.velocity = [0, 0, 0];
    group.targetNpcId = pirateStrategicTagNpc(npc);
    group.cooldown = 0;
    group.state = 'intercept';
    for (let i = 0; i < 60 && nv.includes(npc); i++) pirateStrategicUpdate(.1);
    const result = {
      removed: !nv.includes(npc),
      pirateOwned: npc.pk === 1,
      raids: data.ledger.raids,
      cargoLedger: data.ledger.cargo,
      expectedCargo,
      routeFrom: npc.route.from,
      routeTo: npc.route.to,
      passengerTransport: npc.passengerTransport
    };
    const index = nv.indexOf(npc);
    if (index >= 0) nv.splice(index, 1);
    if (npc.g.parent) S.remove(npc.g);
    return result;
  });
  L.check('стратегическая группа атакует NPC, созданный штатным генератором торговых маршрутов',
    raid.removed && raid.pirateOwned && raid.raids >= 1 && raid.cargoLedger >= raid.expectedCargo &&
    raid.passengerTransport && !!raid.routeFrom && !!raid.routeTo && raid.routeFrom !== raid.routeTo, raid);

  const combat = await page.evaluate(() => {
    const oldE = E, oldE2 = E2;
    const data = pirateStrategicSystem(sy, true);
    const group = data.groups.find(g => g.source === 'patrol' && g.state !== 'destroyed');
    const mesh = new THREE.Group();
    mesh.position.copy(P).add(new THREE.Vector3(0, 0, -900));
    S.add(mesh);
    const npcMesh = new THREE.Group();
    npcMesh.position.copy(mesh.position).add(new THREE.Vector3(0, 0, -120));
    S.add(npcMesh);
    const npc = {
      g: npcMesh, v: new THREE.Vector3(), hp: 100, mx: 100, hit: 0, pk: 0,
      route: { destination: npcMesh.position.clone().add(new THREE.Vector3(0, 0, -2000)),
        direction: new THREE.Vector3(0, 0, -1), speed: 60, from: 'INNER', to: 'OUTER', kind: 0, cargo: 30, passengers: 0 }
    };
    nv.push(npc);
    pirateStrategicTagNpc(npc);
    group.position = pirateStrategicArray(mesh.position);
    group.targetNpcId = npc._sfStrategicNpcId;
    group._targetNpcRef = npc;
    E = null; E2 = null;
    spawnE({ strategicGroup: group });
    const enemy = E || E2;
    const result = {
      spawned: !!enemy,
      boundToRealNpc: !!enemy && enemy.tn === npc,
      hasStableGroupId: !!enemy && enemy._sfStrategicGroupId === group.id,
      routeId: npc._sfStrategicNpcId
    };
    if (enemy && enemy.g && enemy.g.parent) S.remove(enemy.g);
    group._enemyRef = null;
    group.state = 'destroyed';
    E = oldE; E2 = oldE2;
    const index = nv.indexOf(npc);
    if (index >= 0) nv.splice(index, 1);
    if (mesh.parent) S.remove(mesh);
    if (npcMesh.parent) S.remove(npcMesh);
    return result;
  });
  L.check('стратегическая группа разворачивает реальный боевой корабль и назначает NPC целью',
    combat.spawned && combat.boundToRealNpc && combat.hasStableGroupId, combat);

  const dockHandoff = await page.evaluate(() => {
    const oldE = E, oldE2 = E2;
    const mesh = new THREE.Group();
    mesh.position.copy(P).add(new THREE.Vector3(0, 0, -500));
    S.add(mesh);
    const fakeEnemy = { g: mesh, hp: 80, mx: 100, ty: 0, tn: null, warp: 0, aiIntent: 'ATTACK' };
    const group = pirateStrategicAttachEnemy(fakeEnemy, null);
    E = fakeEnemy; E2 = null;
    pirateStrategicSuspendCombat();
    const detached = group._enemyRef === null && fakeEnemy.tn === null && group.state === 'patrol';
    group.state = 'destroyed';
    E = oldE; E2 = oldE2;
    if (mesh.parent) S.remove(mesh);
    return detached;
  });
  L.check('при стыковке активный бой передаётся стратегическому симулятору без потери группы', dockHandoff);

  const dockRaid = await page.evaluate(() => {
    const oldState = state;
    const data = pirateStrategicSystem(sy, true);
    const group = data.groups.find(g => g.source === 'patrol' && g.state !== 'destroyed');
    const mesh = new THREE.Group();
    mesh.position.copy(P).add(new THREE.Vector3(5200, 0, 0));
    S.add(mesh);
    const npc = { g: mesh, v: new THREE.Vector3(), hp: 24, mx: 24, hit: 0, pk: 0,
      route: { destination: mesh.position.clone().add(new THREE.Vector3(1200, 0, 0)),
        direction: new THREE.Vector3(1, 0, 0), speed: 0, from: 'DOCK-A', to: 'DOCK-B',
        kind: 0, cargo: 55, passengers: 0 } };
    nv.push(npc);
    pirateStrategicTagNpc(npc);
    group.position = pirateStrategicArray(mesh.position);
    group.velocity = [0, 0, 0];
    group.targetNpcId = npc._sfStrategicNpcId;
    group.cooldown = 0;
    group.raidProgress = 0;
    group.state = 'intercept';
    window.__sfDockRaid = { oldState, data, group, npc, mesh, hp: npc.hp, raidsBefore: data.ledger.raids };
    state = 'dock';
    return true;
  });
  await page.waitForFunction(() => window.__sfDockRaid && window.__sfDockRaid.data.ledger.raids > window.__sfDockRaid.raidsBefore,
    null, { timeout: 7000 });
  const dockRaidResult = await page.evaluate(() => {
    const x = window.__sfDockRaid;
    const result = !!x && state === 'dock' && x.npc.pk === 1 && !nv.includes(x.npc) &&
      x.data.ledger.raids > x.raidsBefore;
    if (x) {
      const i = nv.indexOf(x.npc); if (i >= 0) nv.splice(i, 1);
      if (x.mesh.parent) S.remove(x.mesh);
      x.group.state = 'destroyed';
      state = x.oldState;
      delete window.__sfDockRaid;
    }
    return result;
  });
  L.check('стратегические рейды продолжаются в реальном игровом цикле во время стыковки', dockRaidResult);

  const persistence = await page.evaluate(() => {
    const before = pirateStrategicSnapshot();
    const validated = pirateStrategicValidate(before);
    const valid = validated.version === 1 && validated.systems[sy] &&
      validated.systems[sy].groups.length === before.systems[sy].groups.length;
    const noTransientFleet = before.systems[sy].groups.every(g => g.source !== 'fleet');
    const saved = SV.save('pirate-strategic-regression');
    const loaded = SV.load();
    const persisted = loaded.ok && loaded.d.ps && loaded.d.ps.version === 1 &&
      loaded.d.ps.systems[sy] && loaded.d.ps.systems[sy].groups.length > 0;
    const legacyPayload = loaded.ok ? { ...loaded.d } : {};
    delete legacyPayload.ps;
    const legacyCompatible = SV.validate(legacyPayload).ok &&
      SV.validate(legacyPayload).d.ps.version === 1;
    const previousCount = SF_PIRATE_STRATEGIC.stats()?.groups || 0;
    pirateStrategicRestore(loaded.d.ps);
    const restoredCount = SF_PIRATE_STRATEGIC.stats()?.groups || 0;
    return { valid, noTransientFleet, saved, loaded: loaded.ok, persisted, legacyCompatible, previousCount, restoredCount,
      raidLedger: SF_PIRATE_STRATEGIC.stats()?.raids || 0 };
  });
  L.check('система сохранений SV валидирует, записывает и восстанавливает стратегические группы',
    persistence.valid && persistence.noTransientFleet && persistence.saved && persistence.loaded && persistence.persisted &&
    persistence.legacyCompatible && persistence.restoredCount > 0, persistence);

  L.check('нет ошибок JavaScript', page.errors.length === 0, page.errors);
  process.exitCode = L.summary();
  await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
