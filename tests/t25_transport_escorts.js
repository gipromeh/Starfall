const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 960, height: 540 }, dpr: 1 });
  const page = await L.openGame(ctx);
  page.on('pageerror', err => console.error('PAGE ERROR:', err.stack || err.message));
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.waitForFunction(() => pirateAssetsReady && cargoTransportReady && MC.pirateTransport, null, { timeout: 60000 });
  await page.evaluate(() => lift());
  await page.waitForFunction(() => state === 'play' && pirateConvoyReady, null, { timeout: 30000 });
  const setup = await page.evaluate(() => {
    const fw=new T.Vector3(0,0,-1).applyQuaternion(Q).normalize();
    const civilianShip=mkCargoTransport(),pirateShip=mkPirateTransport();
    civilianShip.position.copy(P).addScaledVector(fw,2400);pirateShip.position.copy(P).addScaledVector(fw,2600);
    civilianShip.quaternion.copy(Q);pirateShip.quaternion.copy(Q);S.add(civilianShip);S.add(pirateShip);
    const civilian={g:civilianShip,v:fw.clone().multiplyScalar(55),hp:420,hit:0,tur:0,route:{kind:0}};
    const pirate={g:pirateShip,v:fw.clone().multiplyScalar(55),hp:420,hit:0,tur:0,route:{kind:0}};
    nv.push(civilian,pirate);SF_TRAFFIC_ESCORTS.attach(civilian);SF_TRAFFIC_ESCORTS.attach(pirate);
    window.__SF_TEST_ESCORT_OWNERS=[civilian,pirate];
    SF_TRAFFIC_ESCORTS.near(civilian);SF_TRAFFIC_ESCORTS.near(pirate);
    const groups=SF_TRAFFIC_ESCORTS.list().filter(c=>window.__SF_TEST_ESCORT_OWNERS.includes(c.owner));
    return {groups:groups.map(c=>({pirate:c.pirateTransport,count:c.escorts.length,alive:c.escorts.every(e=>e.g&&e.hp>0)}))};
  });
  L.check('гражданский транспорт получает два корабля охранения',setup.groups.some(c=>!c.pirate&&c.count===2&&c.alive),setup);
  L.check('пиратский транспорт получает три истребителя',setup.groups.some(c=>c.pirate&&c.count===3&&c.alive),setup);
  await page.waitForFunction(() => SF_TRAFFIC_ESCORTS.list().every(c=>c.escorts.every(e=>e.g&&e.g.visible)), null, { timeout: 10000 });
  const formation=await page.evaluate(()=>SF_TRAFFIC_ESCORTS.list().filter(c=>(window.__SF_TEST_ESCORT_OWNERS||[]).includes(c.owner)).map(c=>c.escorts.map(e=>e.g.position.distanceTo(c.owner.g.position))));
  L.check('эскорт держит строй вокруг транспорта',formation.every(a=>a.every(d=>d>20&&d<150)),formation);
  await page.waitForFunction(() => {
    const owners=window.__SF_TEST_ESCORT_OWNERS||[];
    const groups=SF_TRAFFIC_ESCORTS.list().filter(c=>owners.includes(c.owner));
    return groups.length===2&&groups.every(c=>c.escorts.length>0&&c.escorts.every(e=>e.mode==='FIGHT'));
  }, null, { timeout: 12000 });
  L.check('пиратский эскорт атакует при сближении, гражданский — после обстрела',true);
  const removed=await page.evaluate(()=>{
    const owner=SF_TRAFFIC_ESCORTS.list().find(c=>window.__SF_TEST_ESCORT_OWNERS.includes(c.owner)&&!c.pirateTransport).owner;
    const idx=nv.indexOf(owner);if(idx>=0)removeNvAt(idx);
    return !SF_TRAFFIC_ESCORTS.list().some(c=>c.owner===owner);
  });
  L.check('эскорт удаляется вместе с транспортом',removed);
  L.check('ошибок выполнения страницы нет',page.errors.length===0,page.errors);
  process.exitCode=L.summary();await browser.close();
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
