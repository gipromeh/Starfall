const L = require('./lib');
const mem = page => page.evaluate(() => ({ g: R.info.memory.geometries, t: R.info.memory.textures, p: R.info.programs.length, ch: S.children.length, fx: fx.length, deb: deb.length, trs: trs.length, ali: ali.length, pk: pk.length, bul: bul.length, eb: eb.length, mis: mis.length, wave, kills }));
const ff = (page, sec) => page.evaluate(s => { const n = Math.round(s / .05); for (let i = 0; i < n; i++) upd(.05); return n; }, sec);
(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 480, height: 270 }, dpr: 2 });
  const page = await L.openGame(ctx);
  await page.click('#play'); await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 }); await L.sleep(500);
  await page.evaluate(() => lift()); await L.sleep(1500);

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
  for (let r = 0; r < 2; r++) { await page.evaluate(() => { if (!E) spawnE(); }); await ff(page, 4); await page.evaluate(() => { if (E) hurtEn(E, 1e6, false); }); await ff(page, 3); }
  await ff(page, 40);
  const b0 = await mem(page);
  for (let r = 0; r < 8; r++) { await page.evaluate(() => { if (!E) spawnE(); }); await ff(page, 5); await page.evaluate(() => { firing = true; }); await ff(page, 2); await page.evaluate(() => { firing = false; if (E) hurtEn(E, 1e6, false); }); await ff(page, 3); }
  await ff(page, 40);
  const b1 = await mem(page);
  console.log('  до   :', JSON.stringify(b0)); console.log('  после:', JSON.stringify(b1));
  L.check('убийства происходили (wave вырос)', b1.wave >= b0.wave + 6, { w0: b0.wave, w1: b1.wave });
  L.check('объекты сцены после затухания эффектов вернулись к исходному уровню (±15)', Math.abs(b1.ch - b0.ch) <= 15, { c0: b0.ch, c1: b1.ch });
  L.check('геометрии (±15) и текстуры (±6) не растут', b1.g <= b0.g + 15 && b1.t <= b0.t + 6, { g: [b0.g, b1.g], t: [b0.t, b1.t] });
  L.check('массивы эффектов очищены (fx/deb/trs/ali/pk/bul/eb/mis)', b1.fx <= 2 && b1.deb <= 2 && b1.ali <= 2 && b1.bul <= 2 && b1.eb <= 12 && b1.trs <= b0.trs + 30, b1);
  L.check('нет ошибок страницы', page.errors.length === 0, page.errors);
  process.exitCode = L.summary(); await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
