// v45: «Пират-дроид 001» — первый нападающий (тип 0), два пирата сразу
const L = require('./lib');
(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 800, height: 450 } });
  const page = await L.openGame(ctx);
  await page.waitForFunction(() => { let n = 0; mkPirate(0).traverse(o => { if (o.isMesh) n++; }); return n > 0 && n < 40 && mkPirate(0).scale.x === 1; }, null, { timeout: 90000, polling: 500 }).catch(() => {});
  const r = await page.evaluate(() => { const g = mkPirate(0); let m = 0, tr = 0; const mats = new Set(); g.traverse(o => { if (o.isMesh) { m++; mats.add(o.material.uuid); tr += o.geometry.index.count / 3; } });
    const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); return { m, mats: mats.size, tris: Math.round(tr), size: [s.x, s.y, s.z].map(v => +v.toFixed(1)), c: [c.x, c.y, c.z].map(v => +v.toFixed(2)), sc: g.scale.x }; });
  console.log(JSON.stringify(r));
  L.check('10A. дроид загружен, меши слиты по материалам (<40 вызовов)', r.m > 0 && r.m < 40, r);
  L.check('10A. размах ~11, центр у нуля, масштаб 1', Math.abs(r.size[0] - 11) < 1 && Math.abs(r.c[0]) < .3 && Math.abs(r.c[2]) < .3 && r.sc === 1, r);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await page.click('#play'); await page.waitForFunction(() => state === 'dock', null, { timeout: 90000 }); await L.sleep(300);
  await page.evaluate(() => lift()); await L.sleep(1500);
  const sp = await page.evaluate(() => { wave = 1; enc = 2; spawnE(); return { ty: E.ty, meshes: (() => { let n = 0; E.g.traverse(o => { if (o.isMesh) n++; }); return n; })() }; });
  L.check('10B. первый враг — тип 0 с моделью дроида', sp.ty === 0 && sp.meshes > 0 && sp.meshes < 40, sp);
  // два сразу: второй появляется сам, пока идёт варп первого
  for (let i = 0; i < 20 && !(await page.evaluate(() => !!E2)); i++) await page.evaluate(() => { for (let k = 0; k < 4; k++) upd(.05); });
  const two = await page.evaluate(() => ({ e2: !!E2, ty2: E2 && E2.ty, warp1: E.warp, t: E.pt }));
  L.check('10C. второй пират появляется почти сразу (волна 1, до конца варпа)', two.e2 && two.t < 3, two);
  await page.evaluate(() => { for (const e of [E, E2]) { e.warp = 0; e.g.visible = true; } E.g.position.copy(P).add(new THREE.Vector3(-14, 2, -70).applyQuaternion(Q)); E2.g.position.copy(P).add(new THREE.Vector3(18, -3, -90).applyQuaternion(Q)); });
  await L.sleep(1500); await page.screenshot({ path: process.env.SHOT || '/tmp/droid2.png' });
  const k = await page.evaluate(() => { try { kill(1); return 'ok'; } catch (e) { return String(e); } });
  await L.sleep(1500);
  L.check('10D. уничтожение дроида без ошибок', k === 'ok' && page.errors.length === 0, { k, errs: page.errors });
  const mem = await page.evaluate(() => ({ g: R.info.memory.geometries, tex: R.info.memory.textures }));
  console.log('memory', JSON.stringify(mem));
  await browser.close(); process.exit(L.summary() ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
