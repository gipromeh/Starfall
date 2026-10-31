const L = require('./lib');
(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 800, height: 450 }, dpr: 1 });
  const page = await L.openGame(ctx);
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.evaluate(() => { lift(); QL.setMode('low'); });
  await L.sleep(900);

  const count = (snap, name) => snap.data[name] ? snap.data[name].calls : 0;
  const runMeasured = async scenario => {
    const result = await page.evaluate(scenario => {
      if (scenario === 'station') {
        if (stn) S.remove(stn);
        stn = mkStation(); stn.position.copy(P); S.add(stn);
        stn.userData.fireNodes = [];
        stationAddFire(new THREE.Vector3());
        R.compile(S, C);
        stationFireClear();
        stn.userData.nukeFall = 0;
        nk = { m: new THREE.Object3D(), target: 'station' };
        nk.m.position.copy(stn.position); S.add(nk.m);
      } else {
        if (E) S.remove(E.g); if (E2) S.remove(E2.g);
        E = null; E2 = null; spawnE(); spawnE();
        E.g.position.copy(P); E.g.visible = true; E.warp = 0; E.hp = 1;
        E2.g.position.copy(P); E2.g.visible = true; E2.warp = 0; E2.hp = 1;
        nk = { m: new THREE.Object3D(), target: null };
        nk.m.position.copy(P); S.add(nk.m);
        R.compile(S, C);
      }
      const before = PF.stat();
      window.__sfGaps = [];
      let prev = performance.now();
      const stopAt = prev + 1500;
      const tick = now => { window.__sfGaps.push(now - prev); prev = now; if (now < stopAt) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const t0 = performance.now();
      det();
      return {
        syncMs: performance.now() - t0,
        before,
        after: PF.stat(),
        stationOk: !!(stn && stn.userData.nukeFall && stn.userData.fireNodes.length === 4)
      };
    }, scenario);
    await L.sleep(1550);
    const gaps = await page.evaluate(() => window.__sfGaps || []);
    return { ...result, maxGap: Math.max(0, ...gaps) };
  };

  console.log('\n[N1] Ядерный удар по станции (после прогрева шейдеров)');
  const station = await runMeasured('station');
  const stationMs = station.after.data.station ? station.after.data.station.last : 0;
  console.log('det:', station.after.data.det.last.toFixed(3), 'ms; stationCatastrophe:', stationMs.toFixed(3), 'ms; total:', station.syncMs.toFixed(3), 'ms; max rAF gap:', station.maxGap.toFixed(1), 'ms');
  L.check('станция перешла в состояние катастрофы', station.stationOk);
  L.check('профилировщик записал det и station', count(station.after, 'det') > count(station.before, 'det') && count(station.after, 'station') > count(station.before, 'station'));
  L.check('станционный удар < 250 ms CPU', station.syncMs < 250, { totalMs: station.syncMs, maxFrameGap: station.maxGap });

  console.log('\n[N2] Ядерный взрыв с уничтожением двух противников');
  const enemies = await runMeasured('enemies');
  const kills = count(enemies.after, 'kill') - count(enemies.before, 'kill');
  console.log('det:', enemies.after.data.det.last.toFixed(3), 'ms; kill calls:', kills, '; total:', enemies.syncMs.toFixed(3), 'ms; max rAF gap:', enemies.maxGap.toFixed(1), 'ms');
  L.check('каскад уничтожил ровно двух противников', kills === 2, { kills });
  L.check('каскадный удар < 250 ms CPU', enemies.syncMs < 250, { totalMs: enemies.syncMs, maxFrameGap: enemies.maxGap });
  L.check('нет ошибок JavaScript', page.errors.length === 0, page.errors);
  console.log('\nИтог:', JSON.stringify({
    station: { detMs: station.after.data.det.last, catastropheMs: stationMs, totalMs: station.syncMs, maxFrameGapMs: station.maxGap },
    twoEnemies: { detMs: enemies.after.data.det.last, killCalls: kills, killMs: enemies.after.data.kill.last, totalMs: enemies.syncMs, maxFrameGapMs: enemies.maxGap }
  }, null, 2));
  process.exitCode = L.summary();
  await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
