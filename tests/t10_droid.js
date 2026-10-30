// v46: обе пиратские GLB-модели и обязательная пара в первой волне
const L = require('./lib');
(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 800, height: 450 } });
  const page = await L.openGame(ctx);
  await page.waitForFunction(() => {
    const a=mkPirate(0), b=mkPirate(1); let am=0,bm=0;
    a.traverse(o=>{if(o.isMesh)am++}); b.traverse(o=>{if(o.isMesh)bm++});
    return a.scale.x===.75 && am===3 && b.scale.x===1 && bm>0 && bm<40;
  }, null, { timeout: 90000, polling: 500 });
  const models = await page.evaluate(() => [0,1].map(t => {
    const g=mkPirate(t);let meshes=0,tris=0;
    g.traverse(o=>{if(o.isMesh){meshes++;if(o.geometry.index)tris+=o.geometry.index.count/3}});
    const box=new THREE.Box3().setFromObject(g),size=box.getSize(new THREE.Vector3());
    return {type:t,meshes,tris:Math.round(tris),scale:g.scale.x,size:[size.x,size.y,size.z].map(v=>+v.toFixed(1))};
  }));
  L.check('10A. «Ржавый череп» загружен как тип 0 (3 меша, scale 0.75)', models[0].meshes===3 && models[0].scale===.75, models[0]);
  L.check('10B. «Шакал» загружен как тип 1 (объединённая GLB, <40 мешей)', models[1].meshes>0 && models[1].meshes<40 && models[1].scale===1, models[1]);

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 90000 });
  await page.evaluate(() => lift());
  for(let i=0;i<100;i++) await page.evaluate(() => upd(.05));
  const pair=await page.evaluate(()=>({
    first:E&&E.ty, second:E2&&E2.ty, count:enc, firstWaveSpawn,
    firstPending:firstWavePending, assetsReady:pirateAssetsReady,
    firstMeshes:(()=>{let n=0;if(E)E.g.traverse(o=>{if(o.isMesh)n++});return n})(),
    secondMeshes:(()=>{let n=0;if(E2)E2.g.traverse(o=>{if(o.isMesh)n++});return n})()
  }));
  L.check('10C. первая волна гарантированно начинает «Ржавый череп» (тип 0)', pair.first===0 && pair.firstMeshes===3, pair);
  L.check('10D. в первой волне обязательно появляется «Шакал» (тип 1)', pair.second===1 && pair.secondMeshes>0 && pair.secondMeshes<40 && pair.firstWaveSpawn===2 && pair.firstPending===false && pair.assetsReady, pair);

  const errors=page.errors.slice();
  L.check('10E. нет ошибок JavaScript при загрузке и спавне', errors.length===0, errors);
  await browser.close();
  process.exit(L.summary() ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
