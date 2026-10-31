const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 800, height: 450 }, dpr: 1 });
  const page = await L.openGame(ctx);
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.waitForFunction(() => pirateAssetsReady === true, null, { timeout: 60000 });
  await page.waitForFunction(() => MC['p0'] && MC['p0'].getObjectByName('STARFALL_FORWARD_AXIS_FIX_RUNTIME'), null, { timeout: 60000 });
  const scene = await page.evaluate(() => ({
    ambient: S.children.find(o => o.isAmbientLight)?.intensity,
    directional: sun.intensity,
    stars: sky.children.filter(o => o.isPoints).length,
    planets: worldPlanets.length,
    atmosphereVectors: new Set(worldPlanets.map(p => p.mesh.children.find(o => o.material?.uniforms?.c && o.material?.uniforms?.s)?.material.uniforms.s.value)).size
  }));
  L.check('восстановлено мягкое общее освещение ранней сборки', scene.ambient >= .39 && scene.directional >= 1.29, scene);
  L.check('звёздное поле и планетная система сохранены', scene.stars >= 2 && scene.planets >= 6, scene);
  L.check('каждая планета имеет независимый вектор освещения атмосферы', scene.atmosphereVectors >= 6, scene);
  await page.evaluate(() => { lift(); QL.setMode('low'); pirateFleetInit(); });
  await page.waitForFunction(() => pirateFleet.length === 3, null, { timeout: 15000 });

  const composition = await page.evaluate(() => ({
    total: pirateFleet.length,
    golovorez: pirateFleet.filter(e => e.ty === 0).length,
    jackal: pirateFleet.filter(e => e.ty === 1).length,
    spawned: pirateFleet.filter(e => !!e.g).length
  }));
  L.check('эскадрилья содержит два Головореза и один Шакал', composition.total === 3 && composition.golovorez === 2 && composition.jackal === 1, composition);
  L.check('все три корабля созданы', composition.spawned === 3, composition);
  const locators = await page.evaluate(() => {
    const e = pirateFleet.find(p => p.ty === 0);
    const axis = e.g.getObjectByName('STARFALL_FORWARD_AXIS_FIX_RUNTIME');
    return { axis: !!axis, axisY: axis?.rotation.y, guns: e.muzzleNodes.length, engines: e.engineNodes.length };
  });
  L.check('нос «Ржавого черепа» развёрнут вперёд, доступны 4 пушки и 2 двигателя', locators.axis && Math.abs(Math.abs(locators.axisY) - Math.PI) < .001 && locators.guns === 4 && locators.engines === 2, locators);

  const combat = await page.evaluate(() => {
    pirateFleet.forEach((e, i) => {
      e.warp = 0; e.g.visible = true;
      e.g.position.copy(P).add(new THREE.Vector3((i - 1) * 12, 0, -520));
      e.hd.copy(P.clone().sub(e.g.position).normalize());
      e.vel.copy(e.hd).multiplyScalar(40);
      e.state = 'ATTACK_RUN'; e.stateT = 0; e.fire = 0; e.burst = 0; e.burstGap = 0;
    });
    const before = eb.length;
    pirateFleetUpdate(.05);
    const first = pirateFleet.find(e => e.ty === 0);
    const shots = eb.slice(before).filter(b => b.pirateFleetSlot === first.slot);
    const gunPositions = first.muzzleNodes.map(n => n.getWorldPosition(new THREE.Vector3()));
    const muzzleMatch = shots.length === 4 && shots.every((b, i) => b.m.position.distanceTo(gunPositions[i]) < .001);
    const shotForward = shots.length === 4 && shots.every((b, i) => b.v.clone().normalize().dot(P.clone().sub(gunPositions[i]).normalize()) > .5);
    const socketsForward = gunPositions.length === 4 && gunPositions.every(p => p.clone().sub(first.g.position).dot(new THREE.Vector3(0,0,-1).applyQuaternion(first.g.quaternion)) > 0);
    const noseAlignment = pirateFleet.map(e => {
      e.g.updateMatrixWorld(true);
      const fix = e.g.getObjectByName('STARFALL_FORWARD_AXIS_FIX_RUNTIME');
      return fix ? new THREE.Vector3(0, 0, 1).applyQuaternion(fix.getWorldQuaternion(new THREE.Quaternion())).dot(e.vel.clone().normalize()) : -1;
    });
    return { before, after: eb.length, delta: eb.length - before, noseAlignment, firstShipShots: shots.length, muzzleMatch, shotForward, socketsForward };
  });
  L.check('все три пилота стреляют на близкой дистанции', combat.delta >= 3, combat);
  L.check('фактический нос каждой модели совпадает с направлением движения', combat.noseAlignment.every(x => x > .98), combat.noseAlignment);
  L.check('четыре лазера выходят из четырёх дульных маркеров', combat.firstShipShots === 4 && combat.muzzleMatch && combat.shotForward && combat.socketsForward, combat);

  const pass = await page.evaluate(() => {
    pirateFleet.forEach(p => { p.fire = 99; p.burst = 0; p.burstGap = 0; });
    const e = pirateFleet[0];
    e.warp = 0; e.g.visible = true;
    e.g.position.copy(P).add(new THREE.Vector3(0, 0, -620));
    e.hd.set(0, 0, 1); e.vel.set(0, 0, 36); e.speed = 36;
    e.state = 'ATTACK_RUN'; e.stateT = 0; e.runDir = null;
    e.fire = 99; e.burst = 0; e.burstGap = 0;
    let minDistance = Infinity; const states = {};
    for (let i = 0; i < 600; i++) {
      pirateFleetUpdate(.05);
      minDistance = Math.min(minDistance, e.g.position.distanceTo(P));
      states[e.state] = true;
    }
    return { minDistance, states: Object.keys(states) };
  });
  L.check('пилот выполняет огневой пролёт через ближнюю зону и выходит из атаки', pass.minDistance < 220 && pass.states.includes('FIRING_PASS') && pass.states.includes('OVERSHOOT'), pass);

  const damage = await page.evaluate(() => {
    const e = pirateFleet[0], type = e.ty;
    pirateFleetDamage(e, 100000, false);
    const destroyed = !e.g && e.dead && e.respawn > 0;
    e.respawn = 0; pirateFleetUpdate(.05);
    return { destroyed, respawned: !!e.g, sameType: e.ty === type, slots: pirateFleet.length };
  });
  L.check('уничтожение и восстановление корабля сохраняют слот и тип', damage.destroyed && damage.respawned && damage.sameType && damage.slots === 3, damage);

  const textureReuse = await page.evaluate(() => {
    for (const e of pirateFleet) {
      pirateFleetDamage(e, e.mx * .4, false);
      pirateFleetDamage(e, e.mx * .3, false);
    }
    const shared = pirateFleet.every(e =>
      e.flames.every(f => f.material === pirateFleetFlameMat) &&
      e.smoke?.material?.map === pirateFleetSmokeTex &&
      e.fireFx?.material?.map === pirateFleetFireTex
    );
    return {
      shared,
      flameTexture: pirateFleetFlameMat.map.uuid,
      smokeTexture: pirateFleetSmokeTex.uuid,
      fireTexture: pirateFleetFireTex.uuid
    };
  });
  L.check('все три пилота используют общие текстуры двигателя, дыма и огня', textureReuse.shared, textureReuse);

  const docked = await page.evaluate(() => {
    dock();
    return { state, slots: pirateFleet.length, ready: pirateFleetReady, taggedShots: eb.filter(b => b.pirateFleet).length };
  });
  L.check('стыковка очищает флот и его снаряды', docked.state === 'dock' && docked.slots === 0 && !docked.ready && docked.taggedShots === 0, docked);
  await page.evaluate(() => { lift(); QL.setMode('low'); pirateFleetInit(); });
  await page.waitForFunction(() => pirateFleet.length === 3, null, { timeout: 15000 });
  const relaunched = await page.evaluate(() => pirateFleet.length === 3 && pirateFleet.filter(e => e.ty === 0).length === 2 && pirateFleet.filter(e => e.ty === 1).length === 1);
  L.check('после dock → lift снова создаётся состав 2+1', relaunched);

  const cleanup = await page.evaluate(() => {
    toMenu();
    return { slots: pirateFleet.length, ready: pirateFleetReady };
  });
  L.check('возврат в меню полностью очищает эскадрилью', cleanup.slots === 0 && cleanup.ready === false, cleanup);
  L.check('все видимые звёздные диски удалены из сцены', typeof starTarget === 'undefined' && typeof star2 === 'undefined', { starTarget: typeof starTarget, star2: typeof star2 });
  L.check('нет ошибок JavaScript', page.errors.length === 0, page.errors);
  process.exitCode = L.summary();
  await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
