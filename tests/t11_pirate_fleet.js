const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 800, height: 450 }, dpr: 1 });
  const page = await L.openGame(ctx);
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.evaluate(() => { lift(); QL.setMode('low'); pirateFleetInit(); });
  await page.waitForFunction(() => pirateFleet.length === 10, null, { timeout: 15000 });

  const composition = await page.evaluate(() => ({
    total: pirateFleet.length,
    golovorez: pirateFleet.filter(e => e.ty === 0).length,
    jackal: pirateFleet.filter(e => e.ty === 1).length,
    spawned: pirateFleet.filter(e => !!e.g).length
  }));
  L.check('эскадрилья содержит ровно 5 Головорезов и 5 Шакалов', composition.total === 10 && composition.golovorez === 5 && composition.jackal === 5, composition);
  L.check('все десять кораблей созданы', composition.spawned === 10, composition);

  const fire = await page.evaluate(() => {
    pirateFleet.forEach((e, i) => {
      e.warp = 0; e.g.visible = true;
      e.g.position.copy(P).add(new THREE.Vector3((i - 5) * 14, 0, 520));
      e.hd.copy(P.clone().sub(e.g.position).normalize());
      e.vel.copy(e.hd).multiplyScalar(40);
      e.state = 'ATTACK_RUN'; e.stateT = 0; e.fire = 0; e.burst = 0; e.burstGap = 0;
    });
    const before = eb.length;
    pirateFleetUpdate(.05);
    return { before, after: eb.length, delta: eb.length - before };
  });
  L.check('все десять пилотов самостоятельно открывают огонь', fire.delta >= 10, fire);

  const damage = await page.evaluate(() => {
    const e = pirateFleet[0], type = e.ty;
    pirateFleetDamage(e, 100000, false);
    const destroyed = !e.g && e.dead && e.respawn > 0;
    e.respawn = 0; pirateFleetUpdate(.05);
    return { destroyed, respawned: !!e.g, sameType: e.ty === type, slots: pirateFleet.length };
  });
  L.check('уничтожение и восстановление корабля сохраняют слот и тип', damage.destroyed && damage.respawned && damage.sameType && damage.slots === 10, damage);

  const cleanup = await page.evaluate(() => {
    toMenu();
    return { slots: pirateFleet.length, ready: pirateFleetReady };
  });
  L.check('возврат в меню полностью очищает эскадрилью', cleanup.slots === 0 && cleanup.ready === false, cleanup);
  L.check('нет ошибок JavaScript', page.errors.length === 0, page.errors);
  process.exitCode = L.summary();
  await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
