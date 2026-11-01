const L = require('./lib');
const best = page => page.evaluate(() => { const r = SV.load(); return r.ok ? { src: r.src, d: r.d } : null; });
const raw = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
async function startNew(page) { await page.click('#play'); await page.waitForFunction(() => state === 'dock', null, { timeout: 30000 }); await L.sleep(300); }
async function reopen(ctx, old) { await old.close(); const p = await L.openGame(ctx); await p.waitForSelector('#cont', { state: 'visible', timeout: 5000 }); await p.evaluate(() => document.getElementById('cont').click()); await p.waitForFunction(() => state === 'dock', null, { timeout: 30000 }); await L.sleep(300); return p; }
async function goMenu(page) { await page.evaluate(() => { if (state === 'dock') lift(); }); await L.sleep(500); await page.evaluate(() => pause(true)); await page.click('#men1'); await page.waitForFunction(() => state === 'menu'); await L.sleep(200); }
async function clickText(page, scope, re) { return page.evaluate(([s, src]) => { const r = new RegExp(src); const b = [...document.querySelectorAll(s + ' button, ' + s + ' .chip, ' + s + ' [onclick]')].find(x => r.test(x.textContent)); if (b) { b.click(); return b.textContent; } return null; }, [scope, re.source]); }

(async () => {
  const browser = await L.launch(); const ctx = await L.newCtx(browser);
  let page = await L.openGame(ctx);
  await startNew(page);

  console.log('\n[1] Купить корабль -> закрыть вкладку -> открыть');
  await page.evaluate(() => { cr = 20000; stTab = 'hgr'; stnDraw(); });
  await L.sleep(500);
  const clicked = await clickText(page, '#mkt', /Купить.*2500|Купить\s*·\s*₵2500/);
  console.log('   click ->', clicked);
  const afterBuy = await page.evaluate(() => ({ shp, cr, owS: owS.slice() }));
  const diskNow = await best(page);
  L.check('покупка корабля прошла в игре', afterBuy.shp === 1 && afterBuy.cr === 17500, afterBuy);
  L.check('сразу после покупки (до закрытия) запись на диске обновлена', diskNow && diskNow.d.shp === 1 && diskNow.d.cr === 17500, diskNow && { shp: diskNow.d.shp, cr: diskNow.d.cr });
  page = await reopen(ctx, page);
  let s = await page.evaluate(() => ({ shp, cr, owS: owS.slice(), state }));
  L.check('1. после перезапуска корабль и кредиты на месте', s.shp === 1 && s.cr === 17500 && s.owS[1] === 1, s);

  console.log('\n[2] Купить оборудование -> перезагрузить страницу');
  await page.evaluate(() => { stTab = 'hgr'; stnDraw(); });
  await L.sleep(400);
  // реальная кнопка из списка орудий: меняем слот на Плазменную пушку (₵400)
  const w = await clickText(page, '#mkt', /Купить в слот 1.*400|Плазм.*400/);
  console.log('   click ->', w);
  let eq = await page.evaluate(() => ({ gw: gw.slice(), owW: owW.slice(), cr }));
  if (!(eq.owW[1] === 1)) { await page.evaluate(() => { cr -= 400; owW[1] = 1; gw[0] = 1; stnDraw(); }); console.log('   (кнопка не найдена, повторил мутацию + stnDraw)'); }
  eq = await page.evaluate(() => ({ gw: gw.slice(), owW: owW.slice(), cr }));
  await page.reload(); await page.waitForFunction(() => typeof SV !== 'undefined'); await page.waitForSelector('#cont', { state: 'visible' }); await page.click('#cont', { noWaitAfter: true }); await page.waitForFunction(() => state === 'dock'); await L.sleep(300);
  s = await page.evaluate(() => ({ gw: gw.slice(), owW: owW.slice(), cr }));
  L.check('2. оружие и деньги после reload', s.owW[1] === 1 && s.gw[0] === 1 && s.cr === eq.cr, { eq, s });

  console.log('\n[3] Продать груз -> закрыть игру');
  await page.evaluate(() => { cargo = [0, 4, 0, 0, 0]; pp = [0, 80, 0, 0, 0]; stTab = 'mkt'; stnDraw(); });
  await L.sleep(400);
  const crBefore = await page.evaluate(() => cr);
  await page.evaluate(() => { const rows = [...document.querySelectorAll('#mkl > *')]; const row = rows[1]; const btns = [...row.querySelectorAll('button')]; const minus = btns.find(b => /−|-/.test(b.textContent)); if (minus) minus.click(); });
  await page.evaluate(() => { if (cargo[1] === 4) { const row = [...document.querySelectorAll('#mkl > *')][1]; const m = [...row.querySelectorAll('button')].find(b => /ДА|−/.test(b.textContent)); if (m) m.click(); } });
  let sold = await page.evaluate(() => ({ cargo: cargo.slice(), cr }));
  console.log('   после клика:', sold);
  if (sold.cargo[1] === 4) { await page.evaluate(() => { cr += SYS[sy].g[1]; cargo[1]--; stnDraw(); }); console.log('   (кнопка продажи не нашлась — мутация + stnDraw)'); sold = await page.evaluate(() => ({ cargo: cargo.slice(), cr })); }
  page = await reopen(ctx, page);
  s = await page.evaluate(() => ({ cargo: cargo.slice(), cr }));
  L.check('3. проданный груз и выручка сохранены', s.cargo[1] === sold.cargo[1] && s.cr === sold.cr, { sold, s });

  console.log('\n[4]+[8] Награда -> меню -> вернуться; нет повторного начисления');
  await page.evaluate(() => { ct = { g: 1, n: 2, to: sy, rw: 500 }; cargo = [0, 2, 0, 0, 0]; stTab = 'hall'; stnDraw(); talk(0); });
  await L.sleep(300);
  const crPre = await page.evaluate(() => cr);
  await page.evaluate(() => { const b = [...document.querySelectorAll('#dlg button')].find(x => /Сдать груз/.test(x.textContent)); if (b) b.click(); });
  s = await page.evaluate(() => ({ cr, ct, cargo: cargo.slice() }));
  L.check('награда начислена один раз, контракт закрыт', s.cr === crPre + 500 && s.ct === null && s.cargo[1] === 0, s);
  await goMenu(page);
  L.check('в меню появилась ПРОДОЛЖИТЬ', await page.evaluate(() => { const c = document.getElementById('cont'); return !!c && c.style.display !== 'none'; }));
  await page.click('#cont', { noWaitAfter: true }); await page.waitForFunction(() => state === 'dock'); await L.sleep(300);
  let s2 = await page.evaluate(() => ({ cr, ct }));
  L.check('4. после меню и возврата: кредиты те же, контракта нет', s2.cr === s.cr && s2.ct === null, { s, s2 });
  for (let i = 0; i < 3; i++) { await goMenu(page); await page.click('#cont', { noWaitAfter: true }); await page.waitForFunction(() => state === 'dock'); }
  s2 = await page.evaluate(() => ({ cr, ct }));
  L.check('8. три загрузки подряд — награда не дублируется', s2.cr === s.cr && s2.ct === null, { s, s2 });

  console.log('\n[5] Перезагрузка на станции — цены/предложения не перебрасываются');
  const before = await page.evaluate(() => ({ g: SYS[sy].g.slice(), ofb: JSON.stringify(ofb), ofr: JSON.stringify(ofr), ev, sy }));
  page = await reopen(ctx, page);
  const after = await page.evaluate(() => ({ g: SYS[sy].g.slice(), ofb: JSON.stringify(ofb), ofr: JSON.stringify(ofr), ev, sy, state }));
  L.check('5. цены, предложения Зорга/Весы и событие те же, state=dock', JSON.stringify(before.g) === JSON.stringify(after.g) && before.ofb === after.ofb && before.ofr === after.ofr && before.ev === after.ev && after.state === 'dock', { before, after });

  console.log('\n[охота] bty сохраняется');
  await page.evaluate(() => { bty = { n: 3, k: 1, sys: sy, rw: 660 }; stnDraw(); });
  page = await reopen(ctx, page);
  s = await page.evaluate(() => bty);
  L.check('охота (bty) восстановлена', s && s.n === 3 && s.k === 1 && s.rw === 660, s);

  console.log('\n[расходники] ракеты/ядерка/корпус');
  await page.evaluate(() => { miss = 11; nuke = 0; kills = 7; hull = 55; stnDraw(); });
  page = await reopen(ctx, page);
  s = await page.evaluate(() => ({ miss, nuke, kills, hull }));
  L.check('miss/nuke/kills/hull сохранены', s.miss === 11 && s.nuke === 0 && s.kills === 7 && s.hull === 55, s);

  console.log('\n[6] Загрузка старого сохранения (формат sf_sv до v42)');
  const legacy = { gal: [{ sec: 40, eco: 35, pir: 65, rep: 0, inf: { gld: 44, bur: 18, mec: 18, pir: 30 }, evt: null }], fr: { gld: 12, bur: 0, mec: -5, pir: 0 }, cr: 4321, cargo: [1, 2, 0], pp: [10, 20, 0], sy: 2, uh: 1.6, uf: 1, ud: 2.56, us: 1, wave: 17, ct: null, shp: 2, gw: [1, 2, 0, 0], shd: 1, mt: 1, owS: [1, 0, 1], owW: [1, 1, 1], owH: [1, 1, 0], owM: [1, 1] };
  await page.evaluate(L_ => { localStorage.clear(); localStorage.setItem('sf_sv', JSON.stringify(L_)); }, legacy);
  await page.reload(); await page.waitForFunction(() => typeof SV !== 'undefined'); await page.waitForSelector('#cont', { state: 'visible' }); await page.click('#cont', { noWaitAfter: true }); await page.waitForFunction(() => state === 'dock'); await L.sleep(300);
  s = await page.evaluate(() => ({ cr, cargo: cargo.slice(), sy, shp, wave, gw: gw.slice(), owS: owS.slice(), uh, ud, fr: GAL.fr, miss, nuke, hull }));
  L.check('6. старое сохранение: кредиты, трюм, система, корабль, волна, тюнинг, фракции', s.cr === 4321 && s.cargo.join() === '1,2,0,0,0' && s.sy === 2 && s.shp === 2 && s.wave === 17 && s.uh === 1.6 && s.ud === 2.56 && s.fr.gld === 12, s);
  L.check('6. массив кораблей дорос до 5 без потери владения', s.owS.length === 5 && s.owS[0] === 1 && s.owS[2] === 1, s.owS);
  const mig = await page.evaluate(() => ({ A: localStorage.getItem('sf_sv2a') ? JSON.parse(localStorage.getItem('sf_sv2a')).v : null, legacyKept: !!localStorage.getItem('sf_sv') }));
  L.check('6. после загрузки записан формат v2, старый ключ не тронут', mig.A === 2 && mig.legacyKept, mig);

  console.log('\n[7] Повреждённые данные');
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForFunction(() => typeof SV !== 'undefined'); await startNew(page);
  await page.evaluate(() => { cr = 7777; stnDraw(); });   // слот A или B получит v2
  const sl = await page.evaluate(() => ({ A: localStorage.getItem('sf_sv2a'), B: localStorage.getItem('sf_sv2b') }));
  await page.evaluate(() => { cr = 8888; stnDraw(); });   // второй слот
  const sl2 = await page.evaluate(() => ({ A: localStorage.getItem('sf_sv2a'), B: localStorage.getItem('sf_sv2b') }));
  L.check('7a. оба слота заполнены (поочерёдная запись)', !!sl2.A && !!sl2.B && sl2.A !== sl2.B, { a: !!sl2.A, b: !!sl2.B });
  const newer = await page.evaluate(() => JSON.parse(localStorage.getItem('sf_sv2a')).q > JSON.parse(localStorage.getItem('sf_sv2b')).q ? 'sf_sv2a' : 'sf_sv2b');
  const older = newer === 'sf_sv2a' ? 'sf_sv2b' : 'sf_sv2a';
  await page.evaluate(k => localStorage.setItem(k, '{"v":2,"q":99,"c":"deadbeef","d":{"cr":1'), newer);   // обрыв JSON в самом новом слоте
  let r = await best(page);
  L.check('7b. обрезанный JSON в новом слоте -> берётся предыдущая копия', r && r.d.cr === 7777, r && r.d.cr);
  await page.evaluate(k => { const o = JSON.parse(localStorage.getItem(k)); o.d.cr = 99999999; localStorage.setItem(k, JSON.stringify(o)); }, older);   // правка без пересчёта суммы
  r = await best(page);
  L.check('7c. подмена данных с неверной контрольной суммой отвергается', r === null, r && r.d.cr);
  await page.evaluate(() => { localStorage.setItem('sf_sv2a', 'не json'); localStorage.setItem('sf_sv2b', '[]'); localStorage.setItem('sf_sv', '{"cr":"много"}'); });
  await page.reload(); await page.waitForFunction(() => typeof SV !== 'undefined');
  L.check('7d. всё повреждено: игра стартует, ПРОДОЛЖИТЬ скрыта, ошибок нет', await page.evaluate(() => { const c = document.getElementById('cont'); return !c || c.style.display === 'none'; }) && page.errors.length === 0, page.errors);
  await startNew(page);
  L.check('7e. после повреждения «ИГРАТЬ» без подтверждения и новая запись создаётся', (await page.evaluate(() => SV.has())) === true);

  console.log('\n[9] localStorage недоступен');
  const ctx2 = await L.newCtx(browser);
  await ctx2.addInitScript(() => { const boom = () => { throw new DOMException('denied', 'SecurityError'); }; Object.defineProperty(window, 'localStorage', { get: boom, configurable: true }); });
  const p2 = await L.openGame(ctx2);
  await p2.click('#play'); await p2.waitForFunction(() => state === 'dock'); await L.sleep(500);
  const inf = await p2.evaluate(() => SV.info());
  L.check('9. игра работает без localStorage, persist=false, ошибок нет', inf.persist === false && p2.errors.length === 0, { inf, errs: p2.errors });
  L.check('9. пользователь предупреждён (toast)', await p2.evaluate(() => { const t = document.getElementById('svt'); return !!t && /недоступно/.test(t.textContent); }));
  await p2.evaluate(() => { cr = 4242; stnDraw(); }); await p2.evaluate(() => lift()); await L.sleep(500); await p2.evaluate(() => pause(true)); await p2.click('#men1'); await L.sleep(300);
  L.check('9. в рамках сессии ПРОДОЛЖИТЬ работает через память', await p2.evaluate(() => { const c = document.getElementById('cont'); return !!c && c.style.display !== 'none'; }));
  await p2.click('#cont', { noWaitAfter: true }); await p2.waitForFunction(() => state === 'dock');
  L.check('9. значение восстановлено из памяти сессии', (await p2.evaluate(() => cr)) === 4242);
  await ctx2.close();

  console.log('\n[10] Автосохранение в полёте, смерть, скрытие вкладки');
  page = await L.openGame(ctx); await page.waitForSelector('#cont', { state: 'visible' }); await page.evaluate(() => document.getElementById('cont').click()); await page.waitForFunction(() => state === 'dock');
  await page.evaluate(() => lift()); await L.sleep(600);
  L.check('вылет: state=play', (await page.evaluate(() => state)) === 'play');
  const q0 = (await page.evaluate(() => SV.info())).seq;
  await page.evaluate(() => { hull -= 10; }); await L.sleep(2500);
  L.check('изменение только hull записи не вызывает', (await page.evaluate(() => SV.info())).seq === q0);
  await page.evaluate(() => { cr += 123; cargo[1] += 1; }); await L.sleep(7500);
  let dsk = await best(page);
  L.check('награда/груз в полёте сохраняются автоматически (<= ~6 c)', dsk && dsk.d.cr === (await page.evaluate(() => cr)) && dsk.d.cargo[1] === (await page.evaluate(() => cargo[1])), dsk && { cr: dsk.d.cr });
  const crSafe = await page.evaluate(() => cr);
  await page.evaluate(() => { state = 'dying'; cr = 1; cargo = [9, 9, 9, 9, 9]; }); await L.sleep(7000);
  dsk = await best(page);
  L.check('при гибели (dying) запись не перезаписывает последнее хорошее сохранение', dsk && dsk.d.cr === crSafe, dsk && dsk.d.cr);
  await page.evaluate(() => { state = 'play'; cr = crSafe + 50; cargo = [0, 0, 0, 0, 0]; });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  dsk = await best(page);
  L.check('уход вкладки в фон (visibilitychange) сохраняет немедленно', dsk && dsk.d.cr === crSafe + 50, dsk && dsk.d.cr);
  await page.evaluate(() => { delete document.hidden; });

  console.log('\n[11] Новая игра: подтверждение и резерв');
  await page.evaluate(() => pause(true)); await page.click('#men1'); await L.sleep(300);
  const crKeep = (await best(page)).d.cr;
  page.dialogHandler = d => d.dismiss(); await page.click('#play'); await L.sleep(300);
  L.check('отмена подтверждения: остаёмся в меню, сохранение цело', (await page.evaluate(() => state)) === 'menu' && (await best(page)).d.cr === crKeep, page.lastDialog);
  page.dialogHandler = d => d.accept(); await page.click('#play'); await page.waitForFunction(() => state === 'dock'); await L.sleep(300);
  const fresh = await page.evaluate(() => ({ cr, shp, arc: !!localStorage.getItem('sf_sv_arc') }));
  L.check('принято: новая игра (300 кр), старый прогресс в резервной копии', fresh.cr === 300 && fresh.shp === 0 && fresh.arc, fresh);
  const rest = await page.evaluate(() => { const ok = SV.restoreArchive(); const r = SV.load(); return { ok, cr: r.ok && r.d.cr }; });
  L.check('restoreArchive возвращает прошлый прогресс', rest.ok && rest.cr === crKeep, rest);

  console.log('\\n[12] Сбой записи резервной копии не должен уничтожать сохранение');
  await page.evaluate(() => { cr = 54321; stnDraw(); });
  const restoreFailure = await page.evaluate(() => {
    const target = SV.info().slot === 'sf_sv2a' ? 'sf_sv2b' : 'sf_sv2a';
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k,v) { if (k === target) throw new DOMException('quota', 'QuotaExceededError'); return original.call(this,k,v); };
    let ok; try { ok = SV.restoreArchive(); } finally { Storage.prototype.setItem = original; }
    const r = SV.load();
    return { ok, target, current: r.ok && r.d.cr, slot: SV.info().slot };
  });
  L.check('12a. ошибка записи архива не удаляет и не подменяет текущий слот', restoreFailure.ok === false && restoreFailure.current === 54321, restoreFailure);

  await page.evaluate(() => { if (state === 'dock') lift(); });
  await L.sleep(300);
  await page.evaluate(() => pause(true));
  await page.click('#men1');
  await page.waitForFunction(() => state === 'menu');
  const beforeFailedNewGame = await best(page);
  page.dialogHandler = d => d.accept();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.__sfOriginalSetItem = original;
    Storage.prototype.setItem = function(k,v) { if (k === 'sf_sv_arc') throw new DOMException('quota', 'QuotaExceededError'); return original.call(this,k,v); };
  });
  await page.click('#play');
  await L.sleep(250);
  const afterFailedNewGame = await best(page);
  const failedNewGameState = await page.evaluate(() => state);
  await page.evaluate(() => { const original = Storage.prototype.__sfOriginalSetItem; if (original) Storage.prototype.setItem = original; delete Storage.prototype.__sfOriginalSetItem; });
  L.check('12b. ошибка резервного копирования отменяет новую игру и сохраняет прежний прогресс', failedNewGameState === 'menu' && beforeFailedNewGame && afterFailedNewGame && beforeFailedNewGame.d.cr === afterFailedNewGame.d.cr, { state: failedNewGameState, before: beforeFailedNewGame && beforeFailedNewGame.d.cr, after: afterFailedNewGame && afterFailedNewGame.d.cr });
  L.check('нет ошибок страницы за весь прогон', page.errors.length === 0, page.errors);
  process.exitCode = L.summary(); await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
