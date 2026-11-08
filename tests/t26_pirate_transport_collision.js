const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 960, height: 540 }, dpr: 1 });
  const page = await L.openGame(ctx);
  page.on('pageerror', err => console.error('PAGE ERROR:', err.stack || err.message));
  await page.click('#play', { noWaitAfter: true });
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.waitForFunction(() => pirateAssetsReady && cargoTransportReady && MC.pirateTransport, null, { timeout: 60000 });
  await page.evaluate(() => lift());
  await page.waitForFunction(() => state === 'play' && pirateConvoyReady, null, { timeout: 30000 });

  const result = await page.evaluate(() => {
    const cargo=pirateConvoys.find(c=>c.cargo&&c.cargo.g)?.cargo;
    if(!cargo)return {cargo:false};
    const old=cargo.g.position.clone(),oldPlayer=P.clone(),oldPrev=PPv.clone(),oldPos=pirateConvoys[0].p.clone();
    const far=P.clone().add(new T.Vector3(50000,50000,50000));
    cargo.g.position.copy(far);cargo.g.updateMatrixWorld(true);
    const center=cargo.g.localToWorld(cargo.hitCenter.clone());
    const radius=cargo.hitRadius+4.5*SHIPS[shp].sc;
    const dirs=[new T.Vector3(1,0,0),new T.Vector3(-1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,-1,0),new T.Vector3(0,0,1),new T.Vector3(0,0,-1)];
    const hits=dirs.map(d=>{const p=center.clone().addScaledVector(d,radius*.92);const h=hitTest(p,4.5*SHIPS[shp].sc);return !!h&&h.kind==='pirateConvoy'&&h.o===cargo});
    cargo.g.position.copy(old);cargo.g.updateMatrixWorld(true);pirateConvoys[0].p.copy(oldPos);P.copy(oldPlayer);PPv.copy(oldPrev);

    const oldRandom=Math.random;let traffic=null,trafficSpeed=0,trafficHits=[],npcSeparation=0;
    try{Math.random=()=>.7;spawnNv();traffic=nv[nv.length-1];trafficSpeed=traffic?.v?.length()||0;}finally{Math.random=oldRandom}
    if(traffic&&traffic.g){
      const p0=traffic.g.position.clone();traffic.g.position.copy(far);traffic.g.updateMatrixWorld(true);
      traffic._sfCollisionBounds=pirateHitBounds(traffic.g);
      const c0=traffic.g.localToWorld(traffic._sfCollisionBounds.hitCenter.clone()),r0=traffic._sfCollisionBounds.hitRadius+4.5*SHIPS[shp].sc;
      trafficHits=dirs.map(d=>{const h=hitTest(c0.clone().addScaledVector(d,r0*.92),4.5*SHIPS[shp].sc);return !!h&&h.kind==='nv'&&h.o===traffic});
      traffic.g.position.copy(p0);traffic.g.updateMatrixWorld(true);
      const escort=pirateConvoys[0].escorts.find(e=>e.g&&!e.dead);
      if(escort){
        const ep=escort.g.position.clone(),tp=traffic.g.position.clone();
        escort.g.position.copy(far);traffic.g.position.copy(far);
        resolvePirateShipCollisions();
        npcSeparation=escort.g.position.distanceTo(traffic.g.position);
        escort.g.position.copy(ep);traffic.g.position.copy(tp);
      }
      removeNvAt(nv.indexOf(traffic));
    }
    return {cargo:true,hits,cruise:PC_CRUISE,initial:PC_CRUISE*.6,trafficTransport:!!traffic?.g?.userData?.pirateTransport,trafficSpeed,trafficHits,npcSeparation};
  });
  L.check('пиратский конвой имеет жёсткую границу корпуса с шести направлений',
    result.cargo && result.hits.length===6 && result.hits.every(Boolean), result);
  L.check('пиратский транспорт обычного трафика ускорен и имеет границу корпуса',
    result.trafficTransport && result.trafficSpeed>=58 && result.trafficSpeed<=74 &&
    result.trafficHits.length===6 && result.trafficHits.every(Boolean), result);
  L.check('крейсерская скорость маршрутного пиратского конвоя повышена до 100 ед/с',
    result.cruise===100 && result.initial===60, result);
  L.check('столкновения транспортника с NPC устраняют взаимное проникновение',
    Number.isFinite(result.npcSeparation) && result.npcSeparation>10, result.npcSeparation);
  L.check('ошибок выполнения страницы нет', page.errors.length===0, page.errors);
  process.exitCode=L.summary();await browser.close();
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
