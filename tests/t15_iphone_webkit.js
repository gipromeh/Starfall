const L = require('./lib');

(async () => {
  const browser = await L.launchWebKit();
  const ctx = await L.newCtx(browser, {
    viewport: { width: 932, height: 430 },
    dpr: 3,
    touch: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page = await ctx.newPage();
  page.errors = []; page.logs = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource|net::ERR|ERR_FAILED/.test(t)) page.errors.push('console.error: ' + t.slice(0, 300));
    else page.logs.push(m.type() + ': ' + t.slice(0, 200));
  });
  page.on('request', r => page.logs.push('request: ' + r.url().slice(0, 180)));
  page.on('response', r => page.logs.push('response: ' + r.status() + ' ' + r.url().slice(0, 180)));
  page.on('requestfailed', r => page.logs.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  page.on('domcontentloaded', () => page.logs.push('event:DOMContentLoaded'));
  page.on('dialog', d => { page.lastDialog = d.message(); (page.dialogHandler || (x => x.accept()))(d); });
  try {
    // Wait until the document has parsed and inline game scripts have executed.
    // Blocked external fonts/CDNs do not prevent DOMContentLoaded.
    await page.goto(L.ORIGIN + '/', { waitUntil: 'commit', timeout: 30000 });
    await page.waitForFunction(() => !!window.__STARFALL_READY__ && !!window.__STARFALL_DIAG__, null, { timeout: 90000 });
    await page.evaluate(() => localStorage.clear());
    await L.sleep(1500); // дать завершиться ленивой инициализации интерфейса
    const initial = await page.evaluate(() => window.__STARFALL_DIAG__.initial());
    L.check('WebKit: игра и WebGL renderer инициализированы', initial.webgl, initial);
    L.check('WebKit: мобильный профиль определён как touch', initial.touch === true, initial.touch);
    L.check('WebKit: DPR ограничен мобильным профилем', initial.dpr <= 1.5, initial.dpr);

    await page.click('#play');
    await page.waitForFunction(() => window.__STARFALL_DIAG__.state() === 'dock', null, { timeout: 90000 });
    await page.evaluate(() => window.__STARFALL_DIAG__.lift());
    await page.waitForFunction(() => window.__STARFALL_DIAG__.state() === 'play', null, { timeout: 15000 });

    const controls = await page.evaluate(() => {
      const wanted = ['ОГОНЬ', 'РАКЕТА', 'ФОРСАЖ', 'СОПР.', 'ЛАЗЕР'];
      const out = {};
      for (const name of wanted) {
        const el = [...document.querySelectorAll('#hud button')].find(x => x.textContent.trim() === name);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        out[name] = { width: r.width, height: r.height, visible: r.width > 0 && r.height > 0 };
      }
      return out;
    });
    L.check('WebKit: созданы все пять мобильных кнопок', Object.keys(controls).length === 5, controls);
    const undersized = Object.entries(controls).filter(([, r]) => !r.visible || r.width < 44 || r.height < 44);
    L.check('WebKit: сенсорные кнопки не меньше 44×44 CSS px', undersized.length === 0, undersized);

    const fireState = await page.evaluate(() => window.__STARFALL_DIAG__.firePointer());
    L.check('WebKit: pointerdown/pointerup корректно включает и отпускает огонь', !!fireState && fireState.down === true && fireState.up === false, fireState);
    const aim = await page.evaluate(() => window.__STARFALL_DIAG__.aimPointer());
    L.check('WebKit: сенсорное движение управляет прицелом и сбрасывается при отпускании', aim.moved > .8 && aim.reset === 0, aim);

    await page.setViewportSize({ width: 430, height: 932 });
    await L.sleep(350);
    const portrait = await page.evaluate(() => ({ ...window.__STARFALL_DIAG__.canvas(), innerWidth, innerHeight }));
    L.check('WebKit: resize/orientation обновляет размер WebGL canvas', portrait.width > 0 && portrait.height > 0, portrait);

    L.check('WebKit: нет ошибок JavaScript', page.errors.length === 0, page.errors);
    process.exitCode = L.summary();
  } catch (e) {
    let runtime = null;
    try { runtime = await page.evaluate(() => ({ readyState: document.readyState, href: location.href, scripts: [...document.scripts].map(s => s.src || '[inline]').slice(0,20), three: typeof THREE, save: typeof SV, gameState: typeof state, bodyLength: document.body?.innerHTML.length || 0 })); } catch (_) {}
    console.error('WEBKIT DIAGNOSTICS', page.logs.slice(-80), page.errors, runtime);
    throw e;
  } finally {
    await ctx.close();
    await browser.close();
  }
})().catch(e => { console.error('CRASH', e); process.exit(2); });
