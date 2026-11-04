const L = require('./lib');
const mem = page => page.evaluate(() => ({ g: R.info.memory.geometries, t: R.info.memory.textures, p: R.info.programs.length, ch: S.children.length, fx: fx.length, deb: deb.length, trs: trs.length, ali: ali.length, pk: pk.length, bul: bul.length, eb: eb.length, mis: mis.length, wave, kills }));
const ff = (page, sec) => page.evaluate(s => { const n = Math.round(s / .05); for (let i = 0; i < n; i++) upd(.05); return n; }, sec);
(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 480, height: 270 }, dpr: 2 });
  const page = await L.openGame(ctx);
  // Диагностика жизненного цикла геометрий: порог регрессии не меняется.
  await page.evaluate(() => {
    const records = new Map();
    const track = root => {
      if (!root) return;
      const visit = o => {
        if (!o.geometry) return;
        const g = o.geometry;
        let r = records.get(g.uuid);
        if (!r) {
          r = { uuid:g.uuid, type:g.type, refs:0, disposed:false, keep:!!g.userData?.keep, rc:g.userData?.rc, firstAttach:(new Error()).stack?.split("\n").slice(2,12) };
          records.set(g.uuid,r);
        }
        r.refs++;
      };
      if (root.traverse) root.traverse(visit); else visit(root);
    };
    const add = THREE.Object3D.prototype.add;
    THREE.Object3D.prototype.add = function(...objects) {
      for (const o of objects) track(o);
      return add.apply(this,objects);
    };
    const dispose = THREE.BufferGeometry.prototype.dispose;
    THREE.BufferGeometry.prototype.dispose = function(...args) {
      const r=records.get(this.uuid);
      if(r)r.disposed=true;
      return dispose.apply(this,args);
    };
    window.__sfGeomDiag = { records };
  });
  await page.click('#play'); await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 }); await L.sleep(500);
  await page.evaluate(() => lift()); await page.waitForFunction(() => pirateAssetsReady, null, { timeout: 30000 }); await L.sleep(500);
  // Изолируем E/E2: стартовая эскадрилья v89 стреляет независимо и не должна считаться утечкой в этом тесте.
  await page.evaluate(() => { for(const e of [E,E2])if(e?.g){S.remove(e.g);pirateDamageFxClear(e);} E=null;E2=null;spawnT=1e9;for(const b of eb)S.remove(b.m);eb.length=0;pirateFleetClear();pirateFleetReady=true; });
  L.check('изолированная проверка: стартовая эскадрилья выключена', await page.evaluate(() => pirateFleetReady && pirateFleet.length === 0));

  console.log('\n[Q1] профили (ручной режим — адаптация выключена)');
  const res = [];
  for (const [i, nm] of [[0, 'low'], [1, 'medium'], [2, 'high']]) {
    await page.evaluate(n => QL.setMode(n), nm); await L.sleep(600);
    res.push(await page.evaluate(() => ({ prof: QL.stat().prof, pr: R.getPixelRatio(), w: R.domElement.width, h: R.domElement.height })));
  }
  console.log('  ', JSON.stringify(res));
  L.check('LOW=1, MEDIUM=1.25, HIGH=1.5 (десктоп, экран DPR 2)', res[0].pr === 1 && res[1].pr === 1.25 && res[2].pr === 1.5, res.map(r => r.pr));
  L.check('буфер = CSS-размер × pixelRatio', res.every(r => r.w === Math.floor(480 * r.pr) && r.h === Math.floor(270 * r.pr)), res);

  console.log('\n[Q9] утечки в бою: прогрев, затем 8 раундов «спавн → убийство», перемотка 40 с игрового времени');
  await page.evaluate(() => QL.setMode('low'));
  // прогрев: все кеши (материалы лучей, текстуры взрывов, модели) создаются при первом использовании
  for (let r = 0; r < 2; r++) { await page.evaluate(() => { if (!E) spawnE(); if(E){E.fire=1e9;E.burstLeft=0;E.burstGap=1e9;} }); await ff(page, 4); await page.evaluate(() => { if (E) hurtEn(E, 1e6, false); spawnT=1e9; }); await ff(page, 3); }
  // Прогреваем ленивые кэши босса и тяжёлого архетипа до замера памяти.
  await page.evaluate(() => { if(!E){wave=5;spawnE();} if(E){E.fire=1e9;E.burstLeft=0;E.burstGap=1e9;} });
  await ff(page, 4); await page.evaluate(() => { if(E)hurtEn(E,1e6,false);spawnT=1e9; }); await ff(page, 3);
  await page.evaluate(() => { const old=Math.random;let n=0;Math.random=()=>[.1,.99,.99,.99,.99][n++]??.99;wave=6;spawnE();Math.random=old;if(E){E.fire=1e9;E.burstLeft=0;E.burstGap=1e9;} });
  await ff(page, 4); await page.evaluate(() => { if(E)hurtEn(E,1e6,false);spawnT=1e9; }); await ff(page, 3);
  await ff(page, 40);
  // Все lazy-кэши пиратских моделей должны быть построены до baseline:
  // их shared geometry намеренно живёт в MC и повторно используется клонами.
  await page.evaluate(() => {
    for (let ty = 0; ty < 4; ty++) mkPirate(ty);
    mkBoss();
  });
  // Прогреваем ленивые шаблоны туристов: TMC хранит их shared geometry
  // для повторного использования клонами в течение игровой сессии.
  await page.evaluate(() => {
    window.__sfTouristWarmup = [];
    for (let k = 0; k < 3; k++) {
      const template = TMC[k] || (TMC[k] = mkTourist(k));
      const instance = template.clone(true);
      S.add(instance);
      window.__sfTouristWarmup.push(instance);
    }
  });
  await L.sleep(500);
  await page.evaluate(() => {
    for (const instance of window.__sfTouristWarmup || []) S.remove(instance);
    window.__sfTouristWarmup = [];
  });
  await page.evaluate(() => spawnPlanetFreighter(2));
  await L.sleep(300);
  const freighterBeforeRemoval = await mem(page);
  await page.evaluate(() => removeNvAt(nv.length - 1));
  await L.sleep(300);
  const freighterAfterRemoval = await mem(page);
  L.check('геометрия планетарного грузовоза освобождается при удалении', freighterAfterRemoval.g < freighterBeforeRemoval.g, { before:freighterBeforeRemoval.g, after:freighterAfterRemoval.g });
  const b0 = await mem(page);
  const geomBaseline = await page.evaluate(() => [...window.__sfGeomDiag.records.keys()]);
  for (let r = 0; r < 8; r++) { await page.evaluate(() => { if (!E) spawnE(); if(E){E.fire=1e9;E.burstLeft=0;E.burstGap=1e9;} }); await ff(page, 5); await page.evaluate(() => { firing = true; }); await ff(page, 2); await page.evaluate(() => { firing = false; if (E) hurtEn(E, 1e6, false); spawnT=1e9; }); await ff(page, 3); }
  await ff(page, 40);
  const b1 = await mem(page);
  const geomLeaks = await page.evaluate(base => {
    const attached = new Set();
    S.traverse(o => { if(o.geometry) attached.add(o.geometry.uuid); });
    const old = new Set(base);
    const fresh = [...window.__sfGeomDiag.records.values()].filter(r => !old.has(r.uuid));
    const detached = fresh.filter(r => !r.disposed && !attached.has(r.uuid));
    const leaked = detached.filter(r => !r.keep);
    const retained = detached.filter(r => r.keep);
    const grouped = {};
    for(const r of leaked) {
      const k=r.type||"unknown";
      (grouped[k]||(grouped[k]=[])).push({uuid:r.uuid,refs:r.refs,keep:r.keep,rc:r.rc,stack:r.firstAttach});
    }
    const retainedByType = {};
    for(const r of retained) {
      const k=r.type||"unknown";
      (retainedByType[k]||(retainedByType[k]=[])).push({uuid:r.uuid,refs:r.refs,rc:r.rc,stack:r.firstAttach});
    }
    const attachedByType = {};
    for(const r of fresh.filter(r => attached.has(r.uuid))) {
      const k=r.type||"unknown";
      (attachedByType[k]||(attachedByType[k]=[])).push({uuid:r.uuid,refs:r.refs,keep:r.keep,rc:r.rc,stack:r.firstAttach});
    }
    return {trackedNew:fresh.length,disposed:fresh.filter(r=>r.disposed).length,stillAttached:fresh.filter(r=>attached.has(r.uuid)).length,detachedUndisposed:leaked.length,detachedRetained:retained.length,byType:grouped,retainedByType,attachedByType};
  },geomBaseline);
  console.log('  диагностика геометрий:',JSON.stringify(geomLeaks));
  L.check('нет отсоединённых геометрий без владельца', geomLeaks.detachedUndisposed === 0, geomLeaks);
  console.log('  до   :', JSON.stringify(b0)); console.log('  после:', JSON.stringify(b1));
  L.check('убийства происходили (wave вырос)', b1.wave >= b0.wave + 6, { w0: b0.wave, w1: b1.wave });
  L.check('объекты сцены после затухания эффектов вернулись к исходному уровню (±15)', Math.abs(b1.ch - b0.ch) <= 15, { c0: b0.ch, c1: b1.ch });
  L.check('геометрии (±15) и текстуры (±6) не растут', b1.g <= b0.g + 15 && b1.t <= b0.t + 6, { g: [b0.g, b1.g], t: [b0.t, b1.t] });
  L.check('массивы эффектов очищены (fx/deb/trs/ali/pk/bul/eb/mis)', b1.fx <= 2 && b1.deb <= 2 && b1.ali <= 2 && b1.bul <= 2 && b1.eb <= 12 && b1.trs <= b0.trs + 30, b1);
  L.check('нет ошибок страницы', page.errors.length === 0, page.errors);
  process.exitCode = L.summary(); await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
