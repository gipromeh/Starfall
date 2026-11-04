'use strict';
const L = require('./lib');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

(async () => {
  const browser = process.env.SF_WEBKIT === '1' ? await L.launchWebKit() : await L.launch();
  const ctx = await L.newCtx(browser, {
    viewport: process.env.SF_WEBKIT === '1' ? { width: 430, height: 932 } : { width: 1280, height: 800 },
    dpr: process.env.SF_WEBKIT === '1' ? 2 : 1,
    touch: process.env.SF_WEBKIT === '1',
    ua: process.env.SF_WEBKIT === '1'
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
      : undefined
  });
  let page;
  try {
    page = await L.openGame(ctx);
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
    await page.waitForFunction(() => !!window.SF_GALAXY_MAP, null, { timeout: 30000 });
    const boot = await page.evaluate(() => ({
      mapButton: !!document.getElementById('sf-galaxy-menu'),
      sharedRenderer: !!R && !!R.domElement,
      version: document.querySelector('meta[name="starfall-version"]')?.content
    }));
    L.check('Galaxy Map: загрузчик подключён к игре', boot.mapButton && boot.sharedRenderer && boot.version === 'v95', boot);

    await page.evaluate(() => window.SF_GALAXY_MAP.open());
    await page.waitForFunction(() => state === 'galaxy', null, { timeout: 10000 });
    await page.waitForFunction(() => window.SF_GALAXY_MAP.stats.catalog === 50000, null, { timeout: 90000 });
    const catalog = await page.evaluate(() => ({
      count: window.SF_GALAXY_MAP.stats.catalog,
      status: document.querySelector('#sf-galaxy .status')?.textContent || '',
      rootBackground: getComputedStyle(document.getElementById('sf-galaxy')).backgroundColor,
      inhabitedDisabled: [...document.querySelectorAll('#sf-galaxy .bottom button')].find(b => b.textContent.includes('ОБЖИТЫЕ'))?.disabled
    }));
    L.check('Galaxy Map: 50 000 записей загружены и SHA-256 проверен', catalog.count === 50000 && catalog.status.includes('SHA-256 подтверждён'), catalog);
    L.check('Galaxy Map: 3D canvas не перекрыт фоном интерфейса', catalog.rootBackground === 'rgba(0, 0, 0, 0)', catalog.rootBackground);
    L.check('Galaxy Map: фильтр населения отключён при отсутствии population', catalog.inhabitedDisabled === true, catalog.inhabitedDisabled);

    const search = page.locator('#sf-galaxy input');
    await search.fill('ЛАВЕ');
    await page.locator('#sf-galaxy .results button').first().click();
    const localSelection = await page.evaluate(() => window.SF_GALAXY_MAP.stats.selected);
    L.check('Galaxy Map: поиск и выбор локальной системы', localSelection === 'ЛАВЕ', localSelection);

    await search.fill('N');
    await search.press('N');
    const keyboardState = await page.evaluate(() => state);
    L.check('Galaxy Map: клавиша N не закрывает карту при вводе в поиск', keyboardState === 'galaxy', keyboardState);

    const dataPath = path.join(__dirname, '..', 'data', 'elite-dangerous-lite', 'systems.jsonl.gz');
    const firstExternal = JSON.parse(zlib.gunzipSync(fs.readFileSync(dataPath)).toString('utf8').split('\n').find(Boolean));
    await search.fill(firstExternal.n);
    await page.locator('#sf-galaxy .results button').filter({ hasText: 'SPANSH' }).first().click();
    await page.locator('#sf-galaxy .actions button').filter({ hasText: 'ИССЛЕДОВАТЬ СИСТЕМУ' }).click();
    const exploration = await page.evaluate(() => window.SF_GALAXY_MAP.stats.external);
    L.check('Galaxy Map: внешняя система процедурно сгенерирована', !!exploration && exploration.planets >= 2 && exploration.planets <= 8 && !!exploration.star, exploration);
    const explorationStatus = await page.locator('#sf-galaxy .status').textContent();
    L.check('Galaxy Map: внешний режим изолирован от экономики', explorationStatus.includes('РЕЖИМ ИССЛЕДОВАНИЯ'), explorationStatus);
    await page.evaluate(() => { const c=R.domElement,p=window.SF_GALAXY_MAP.stats.external.starScreen;if(!p?.visible)throw new Error('Звезда вне области камеры');const ev=(type)=>c.dispatchEvent(new PointerEvent(type,{pointerId:77,pointerType:'mouse',clientX:p.x,clientY:p.y,bubbles:true}));ev('pointerdown');ev('pointerup'); });
    const canvasPickStatus = await page.locator('#sf-galaxy .status').textContent();
    L.check('Galaxy Map: выбор звезды прямым нажатием на 3D-сцену', canvasPickStatus.includes('ОБЗОР ОБЪЕКТА · ЗВЕЗДА'), canvasPickStatus);
    const bodyButtons = page.locator('#sf-galaxy .results button');
    L.check('Galaxy Map: доступны фокусировка на телах системы', await bodyButtons.count() >= exploration.planets + 1, await bodyButtons.count());
    await bodyButtons.first().click();
    const starFocusStatus = await page.locator('#sf-galaxy .status').textContent();
    L.check('Galaxy Map: камера фокусируется на звезде', starFocusStatus.includes('ОБЗОР ОБЪЕКТА'), starFocusStatus);
    await bodyButtons.nth(1).click();
    const bodyFocusStatus = await page.locator('#sf-galaxy .status').textContent();
    L.check('Galaxy Map: камера фокусируется на выбранной планете', bodyFocusStatus.includes('ОБЗОР ОБЪЕКТА'), bodyFocusStatus);
    await page.locator('#sf-galaxy .actions button').filter({ hasText: 'НАЧАТЬ ПОЛЁТ' }).click();
    const flightEntered = await page.evaluate(() => window.SF_GALAXY_MAP.stats.external?.flight === true);
    L.check('Galaxy Map: включается отдельный режим свободного полёта', flightEntered, flightEntered);
    await page.keyboard.down('KeyW'); await L.sleep(650); await page.keyboard.up('KeyW');
    const flightMotion = await page.evaluate(() => window.SF_GALAXY_MAP.stats.external);
    L.check('Galaxy Map: тяга перемещает корабль в процедурной системе', flightMotion?.flight === true && flightMotion.speed > 1, flightMotion);
    await page.locator('#sf-galaxy .actions button').filter({ hasText: 'ОРБИТАЛЬНЫЙ ОБЗОР' }).click();
    const flightExited = await page.evaluate(() => window.SF_GALAXY_MAP.stats.external?.flight === false);
    L.check('Galaxy Map: возврат из полёта в орбитальный обзор', flightExited, flightExited);
    await page.locator('#sf-galaxy .actions button').filter({ hasText: 'К КАРТЕ' }).click();
    const returnedToMap = await page.evaluate(() => window.SF_GALAXY_MAP.stats.external === null);
    L.check('Galaxy Map: возврат из исследования очищает временную сцену', returnedToMap, returnedToMap);
    await page.locator('#sf-galaxy .actions button').filter({ hasText: 'НАЧАТЬ МАРШРУТ' }).click();
    await search.fill('ЛАВЕ');
    await page.locator('#sf-galaxy .results button').first().click();
    await page.locator('#sf-galaxy .actions button').filter({ hasText: 'ВЫБРАТЬ ФИНИШ' }).click();
    const mixedRoute = await page.locator('#sf-galaxy .status').textContent();
    L.check('Galaxy Map: смешение координат Spansh и STARFALL блокируется', mixedRoute.includes('координаты локального сектора условные'), mixedRoute);

    await page.locator('#sf-galaxy .bottom button.close').click();
    await page.waitForFunction(() => state === 'menu', null, { timeout: 10000 });
    await page.click('#play');
    await page.waitForFunction(() => state === 'dock', null, { timeout: 90000 });
    await page.evaluate(() => lift());
    await page.waitForFunction(() => state === 'play', null, { timeout: 15000 });
    const targetIndex = await page.evaluate(() => (sy + 1) % SYS.length);
    const targetName = await page.evaluate(i => SYS[i].n, targetIndex);
    await page.evaluate(() => window.SF_GALAXY_MAP.open());
    await page.waitForFunction(() => state === 'galaxy', null, { timeout: 10000 });
    await search.fill(targetName);
    await page.locator('#sf-galaxy .results button').first().click();
    const jumpEnabled = await page.locator('#sf-galaxy .actions button').first().isEnabled();
    L.check('Galaxy Map: игровой гиперпрыжок доступен для локальной системы', jumpEnabled, targetName);
    await page.locator('#sf-galaxy .actions button').first().click();
    await page.waitForFunction(i => state === 'play' && sy === i, targetIndex, { timeout: 20000 });
    const finalState = await page.evaluate(() => ({ state, system: SYS[sy].n, mapStats: window.SF_GALAXY_MAP.stats }));
    L.check('Galaxy Map: гиперпрыжок завершился в выбранной системе', finalState.state === 'play' && finalState.system === targetName, finalState);
    L.check('Galaxy Map: нет ошибок JavaScript', page.errors.length === 0, page.errors);
    process.exitCode = L.summary();
  } catch (error) {
    let diagnostics = null;
    try { diagnostics = await page.evaluate(() => ({ state: typeof state === 'undefined' ? null : state, map: window.SF_GALAXY_MAP?.stats, status: document.querySelector('#sf-galaxy .status')?.textContent, errors: window.__STARFALL_DIAG__?.errors })); } catch (_) {}
    console.error('GALAXY MAP DIAGNOSTICS', diagnostics, page?.errors, page?.logs?.slice(-30));
    throw error;
  } finally {
    await ctx.close();
    await browser.close();
  }
})().catch(error => { console.error('CRASH', error); process.exit(2); });
