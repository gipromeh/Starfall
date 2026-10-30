// v44: GLB-пират (assets/ships/pirate/pirate_fighter_002) подменяет процедурного «Головореза» в кэше врагов
const L = require('./lib');
(async () => {
  const browser = await L.launch();
  console.log('\n[8] GLB-пират');
  // A. с сетью до GLB: после загрузки в сцене появляется GLB-модель, остальные пираты процедурные
  let ctx = await L.newCtx(browser, { viewport: { width: 640, height: 360 } });
  let page = await L.openGame(ctx);
  await page.waitForFunction(() => { let n = 0; mkPirate(0).traverse(o => { if (o.isMesh) n++; }); return n === 3; }, null, { timeout: 60000, polling: 500 }).catch(() => {});
  const r = await page.evaluate(() => { const g = mkPirate(0), p1 = mkPirate(1); let m = 0, tr = 0; g.traverse(o => { if (o.isMesh) { m++; tr += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; } }); const mats = new Set(); g.traverse(o => { if (o.isMesh) mats.add(o.material.name); });
    const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); let m1 = 0; p1.traverse(o => { if (o.isMesh) m1++; });
    return { glb: g.scale.x === .75, meshes: m, tris: Math.round(tr), mats: [...mats], size: [s.x, s.y, s.z].map(v => +v.toFixed(1)), cz: +c.z.toFixed(2), m1, sc: g.scale.x }; });
  L.check('8A. mkPirate(0) отдаёт GLB-модель (масштаб 0.75)', r.glb, r);
  L.check('8A. 3 меша, 854 треугольника, материалы hull/glow/glass', r.meshes === 3 && r.tris === 854 && ['pirate_hull', 'pirate_glow', 'pirate_glass'].every(n => r.mats.includes(n)), r);
  L.check('8A. клон масштабирован 0.75, нос по -Z (центр габаритов ~0)', r.sc === .75 && Math.abs(r.cz) < .6, r);
  L.check('8A. остальные типы пиратов процедурные (много мешей)', r.m1 > 10, r);
  // спавн и уничтожение GLB-врага в игре
  await page.click('#play'); await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 }); await L.sleep(300);
  await page.evaluate(() => lift()); await L.sleep(1500);
  const sp = await page.evaluate(() => { wave = 1; spawnE(); return { ty: E && E.ty, boss: E && E.boss, meshes: (() => { let n = 0; E.g.traverse(o => { if (o.isMesh) n++; }); return n; })() }; });
  L.check('8A. spawnE создаёт врага типа 0 с GLB-моделью (3 меша)', sp.ty === 0 && sp.meshes === 3, sp);
  await page.evaluate(() => { E.warp = 0; E.g.visible = true; E.g.position.copy(P).add(new THREE.Vector3(0, 0, -60).applyQuaternion(Q)); });
  await L.sleep(1200);
  await page.screenshot({ path: process.env.SHOT || '/tmp/glb_pirate.png' });
  const k = await page.evaluate(() => { try { kill(1); return 'ok'; } catch (e) { return String(e); } });
  await L.sleep(1500);
  L.check('8A. уничтожение GLB-врага без ошибок (обломки)', k === 'ok' && page.errors.length === 0, { k, errs: page.errors });
  await page.close(); await ctx.close();
  // B. GLB недоступен (404): остаётся процедурный Головорез, ошибок нет
  ctx = await L.newCtx(browser, { viewport: { width: 640, height: 360 } });
  await ctx.route('**/model.glb', r => r.fulfill({ status: 404, body: '' }));
  page = await L.openGame(ctx); await L.sleep(3000);
  const rb = await page.evaluate(() => { const g = mkPirate(0); let m = 0; g.traverse(o => { if (o.isMesh) m++; }); return { meshes: m, sc: g.scale.x }; });
  L.check('8B. при 404 остаётся процедурный Головорез (много мешей, sc 1.15)', rb.meshes > 10 && rb.sc === 1.15, rb);
  L.check('8B. без ошибок страницы', page.errors.length === 0, page.errors);
  await ctx.close(); await browser.close();
  process.exit(L.summary() ? 1 : 0);
})();
