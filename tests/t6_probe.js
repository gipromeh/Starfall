const L = require('./lib');
const mem = page => page.evaluate(() => ({ g: R.info.memory.geometries, t: R.info.memory.textures, ch: S.children.length }));
const ff = (page, sec) => page.evaluate(s => { const n = Math.round(s / .05); for (let i = 0; i < n; i++) upd(.05); }, sec);
(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 400, height: 225 } });
  const page = await L.openGame(ctx);
  await page.click('#play'); await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 }); await L.sleep(500);
  await page.evaluate(() => { lift(); QL.setMode('low'); }); await L.sleep(1500);
  await page.evaluate(() => { enc = 0; });
  const ops = {
    'выстрелы лазера (3 с)': async () => { await page.evaluate(() => { firing = true; }); await ff(page, 3); await page.evaluate(() => { firing = false; }); await ff(page, 6); },
    'ракета без цели (до 7 с жизни)': async () => { await page.evaluate(() => { miss = 8; launch(); }); await ff(page, 9); },
    'boom ×3 + ring ×2 + trail ×5': async () => { await page.evaluate(() => { const p = P.clone().add(new THREE.Vector3(0, 0, -80)); for (let i = 0; i < 3; i++) boom(p, 40, 3, 0xffaa44, 40, 1); ring(p, 0xffffff, 5, 3); ring(p, 0xffaa33, 5, 3); for (let i = 0; i < 5; i++) trail(p); }); await ff(page, 8); },
    'xplode (взрыв)': async () => { await page.evaluate(() => xplode(P.clone().add(new THREE.Vector3(0, 0, -80)), new THREE.Vector3(), 1)); await ff(page, 8); },
    'пират: спавн → убийство (взрыв, обломки, пилот)': async () => { await page.evaluate(() => { if (!E) spawnE(); }); await ff(page, 5); await page.evaluate(() => { if (E) hurtEn(E, 1e6, false); }); await ff(page, 40); },
    'ядерка (запуск+взрыв)': async () => { await page.evaluate(() => { nuke = 1; bomb(); }); await ff(page, 12); },
  };
  const out = [];
  for (const [name, fn] of Object.entries(ops)) {
    await fn(); await fn(); await ff(page, 20);                 // прогрев кешей
    const a = await mem(page);
    for (let i = 0; i < 6; i++) await fn();
    await ff(page, 40);
    const b = await mem(page);
    out.push({ name, dg: b.g - a.g, dt: b.t - a.t, dch: b.ch - a.ch });
    console.log(`${name.padEnd(52)} геометрий ${String(b.g - a.g).padStart(4)}  текстур ${String(b.t - a.t).padStart(3)}  объектов сцены ${String(b.ch - a.ch).padStart(4)}   (за 6 повторов)`);
  }
  console.log('errors:', page.errors);
  await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
