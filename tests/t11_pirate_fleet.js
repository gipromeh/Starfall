const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 800, height: 450 }, dpr: 1 });
  const page = await L.openGame(ctx);
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.waitForFunction(() => pirateAssetsReady === true, null, { timeout: 60000 });
  const scene = await page.evaluate(() => {
    const vectors = worldPlanets.slice(0, 6).map(p => p.mesh.children.find(o => o.material?.uniforms?.c && o.material?.uniforms?.s)?.material.uniforms.s.value);
    const aligned = vectors.length === 6 && vectors.every((v,i) => v && v.clone().normalize().dot(SYSTEM_CENTER.clone().sub(worldPlanets[i].mesh.position).normalize()) > .999);
    return {
      ambient: S.children.find(o => o.isAmbientLight)?.intensity,
      directional: sun.intensity,
      hemisphere: S.children.find(o => o.isHemisphereLight)?.intensity,
      cameraFill: C.children.find(o => o.isDirectionalLight)?.intensity,
      bloom: CP.passes.find(p => p.strength !== undefined)?.strength,
      stars: sky.children.filter(o => o.isPoints).length,
      planets: worldPlanets.length,
      atmosphereVectors: new Set(vectors).size,
      atmosphereAligned: aligned
    };
  });
  L.check('восстановлена равномерная световая схема ранней сборки', scene.ambient >= .39 && scene.directional >= 1.29 && scene.hemisphere >= .54 && scene.cameraFill >= .54 && scene.bloom >= .61, scene);
  L.check('звёздное поле и планетная система сохранены', scene.stars >= 2 && scene.planets >= 6, scene);
  L.check('атмосферы планет согласованы с направлением реального солнца', scene.atmosphereVectors >= 6 && scene.atmosphereAligned, scene);
  await page.evaluate(() => { lift(); QL.setMode('low'); pirateFleetInit(); });
  await page.waitForFunction(() => pirateFleet.length === 4, null, { timeout: 15000 });


  const livery = await page.evaluate(() => {
    const models = [0, 1, 2, 3].map(i => mkPirate(i)).concat([mkBoss()]);
    return models.map((g, i) => {let total=0,white=0;g.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if(m?.isMeshStandardMaterial){total++;if(m.map===window.pirateLiveryTex&&m.color.getHex()===0xffffff)white++}})});return{type:i,total,white}});
  });
  L.check('все четыре типа пиратов и флагман используют белую панельную ливрею', livery.every(x=>x.total>0&&x.white>0), livery);
  const laser=await page.evaluate(()=>{const a=[];shootLaser(a,new THREE.Vector3(),new THREE.Vector3(0,0,-420),0x44eeff,10,1);const b=a[0],p=b.m.geometry.attributes.position,forward=new THREE.Vector3(0,0,1).applyQuaternion(b.m.quaternion);const out={isMesh:b.m.isMesh,scaleLength:b.m.scale.z,forwardDot:forward.dot(new THREE.Vector3(0,0,-1))};S.remove(b.m);a.length=0;return out});
  L.check('лазер — один длинный продольный отрезок без поперечных элементов',laser.isMesh&&laser.scaleLength>=60&&laser.forwardDot>.999,laser);
  const boost=await page.evaluate(()=>{const old={ine,fuel,thr,key:keys.ShiftLeft};ine=0;fuel=0;thr=0;keys.ShiftLeft=true;upd(.1);const arcade={thr,fuel};keys.ShiftLeft=false;ine=1;fuel=0;thr=0;keys.ShiftLeft=true;upd(.1);const balanced={thr,fuel};ine=old.ine;fuel=old.fuel;thr=old.thr;keys.ShiftLeft=old.key;return{arcade,balanced}});
  L.check('форсаж бесконечный только в режиме АРКАДА',boost.arcade.thr>.1&&boost.arcade.fuel===100&&boost.balanced.thr===0&&boost.balanced.fuel===0,boost);
  const regularDamage=await page.evaluate(()=>{const saved={E,E2},g=mkPirate(2),max=Math.max(200,SHIPS[shp].hull*2),e={g,ty:2,boss:false,hp:max,mx:max,vel:new THREE.Vector3(),hits:0};S.add(g);E=e;E2=null;hurtEn(e,20,false);const first={hp:e.hp,alive:e.g.parent===S,burning:!!e.fireFx,smoking:!!e.smoke};hurtEn(e,20,false);const second={hp:e.hp,alive:e.g.parent===S};S.remove(g);pirateDamageFxClear(e);E=saved.E;E2=saved.E2;return{first,second,minimum:max>=SHIPS[shp].hull*2}});
  L.check('обычный пират переживает первое попадание, загорается и принимает повторный урон',regularDamage.first.hp>0&&regularDamage.first.alive&&regularDamage.first.burning&&regularDamage.first.smoking&&regularDamage.second.hp<regularDamage.first.hp&&regularDamage.second.alive&&regularDamage.minimum,regularDamage);
  const fleetFirstHit=await page.evaluate(()=>{const e=pirateFleet[0];e.hp=e.mx;e.hits=0;pirateFleetDamage(e,20,false);return{hp:e.hp,mx:e.mx,alive:!!e.g,burning:!!e.fireFx,smoking:!!e.smoke,minimum:e.mx>=SHIPS[shp].hull*2}});
  L.check('пират эскадрильи после первого попадания горит, дымит и остаётся жив',fleetFirstHit.hp>0&&fleetFirstHit.alive&&fleetFirstHit.burning&&fleetFirstHit.smoking&&fleetFirstHit.minimum,fleetFirstHit);

  const composition = await page.evaluate(() => ({
    total: pirateFleet.length,
    types: [0,1,2,3].map(ty => pirateFleet.filter(e => e.ty === ty).length),
    spawned: pirateFleet.filter(e => !!e.g).length
  }));
  L.check('атака содержит по одному кораблю каждого из четырёх типов', composition.total === 4 && composition.types.every(n => n === 1), composition);
  L.check('все четыре корабля созданы', composition.spawned === 4, composition);
  const fleetHealth = await page.evaluate(() => pirateFleet.every(e => e.mx >= SHIPS[shp].hull * 2));
  L.check('прочность каждого корабля эскадрильи не ниже двойной прочности игрока', fleetHealth, fleetHealth);
  const locators = await page.evaluate(() => {
    const e = pirateFleet.find(p => p.ty === 0),jackal = pirateFleet.find(p => p.ty === 1);
    e.g.updateMatrixWorld(true);jackal.g.updateMatrixWorld(true);
    const axis = e.g.getObjectByName('STARFALL_FORWARD_AXIS_FIX_RUNTIME') || e.g.getObjectByName('STARFALL_FORWARD_AXIS_FIX');
    const axisForward = axis ? new THREE.Vector3(0,0,1).applyQuaternion(axis.getWorldQuaternion(new THREE.Quaternion())).dot(new THREE.Vector3(0,0,-1).applyQuaternion(e.g.quaternion)) : -1;
    return { axis: !!axis, axisForward, guns: e.muzzleNodes.length, engines: e.engineNodes.length, jackalGuns: jackal.muzzleNodes.length, jackalEngines: jackal.engineNodes.length };
  });
  L.check('фактическая носовая ось совпадает с курсом; доступны 4 пушки и 2 двигателя', locators.axis && locators.axisForward > .98 && locators.guns === 4 && locators.engines === 2, locators);
  L.check('«Шакал» имеет отдельные передний ствол и задний двигатель', locators.jackalGuns === 1 && locators.jackalEngines === 1, locators);

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
    const lineShots = shots.every(b => b.m.isLine && b.m.geometry.attributes.position.count === 2);
    const shotForward = shots.length === 4 && shots.every((b, i) => b.v.clone().normalize().dot(first.muzzleNodes[i].getWorldDirection(new THREE.Vector3())) > .98);
    const socketsForward = gunPositions.length === 4 && gunPositions.every(p => p.clone().sub(first.g.position).dot(new THREE.Vector3(0,0,-1).applyQuaternion(first.g.quaternion)) > 0);
    const allPilotShots = pirateFleet.map(e => {
      const own = eb.slice(before).filter(b => b.pirateFleetSlot === e.slot);
      const muzzles = e.muzzleNodes.length
        ? e.muzzleNodes.map(n => n.getWorldPosition(new THREE.Vector3()))
        : [e.g.localToWorld(new THREE.Vector3(0,-.25,-3.8))];
      return { slot: e.slot, shots: own.length, guns: muzzles.length, originsMatch: own.length === muzzles.length && own.every((b, i) => b.m.position.distanceTo(muzzles[i]) < .001) };
    });
    const noseAlignment = pirateFleet.map(e => {
      e.g.updateMatrixWorld(true);
      const fix = e.g.getObjectByName('STARFALL_FORWARD_AXIS_FIX_RUNTIME') || e.g.getObjectByName('STARFALL_FORWARD_AXIS_FIX');
      return fix ? new THREE.Vector3(0, 0, 1).applyQuaternion(fix.getWorldQuaternion(new THREE.Quaternion())).dot(e.vel.clone().normalize()) : -1;
    });
    return { before, after: eb.length, delta: eb.length - before, noseAlignment, firstShipShots: shots.length, muzzleMatch, shotForward, socketsForward, lineShots, allPilotShots };
  });
  L.check('все четыре пилота участвуют в бою на близкой дистанции', combat.delta >= 3, combat);
  L.check('фактический нос каждой модели совпадает с направлением движения', combat.noseAlignment.every(x => x > .98), combat.noseAlignment);
  L.check('четыре лазера выходят из дульных маркеров вдоль оси стволов', combat.firstShipShots === 4 && combat.muzzleMatch && combat.shotForward && combat.socketsForward && combat.lineShots, combat);
  L.check('каждый пират стреляет из собственного переднего сокета', combat.allPilotShots.every(x => x.shots === x.guns && x.shots > 0 && x.originsMatch), combat.allPilotShots);

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
  L.check('уничтожение и восстановление корабля сохраняют слот и тип', damage.destroyed && damage.respawned && damage.sameType && damage.slots === 4, damage);

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
  L.check('все четыре пилота используют общие текстуры двигателя, дыма и огня', textureReuse.shared, textureReuse);

  const docked = await page.evaluate(() => {
    dock();
    return { state, slots: pirateFleet.length, ready: pirateFleetReady, taggedShots: eb.filter(b => b.pirateFleet).length };
  });
  L.check('стыковка очищает флот и его снаряды', docked.state === 'dock' && docked.slots === 0 && !docked.ready && docked.taggedShots === 0, docked);
  await page.evaluate(() => { lift(); QL.setMode('low'); pirateFleetInit(); });
  await page.waitForFunction(() => pirateFleet.length === 3, null, { timeout: 15000 });
  const relaunched = await page.evaluate(() => pirateFleet.length === 4 && [0,1,2,3].every(ty => pirateFleet.filter(e => e.ty === ty).length === 1));
  L.check('после dock → lift снова создаётся полный состав из четырёх типов', relaunched);

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
