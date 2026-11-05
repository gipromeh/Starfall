const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 960, height: 540 }, dpr: 1 });
  const page = await L.openGame(ctx);
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.waitForFunction(() => pirateAssetsReady && cargoTransportReady && MC.cargoTransport && SF_ASTEROIDS.status().ready, null, { timeout: 60000 });
  await page.evaluate(() => lift());
  await page.waitForFunction(() => state === 'play' && pirateFleet.length === 3 && roamingPirates.length >= 2, null, { timeout: 30000 });
  await page.waitForFunction(() => pirateConvoyReady && pirateConvoys.length === 3, null, { timeout: 30000 });
  const result = await page.evaluate(() => ({
    opening: pirateFleet.map(e => ({ type:e.ty, visible:!!e.g?.visible, hp:e.hp })),
    roamers: roamingPirates.map(e => ({ type:e.ty, state:e.state, alive:!!e.g && e.hp>0 })),
    convoys: pirateConvoys.map(c => ({
      cargo:!!c.cargo?.g?.userData?.cargoTransport,
      escorts:c.escorts.length,
      types:[...new Set(c.escorts.map(e=>e.ty))],
      route:c.planets.length>=2
    })),
    radarRoamers:collectRadarContacts().filter(c=>String(c.label||'').startsWith('R')).length,
    asteroids:SF_ASTEROIDS.status(),
    fakeCargo:nv.some(n=>n.cargoShowcase)
  }));
  L.check('стартовая атака — ровно три разных истребителя', result.opening.length===3 && result.opening.map(x=>x.type).sort().join(',')==='0,1,2', result.opening);
  L.check('стартовые истребители проявляются и боеспособны', result.opening.every(x=>x.visible && x.hp>0), result.opening);
  L.check('вольные пираты существуют отдельно и патрулируют', result.roamers.length>=2 && result.roamers.every(x=>x.alive && ['PATROL','ATTACK','EVADE'].includes(x.state)), result.roamers);
  L.check('одновременно существуют три независимых каравана', result.convoys.length===3, result.convoys);
  L.check('каждый караван содержит Cargo GLB и 3–4 истребителя', result.convoys.every(c=>c.cargo && [3,4].includes(c.escorts) && c.route), result.convoys);
  L.check('каждый эскорт содержит три разных класса', result.convoys.every(c=>c.types.length>=3), result.convoys);
  L.check('вольные пираты отображаются на радаре', result.radarRoamers>=2, result.radarRoamers);
  L.check('игровое поле и кольца используют asteroid.glb', result.asteroids.ready && result.asteroids.mineable===180 && result.asteroids.rings>=1, result.asteroids);
  L.check('искусственный Cargo Showcase удалён', !result.fakeCargo, result.fakeCargo);
  L.check('ошибок выполнения страницы нет', page.errors.length===0, page.errors);
  process.exitCode=L.summary();
  await browser.close();
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
