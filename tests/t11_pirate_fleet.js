const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 800, height: 450 }, dpr: 1 });
  const page = await L.openGame(ctx);
  page.on('console', msg => { if (/pirate|GLB/i.test(msg.text())) console.log('PAGE '+msg.type()+': '+msg.text()); });
  page.on('pageerror', err => console.log('PAGE ERROR: '+err.message));
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.waitForFunction(() => pirateAssetsReady === true, null, { timeout: 60000 });
  await page.evaluate(() => { lift(); QL.setMode('low'); });
  await page.waitForFunction(() => state === 'play' && !!plt && !!stn, null, { timeout: 15000 });
  const scene = await page.evaluate(() => {
    const atmosphere = !!(plt && plt.children.length >= 2);
    return {
      ambient: S.children.find(o => o.isAmbientLight)?.intensity,
      directional: sun.intensity,
      hemisphere: S.children.find(o => o.isHemisphereLight)?.intensity,
      cameraFill: C.children.find(o => o.isDirectionalLight)?.intensity,
      bloom: CP.passes.find(p => p.strength !== undefined)?.strength,
      stars: sky.children.filter(o => o.isPoints).length,
      planets: plt && plt.visible ? 1 : 0,
      station: !!(stn && stn.visible),
      atmosphere
    };
  });
  L.check('восстановлена равномерная световая схема ранней сборки', scene.ambient >= .39 && scene.directional >= 1.29 && scene.hemisphere >= .54 && scene.cameraFill >= .54 && scene.bloom >= .54, scene);
  L.check('звёздное поле, локальная планета и станция сохранены', scene.stars >= 2 && scene.planets === 1 && scene.station, scene);
  L.check('атмосферный слой прикреплён к локальной планете', scene.atmosphere, scene);
  await page.evaluate(() => { pirateFleetInit(); });
  await page.waitForFunction(() => pirateFleet.length === 2, null, { timeout: 15000 });
  const spawnSnapshot = await page.evaluate(() => pirateFleet.map(e => ({
    type:e.ty, speed:e.speed, distance:e.g.position.distanceTo(P),
    ahead:e.g.position.clone().sub(P).normalize().dot(new THREE.Vector3(0,0,-1).applyQuaternion(Q).normalize()),
    lateral:e.g.position.clone().sub(P).dot(new THREE.Vector3(1,0,0).applyQuaternion(Q).normalize())
  })));
  await page.waitForFunction(() => window.SF_PIRATE_AI && window.SF_PIRATE_AI.ready, null, { timeout: 20000 });
  await page.waitForFunction(() => pirateFleet.every(e => e.sfAI && e.sfAiFrame), null, { timeout: 10000 });
  const coreBridge = await page.evaluate(() => ({
    version: window.SF_PIRATE_AI_VERSION,
    ships: pirateFleet.map(e => ({
      entity: e.sfAiFrame?.entityId,
      mission: e.sfAiFrame?.missionState,
      tactical: e.sfAiFrame?.tacticalState,
      target: e.sfAiFrame?.selectedTargetTrackId,
      nav: e.sfAiFrame?.navigation?.mode,
      enabled: e.sfAiEnabled
    }))
  }));
  L.check('Pirate AI Core 1.0.0 загружен и подключён к каждому кораблю эскадрильи',
    coreBridge.version === '1.0.0' && coreBridge.ships.length === 2 &&
    coreBridge.ships.every(e => e.enabled && e.entity && e.nav === 'VELOCITY' && e.target === 'player'),
    coreBridge);

  await page.waitForFunction(() => pirateAssetsReady === true, null, { timeout: 60000 });
  const pirateModels = await page.evaluate(() => {
    const fighter = mkPirate(2);
    const transport = mkPirateTransport();
    let fighterMeshes = 0, transportMeshes = 0;
    fighter.traverse(o => { if (o.isMesh) fighterMeshes++; });
    transport?.traverse(o => { if (o.isMesh) transportMeshes++; });
    return { fighterMeshes, transportMeshes, transportFlag: !!transport?.userData.pirateTransport };
  });
  L.check('Pirate3 GLB создаёт дополнительный боевой архетип', pirateModels.fighterMeshes > 0, pirateModels);
  L.check('Pirate4 GLB создаёт отдельный пиратский транспорт', pirateModels.transportMeshes > 0 && pirateModels.transportFlag, pirateModels);
  const socketInventory = await page.evaluate(() => {
    const inspect = (id, g, ty) => {
      if (!g) return { id, missing:true, guns:0, engines:0, flames:0, plasmaTrailCount:0 };
      const sockets = pirateFleetResolveSockets(g, ty);
      S.add(g); g.updateMatrixWorld(true);
      const center = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
      const forward = new THREE.Vector3(0,0,-1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const fx = { g, ty, engineNodes:sockets.engines, flames:[], engineTrailT:0, warp:0, hp:1, mx:1, sp2:42 };
      pirateFleetAttachFX(fx);
      const before = trs.length;
      pirateEngineTrailUpdate(fx,.5,.4);
      const emitted = trs.length-before;
      trs.slice(before).forEach(t=>S.remove(t.m)); trs.splice(before);
      const nodeNames=[];
      if(id!=="pirate-transport"){g.updateMatrixWorld(true);g.traverse(o=>{if(o.name){const entry={name:o.name,type:o.type,mesh:!!o.isMesh,position:o.position.toArray().map(v=>Math.round(v*1000)/1000)};if(o.isMesh){const box=new THREE.Box3().setFromObject(o),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());g.worldToLocal(center);entry.boundsCenter=center.toArray().map(v=>Math.round(v*1000)/1000);entry.boundsSize=size.toArray().map(v=>Math.round(v*1000)/1000)}nodeNames.push(entry)}})}
      const result = {
        id, assetLoadedGLB:!!(g.userData&&g.userData.starfallLoadedGLB), nodeNames,
        guns:sockets.guns.length, engines:sockets.engines.length,
        gunSource:sockets.manifest.guns.source, engineSource:sockets.manifest.engines.source,
        gunForward:sockets.guns.every(n=>n.getWorldDirection(new THREE.Vector3()).dot(forward)>.98),
        gunsAhead:sockets.guns.every(n=>n.getWorldPosition(new THREE.Vector3()).sub(center).dot(forward)>0),
        enginesBehind:sockets.engines.every(n=>n.getWorldPosition(new THREE.Vector3()).sub(center).dot(forward)<0),
        flames:fx.flames.length, flamesAtEngines:fx.flames.every((f,i)=>f.parent===sockets.engines[i]),
        flameCores:fx.flameCores.length, coresAtEngines:fx.flameCores.every((f,i)=>f.parent===sockets.engines[i]),
        manifest:sockets.manifest, plasmaTrailCount:emitted
      };
      fx.flames.forEach(f=>f.parent?.remove(f)); S.remove(g);
      return result;
    };
    return [
      inspect('rust-skull',MC.p0?MC.p0.clone(true):mkPirate(0),0),
      inspect('jackal',mkPirate(1),1),
      inspect('tie-raider',mkPirate(2),2),
      inspect('pirate-transport',mkPirateTransport(),3)
    ];
  });
  console.log("STARFALL_PIRATE_SOCKET_MANIFEST "+JSON.stringify(socketInventory.map(x=>({id:x.id,manifest:x.manifest}))));
  console.log("STARFALL_PIRATE_GLBNODES "+JSON.stringify(socketInventory[0].nodeNames));
  L.check('«Ржавый череп» без экспортированных маркеров получает четыре передних и два задних runtime-сокета по габаритам GLB',
    socketInventory[0].assetLoadedGLB&&socketInventory[0].guns===4&&socketInventory[0].engines===2&&socketInventory[0].gunSource==='RUNTIME'&&socketInventory[0].engineSource==='RUNTIME'&&socketInventory[0].gunsAhead&&socketInventory[0].enginesBehind,
    socketInventory[0]);
  L.check('у всех четырёх пиратских кораблей есть ориентированные оружейные и двигательные сокеты',
    socketInventory.every(x=>x.guns>=2&&x.engines>=2&&x.gunForward&&x.gunsAhead&&x.enginesBehind),
    socketInventory);
  L.check('каждый двигатель получает видимое пламя и отдельный плазменный след',
    socketInventory.every(x=>x.flames===x.engines&&x.flamesAtEngines&&x.flameCores===x.engines&&x.coresAtEngines&&x.plasmaTrailCount===x.engines),
    socketInventory);



  const livery = await page.evaluate(() => {
    const models = [0, 1, 2, 3].map(i => mkPirate(i)).concat([mkBoss()]);
    return models.map((g, i) => {let total=0,white=0;g.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if(m?.isMeshStandardMaterial){total++;if(m.map===window.pirateLiveryTex&&m.color.getHex()===0xffffff)white++}})});return{type:i,total,white}});
  });
  L.check('все четыре типа пиратов и флагман используют белую панельную ливрею', livery.every(x=>x.total>0&&x.white>0), livery);
  const laser=await page.evaluate(()=>{const a=[];shootLaser(a,new THREE.Vector3(),new THREE.Vector3(0,0,-420),0x44eeff,10,1);const b=a[0],forward=new THREE.Vector3(0,0,1).applyQuaternion(b.m.quaternion),parts=b.m.children.filter(o=>o.isMesh),out={isGroup:b.m.isGroup,length:b.m.userData.laser.length,forwardDot:forward.dot(new THREE.Vector3(0,0,-1)),layers:parts.length,flare:b.m.children.some(o=>o.isSprite)};S.remove(b.m);a.length=0;return out});
  L.check('лазер — короткий многослойный энергетический импульс с белым ядром, цветным ореолом и вспышкой',laser.isGroup&&laser.length>=12&&laser.length<=22&&laser.forwardDot>.999&&laser.layers===3&&laser.flare,laser);
  const boost=await page.evaluate(()=>{const old={ine,fuel,thr,key:keys.ShiftLeft};ine=0;fuel=0;thr=0;keys.ShiftLeft=true;upd(.1);const arcade={thr,fuel};keys.ShiftLeft=false;ine=1;fuel=0;thr=0;keys.ShiftLeft=true;upd(.1);const balanced={thr,fuel};ine=old.ine;fuel=old.fuel;thr=old.thr;keys.ShiftLeft=old.key;return{arcade,balanced}});
  L.check('форсаж бесконечный только в режиме АРКАДА',boost.arcade.thr>.1&&boost.arcade.fuel===100&&boost.balanced.thr===0&&boost.balanced.fuel===0,boost);
  const regularDamage=await page.evaluate(()=>{const saved={E,E2},g=mkPirate(2),max=Math.max(200,SHIPS[shp].hull*2),e={g,ty:2,boss:false,hp:max,mx:max,vel:new THREE.Vector3(),hits:0};S.add(g);E=e;E2=null;hurtEn(e,20,false);const first={hp:e.hp,alive:e.g.parent===S,burning:!!e.fireFx,smoking:!!e.smoke};hurtEn(e,20,false);const second={hp:e.hp,alive:e.g.parent===S};S.remove(g);pirateDamageFxClear(e);E=saved.E;E2=saved.E2;return{first,second,minimum:max>=SHIPS[shp].hull*2}});
  L.check('обычный пират переживает первое попадание, загорается и принимает повторный урон',regularDamage.first.hp>0&&regularDamage.first.alive&&regularDamage.first.burning&&regularDamage.first.smoking&&regularDamage.second.hp<regularDamage.first.hp&&regularDamage.second.alive&&regularDamage.minimum,regularDamage);
  const fleetFirstHit=await page.evaluate(()=>{const e=pirateFleet[0];e.hp=e.mx;e.hits=0;pirateFleetDamage(e,20,false);return{hp:e.hp,mx:e.mx,alive:!!e.g,burning:!!e.fireFx,smoking:!!e.smoke,minimum:e.mx>=160}});
  L.check('пират эскадрильи после первого попадания горит, дымит и остаётся жив',fleetFirstHit.hp>0&&fleetFirstHit.alive&&fleetFirstHit.burning&&fleetFirstHit.smoking&&fleetFirstHit.minimum,fleetFirstHit);

  const movementProfile = spawnSnapshot.map(e => ({ty:e.type,speed:e.speed}));
  L.check('стартовая пара использует один seeded-архетип и его скоростной профиль',movementProfile.length===2&&movementProfile[0].ty===movementProfile[1].ty&&movementProfile.every(x=>x.ty>=0&&x.ty<=2&&x.speed>=[46,34.5,46][x.ty]*.85&&x.speed<=[46,34.5,46][x.ty]+.01),movementProfile);

  const composition = await page.evaluate(() => ({
    total: pirateFleet.length,
    types: [...new Set(pirateFleet.map(e=>e.ty))].map(ty=>pirateFleet.filter(e=>e.ty===ty).length),
    spawned: pirateFleet.filter(e => !!e.g).length
  }));
  L.check('стартовая атака содержит два корабля одного seeded-архетипа', composition.total === 2 && composition.types.length===1 && composition.types[0]===2, composition);
  L.check('оба корабля стартовой атаки созданы', composition.spawned === 2, composition);
  const initialSpawn = spawnSnapshot;
  L.check('стартовая эскадрилья появляется впереди игрока на заданной дистанции', initialSpawn.length===2&&initialSpawn.every(x=>x.distance>=1090&&x.distance<=1220&&x.ahead>.98)&&initialSpawn[0].lateral*initialSpawn[1].lateral<0, initialSpawn);
  const fleetHealth = await page.evaluate(() => pirateFleet.every(e => e.mx >= 160));
  L.check('прочность каждого корабля эскадрильи не ниже двойной прочности игрока', fleetHealth, fleetHealth);
  const locators = await page.evaluate(() => pirateFleet.map(e => {
    e.g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(e.g), center = box.getCenter(new THREE.Vector3());
    const forward = new THREE.Vector3(0,0,-1).applyQuaternion(e.g.quaternion);
    const guns = e.muzzleNodes.map(n => n.getWorldPosition(new THREE.Vector3()));
    return {ty:e.ty,count:guns.length,allForward:guns.every(p=>p.clone().sub(e.g.position).dot(forward)>0),frontOfCenter:guns.every(p=>p.clone().sub(center).dot(forward)>0),facingForward:e.muzzleNodes.every(n=>n.getWorldDirection(new THREE.Vector3()).dot(forward)>.98)};
  }));
  L.check('каждый корабль имеет передние оружейные сокеты, направленные по оси стволов',locators.every(x=>x.count>=2&&x.allForward&&x.frontOfCenter&&x.facingForward),locators);

  const combat = await page.evaluate(() => {
    pirateFleet.forEach((e, i) => {
      e.warp = 0; e.g.visible = true;
      e.g.position.copy(P).add(new THREE.Vector3((i - .5) * 12, 0, -350));
      e.hd.copy(P.clone().sub(e.g.position).normalize());
      e.vel.copy(e.hd).multiplyScalar(46);
      e.g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),e.hd);
      e.state = 'ATTACK'; e.aiIntent='ATTACK'; e.ph='ATTACK'; e.phT=0; e.brk=null; e.aimS=null; e.jinkT=.5; e.jinkCd=1; e.jinkSide=1; e.stateT = 0; e.fire = 0; e.burst = 0; e.burstGap = 0; e.aiClock = EAI.STEP; e.aiTicks = 0;
      e.sfAiElapsed = .25; e.sfAiFrame = null; e.sfAiFire = false;
    });
    const before = eb.length;
    const randomAI = EAI.rand; EAI.rand = () => 0;
    try { pirateFleetUpdate(.05); } finally { EAI.rand = randomAI; }
    const first = pirateFleet[0];
    const jinkFiring = first.ph==="ATTACK" && first.state==="ATTACK" && first.jinkT>0;
    const shots = eb.slice(before).filter(b => b.pirateFleetSlot === first.slot);
    const gunPositions = first.muzzleNodes.map(n => n.getWorldPosition(new THREE.Vector3()));
    const muzzleMatch = shots.length === gunPositions.length && shots.every((b, i) => b.m.position.distanceTo(gunPositions[i]) < .001);
    const lineShots = shots.every(b => b.m.isGroup && b.m.children.filter(o => o.isMesh).length === 3 && b.m.children.some(o => o.isSprite));
    const shotForward = shots.length === gunPositions.length && shots.every((b, i) => b.v.clone().normalize().dot(first.muzzleNodes[i].getWorldDirection(new THREE.Vector3())) > .98);
    const socketsForward = gunPositions.length >= 2 && gunPositions.every(p => p.clone().sub(first.g.position).dot(new THREE.Vector3(0,0,-1).applyQuaternion(first.g.quaternion)) > 0);
    const allPilotShots = pirateFleet.map(e => {
      const own = eb.slice(before).filter(b => b.pirateFleetSlot === e.slot);
      const muzzles = e.muzzleNodes.length
        ? e.muzzleNodes.map(n => n.getWorldPosition(new THREE.Vector3()))
        : [e.g.localToWorld(new THREE.Vector3(0,-.25,-3.8))];
      return { slot: e.slot, shots: own.length, guns: muzzles.length, originsMatch: own.length === muzzles.length && own.every((b, i) => b.m.position.distanceTo(muzzles[i]) < .001) };
    });
    const noseAlignment = pirateFleet.map(e => new THREE.Vector3(0,0,-1).applyQuaternion(e.g.quaternion).dot(e.vel.clone().normalize()));
    return { before, after: eb.length, delta: eb.length - before, noseAlignment, firstShipShots: shots.length, muzzleMatch, shotForward, socketsForward, lineShots, allPilotShots, jinkFiring,
      aiState:first.sfAiFrame?.tacticalState||null, aiFire:first.sfAiFire, weaponIntents:first.sfAiFrame?.weapons||[], aiError:first.sfAiErrorLogged||false };
  });
  L.check('оба пилота участвуют в бою на ближней дистанции', combat.delta >= 2, combat);
  L.check('jink не отключает огонь, если корабль остаётся в ATTACK и цель в конусе',combat.jinkFiring&&combat.firstShipShots>=2,combat);
  L.check('фактический нос каждой модели совпадает с направлением движения', combat.noseAlignment.every(x => x > .98), combat.noseAlignment);
  L.check('каждый маркер оружия создаёт отдельный лазер из своей дульной точки', combat.firstShipShots >= 2 && combat.muzzleMatch && combat.shotForward && combat.socketsForward && combat.lineShots, combat);
  L.check('каждый пират стреляет из всех собственных передних сокетов', combat.allPilotShots.every(x => x.shots === x.guns && x.shots >= 2 && x.originsMatch), combat.allPilotShots);

  const eliteFlight = await page.evaluate(() => {
    const e=pirateFleet[0];
    pirateFleet.forEach((p,i)=>{
      p.warp=0;p.g.visible=true;p.aiClock=0;p.aiTicks=0;p.aiIntent="ATTACK";p.aiSideSign=i%2?1:-1;
      p.g.position.copy(P).add(new THREE.Vector3((i-.5)*10,0,-620));
      p.hd.set(0,0,1);p.g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),p.hd);p.vel.set(0,0,46);p.speed=46;p.aimS=null;p.state="ATTACK";p.ph="ATTACK";p.phT=0;p.brk=null;p.fire=99;p.burst=0;p.burstGap=0;
      p.sfAiElapsed=.25;p.sfAiFrame=null;p.sfAiFire=false;
    });
    let minDistance=Infinity,maxDistance=0;const states=new Set();let previousHeading=pirateFleet[0].hd.clone(),maxHeadingStep=0;
    let maxLongRangeApproachSpeed=0,longRangeApproachSamples=0;
    let incoming=null,incomingUntil=-1;
    for(let i=0;i<1800;i++){
      const pilot=pirateFleet[0],distanceToPlayer=pilot.g.position.distanceTo(P);
      if(!incoming&&distanceToPlayer<300){
        incoming={m:{position:pilot.g.position.clone().add(new THREE.Vector3(0,0,40))},v:new THREE.Vector3(0,0,-100)};
        bul.push(incoming);incomingUntil=i+90;
      }
      if(incoming&&i>=incomingUntil){const index=bul.indexOf(incoming);if(index>=0)bul.splice(index,1);incoming=null;}
      pirateFleetUpdate(1/60);
      const p=pirateFleet[0],d=p.g.position.distanceTo(P);minDistance=Math.min(minDistance,d);maxDistance=Math.max(maxDistance,d);states.add(p.state);
      if(p.sfAiFrame?.tacticalState==="APPROACH"&&d>500){
        const v=p.sfAiFrame.navigation?.desiredVelocity;
        if(v){const speed=Math.hypot(v.x,v.y,v.z);if(Number.isFinite(speed)){maxLongRangeApproachSpeed=Math.max(maxLongRangeApproachSpeed,speed);longRangeApproachSamples++;}}
      }
      const angle=previousHeading.angleTo(p.hd);maxHeadingStep=Math.max(maxHeadingStep,angle);previousHeading.copy(p.hd);
    }
    const p=pirateFleet[0],frame=p.sfAiFrame,dv=frame?.navigation?.desiredVelocity||null;
    return{minDistance,maxDistance,states:[...states],maxHeadingStep,ticks:p.aiTicks,legacy:pirateFleet.some(p=>["ATTACK_RUN","FIRING_PASS","OVERSHOOT","REPOSITION","LOOP","BREAK"].includes(p.state)),
      finalDistance:p.g.position.distanceTo(P),finalVelocity:p.vel.toArray(),heading:p.hd.toArray(),modelForward:new THREE.Vector3(0,0,-1).applyQuaternion(p.g.quaternion).toArray(),
      desiredVelocity:dv,desiredSpeed:dv?Math.hypot(dv.x,dv.y,dv.z):null,tacticalState:frame?.tacticalState||null,maneuver:frame?.navigation?.maneuver||null,
      maxLongRangeApproachSpeed,longRangeApproachSamples,
      ocs:{yaw:p.ocsYaw,pitch:p.ocsPitch,accel:p.ocsAccel,targetSpeed:p.ocsTargetSpeed},sfAiEnabled:p.sfAiEnabled,sfAiFire:p.sfAiFire,aiError:p.sfAiErrorLogged||false};
  });
  L.check('Elite flight: tactical behavior uses only ATTACK/EVADE intents, without scripted waypoints',eliteFlight.states.every(s=>s==="ATTACK"||s==="EVADE")&&!eliteFlight.legacy,eliteFlight);
  L.check('Elite flight: approach speed is derived from actual target distance, not a near-zero intercept distance',
    eliteFlight.maxLongRangeApproachSpeed>15&&eliteFlight.longRangeApproachSamples>0,eliteFlight);
  L.check('Elite flight: close-range reaction switches to evasion and later re-engages',eliteFlight.states.includes("EVADE")&&eliteFlight.states.includes("ATTACK"),eliteFlight);
  L.check('Elite flight: OCS heading changes continuously, not by snapping to target',eliteFlight.maxHeadingStep<.12&&eliteFlight.ticks>=400,eliteFlight);

  const phaseAI = await page.evaluate(() => {
    const random = EAI.rand; EAI.rand = () => 0;
    try {
      const e = { ty:0, hd:new THREE.Vector3(0,0,1), ph:"ATTACK", phT:0, jinkT:0, jinkCd:0, flank:-1 };
      pirateFleetPhase(e,new THREE.Vector3(0,0,100),100,false,true,1/60);
      const breakStarted = e.ph==="BREAK" && e.brk && e.brk.length()>.99;
      let breakElapsed=0;
      while(e.ph==="BREAK"&&breakElapsed<2){pirateFleetPhase(e,new THREE.Vector3(0,0,100),100,false,true,.05);breakElapsed+=.05}
      const enteredReset=e.ph==="RESET";
      let resetElapsed=0;
      while(e.ph==="RESET"&&resetElapsed<1.2){pirateFleetPhase(e,new THREE.Vector3(0,0,500),500,false,true,.05);resetElapsed+=.05}
      const reengaged=e.ph==="ATTACK";
      const jinkAim=pirateFleetPhase(e,new THREE.Vector3(0,0,500),500,true,true,.05);
      return {breakStarted,breakElapsed,enteredReset,reengaged,jink:e.jinkT>0&&e.state==="ATTACK"&&jinkAim.length()>.99};
    } finally { EAI.rand=random; }
  });
  L.check('pirateFleet: BREAK длится заданное время, затем следует RESET и новый ATTACK',
    phaseAI.breakStarted&&phaseAI.enteredReset&&phaseAI.breakElapsed>=1.55&&phaseAI.breakElapsed<=1.75&&phaseAI.reengaged,phaseAI);
  L.check('pirateFleet: jink уклоняет курс, не выключая состояние ATTACK',
    phaseAI.jink,phaseAI);

  const eliteAI = await page.evaluate(() => {
    const fwd = EAI.project(new THREE.Vector3(0,0,-1), new THREE.Vector3(0,0,-1));
    const right = EAI.project(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,-1));
    const up = EAI.project(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,-1));
    EAI.seed(0x12345678); const seqA = [EAI.rand(),EAI.rand(),EAI.rand(),EAI.rand()];
    EAI.seed(0x12345678); const seqB = [EAI.rand(),EAI.rand(),EAI.rand(),EAI.rand()];
    const e = { aiClock: 0 }; let ticks = 0;
    for (let i=0;i<60;i++) if (EAI.think(e,1/60)) ticks++;
    const low = EAI.fireChance({forward:.65},300,420);
    const high = EAI.fireChance({forward:.98},180,420);
    return { fwd, right, up, deterministic: seqA.every((v,i)=>v===seqB[i]), ticks, low, high };
  });
  L.check('Elite AI: локальные проекции OCS корректны', eliteAI.fwd.forward > .999 && eliteAI.right.x > .999 && eliteAI.up.y > .999, eliteAI);
  L.check('Elite AI: детерминированный PRNG воспроизводит поток', eliteAI.deterministic, eliteAI);
  L.check('Elite AI: решения принимаются 15 раз/с, а не каждый кадр', eliteAI.ticks === 15, eliteAI);
  L.check('Elite AI: шанс огня растёт при лучшем наведении и меньшей дистанции', eliteAI.high > eliteAI.low, eliteAI);
  const eliteController = await page.evaluate(() => {
    const forward = new THREE.Vector3(0,0,-1);
    const p = EAI.projectOCS(forward, forward);
    const e = { hd:forward.clone(), vel:forward.clone().multiplyScalar(10), speed:10 };
    EAI.command(e, forward, 500, { speed:46, acceleration:60, turnRate:1.8 });
    const command = { yaw:e.ocsYaw, pitch:e.ocsPitch, accel:e.ocsAccel, targetSpeed:e.ocsTargetSpeed };
    const object = { position:new THREE.Vector3() };
    EAI.integrate(e, 1/60, object);
    const moved = object.position.length();
    const originalRand = EAI.rand; let fireGate, outOfRangeGate, xorRejected, marauderRangeGate, marauderLimitGate;
    EAI.rand = () => 0;
    try {
      fireGate = EAI.fireGate(p, 200, 420, 1, true);
      outOfRangeGate = EAI.fireGate(p, 500, 420, 1, true);
      marauderRangeGate = EAI.fireGate(p, 519, 520, 1, true);
      marauderLimitGate = EAI.fireGate(p, 520, 520, 1, true);
      xorRejected = EAI.fireGate({h:-.3,l:0,d:-.5}, 200, 420, 1, true);
    } finally { EAI.rand = originalRand; }
    const a={aiClock:0},b={aiClock:EAI.STEP/2},ticksA=[],ticksB=[];
    for(let i=0;i<8;i++){if(EAI.think(a,1/60))ticksA.push(i);if(EAI.think(b,1/60))ticksB.push(i)}
    return { p, command, moved, fireGate, outOfRangeGate, marauderRangeGate, marauderLimitGate, xorRejected, ticksA, ticksB };
  });
  L.check('Elite OCS: три проекции имеют half-scale и инвертированный знак', Math.abs(eliteController.p.d + .5) < .001 && Math.abs(eliteController.p.h) < .001 && Math.abs(eliteController.p.l) < .001, eliteController);
  L.check('Elite OCS: поворот и ускорение задаются дискретными командами', Number.isInteger(eliteController.command.yaw) && Number.isInteger(eliteController.command.pitch) && Math.abs(eliteController.command.yaw)<=15 && Math.abs(eliteController.command.pitch)<=15 && eliteController.command.accel===2, eliteController);
  L.check('Elite OCS: положение интегрируется между AI-тактами', eliteController.moved > 0, eliteController);
  L.check('Elite fire: sign-XOR, projection gates, range and PRNG allow a valid forward shot', eliteController.fireGate, eliteController);
  L.check('Elite fire: range and XOR gates reject invalid shots', !eliteController.outOfRangeGate && !eliteController.xorRejected, eliteController);
  L.check('Elite fire: per-ship range permits Marauder shots below 520 and rejects the exact limit', eliteController.marauderRangeGate && !eliteController.marauderLimitGate, eliteController);
  L.check('Elite AI: phase offsets stagger decision ticks between object slots', eliteController.ticksA[0] !== eliteController.ticksB[0], eliteController);

  const aiIntegration = await page.evaluate(() => {
    const e = pirateFleet[0];
    pirateFleet.forEach((p,i) => {
      p.warp = 0; p.g.visible = true; p.aiClock = 0; p.aiTicks = 0;
      p.fire = 99; p.burst = 0; p.burstGap = 0; p.state = 'APPROACH'; p.stateT = 0;
      p.g.position.copy(P).add(new THREE.Vector3((i-.5)*80,0,-780));
      p.hd.copy(P.clone().sub(p.g.position).normalize());
      p.vel.copy(p.hd).multiplyScalar(34.5); p.speed = p.vel.length();
    });
    const before = e.g.position.clone();
    for(let i=0;i<60;i++) pirateFleetUpdate(1/60);
    return { ticks:e.aiTicks, movement:before.distanceTo(e.g.position) };
  });
  L.check('Elite AI: движение интегрируется каждый кадр между решениями', aiIntegration.ticks === 15 && aiIntegration.movement > 10, aiIntegration);

  const damage = await page.evaluate(() => {
    const e = pirateFleet[0], type = e.ty;
    pirateFleetDamage(e, 100000, false);
    const destroyed = !e.g && e.dead && e.respawn === Infinity;
    pirateFleetUpdate(.05);
    return { destroyed, respawned: !!e.g, sameType: e.ty === type, slots: pirateFleet.length };
  });
  L.check('уничтоженный корабль не возрождается, слот и состав не пересоздаются', damage.destroyed && !damage.respawned && damage.sameType && damage.slots === 2, damage);

  const textureReuse = await page.evaluate(() => {
    for (const e of pirateFleet.filter(x => x.g && x.hp > 0)) {
      pirateFleetDamage(e, e.mx * .2, false);
      pirateFleetDamage(e, e.mx * .2, false);
    }
    const shared = pirateFleet.filter(e => e.g && e.hp > 0).every(e =>
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
  L.check('все активные пилоты используют общие текстуры двигателя, дыма и огня', textureReuse.shared, textureReuse);

  const docked = await page.evaluate(() => {
    dock();
    return { state, slots: pirateFleet.length, ready: pirateFleetReady, taggedShots: eb.filter(b => b.pirateFleet).length };
  });
  L.check('стыковка очищает флот и его снаряды', docked.state === 'dock' && docked.slots === 0 && !docked.ready && docked.taggedShots === 0, docked);
  await page.evaluate(() => { lift(); QL.setMode('low'); pirateFleetInit(); state='pause'; });
  await page.waitForFunction(() => pirateFleet.length === 2 && pirateFleet.every(e=>!!e.g), null, { timeout: 15000 });
  const relaunched = await page.evaluate(() => pirateFleet.length === 2 && pirateFleet[0].ty===pirateFleet[1].ty && pirateFleet.every(e=>!!e.g&&e.hp>0));
  const qualityPromotion = await page.evaluate(() => {
    state='play';QL.setMode('high');pirateFleetInit();state='pause';
    return {count:pirateFleet.length,types:pirateFleet.map(e=>e.ty),alive:pirateFleet.every(e=>!!e.g&&e.hp>0)};
  });
  L.check('переключение LOW → HIGH до начала боя восстанавливает три разных архетипа',
    relaunched&&qualityPromotion.count===3&&qualityPromotion.types.join(',')==='0,1,2'&&qualityPromotion.alive,
    {relaunched,qualityPromotion});
  await page.evaluate(() => { state='play'; });

  const jackalAggro = await page.evaluate(() => {
    const old = { E, E2, firstWaveSpawn, random: Math.random, neutrals: nv.slice() };
    const neutralGroup = new THREE.Group();
    neutralGroup.position.copy(P).add(new THREE.Vector3(0,0,-120));
    const neutral = { g: neutralGroup, v: new THREE.Vector3(), hp: 100, cr: 12 };
    try {
      nv.length = 0; nv.push(neutral); E = null; E2 = null; firstWaveSpawn = 0;
      Math.random = () => .1;
      spawnE(); spawnE();
      const jackal = E2;
      const targetNeutral = jackal.tn === neutral;
      nv.length = 0; // Keep the synthetic neutral out of collision/update systems; this test targets spawn selection only.
      const forward = new THREE.Vector3(0,0,-1).applyQuaternion(Q).normalize();
      for (const e of [E, E2]) {
        e.warp = 0; e.g.visible = true;
        e.g.position.copy(P).addScaledVector(forward, 300);
        e.hd.copy(forward).negate(); e.vel.copy(e.hd).multiplyScalar(24);
        e.aiIntent = "ATTACK"; e.aiClock = EAI.STEP; e.aiTicks = 0;
        e.fire = 0; e.burstLeft = 0; e.burstGap = 0;
      }
      const before = eb.length, oldRand = EAI.rand;
      EAI.rand = () => 0;
      try { upd(.05); } finally { EAI.rand = oldRand; }
      return { type: jackal.ty, targetNeutral, targetPlayer: jackal.tn === null,
        state: jackal.state, shots: eb.length - before, burstLeft: jackal.burstLeft };
    } finally {
      for (const e of [E, E2]) if (e && e.g) S.remove(e.g);
      E = old.E; E2 = old.E2; firstWaveSpawn = old.firstWaveSpawn;
      Math.random = old.random; nv.length = 0; nv.push(...old.neutrals);
    }
  });
  L.check('Шакал не отвлекается на нейтральный транспорт и выбирает игрока целью',
    jackalAggro.type === 1 && !jackalAggro.targetNeutral && jackalAggro.targetPlayer, jackalAggro);
  L.check('Шакал открывает огонь по игроку при устойчивом наведении на 300 м',
    jackalAggro.state === 'ATTACK' && jackalAggro.shots >= 2 && jackalAggro.burstLeft < 3, jackalAggro);

  const respawnCycle = await page.evaluate(() => {
    const initialTimer = pirateFleetWaveTimer;
    const count = pirateFleet.length;
    pirateFleet.forEach(e => pirateFleetDamage(e, e.hp, false));
    const empty = pirateFleet.every(e => !e.g);
    pirateFleetUpdate(3.49);
    const respawnedEarly = pirateFleet.some(e => !!e.g);
    const remaining = pirateFleetWaveTimer;
    pirateFleetUpdate(.02);
    const respawned = pirateFleet.every(e => !!e.g && !e.dead);
    return { initialTimer, count, empty, respawnedEarly, remaining, respawned };
  });
  L.check('эскадрилья выдерживает полные 3.5 секунды перед первым групповым респавном',
    respawnCycle.initialTimer >= 3.5 && [2,3].includes(respawnCycle.count) && respawnCycle.empty &&
    !respawnCycle.respawnedEarly && respawnCycle.remaining > 0 && respawnCycle.respawned, respawnCycle);

  // Convoy lifecycle is covered by the dedicated t24_pirate_ecosystems.js suite.
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
