const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 800, height: 450 }, dpr: 1 });
  const page = await L.openGame(ctx);
  await page.click('#play');
  await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
  await page.waitForFunction(() => cargoTransportReady === true, null, { timeout: 60000 });

  const result = await page.evaluate(async () => {
    const response = await fetch('assets/ships/catalog.json', { cache: 'no-cache' });
    const catalog = await response.json();
    const entry = catalog.ships.find(s => s.id === 'cargo_spaceship_001');
    const model = MC.cargoTransport;
    let meshes = 0;
    if (model) model.traverse(o => { if (o.isMesh) meshes++; });
    const bounds = model ? new THREE.Box3().setFromObject(model) : null;
    const size = bounds ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3();
    const oldRandom = Math.random;
    let traffic, convoy;
    try {
      Math.random = () => .1;
      traffic = mkFreighter();
      convoy = pcCargoModel();
    } finally {
      Math.random = oldRandom;
    }
    return {
      entry, loaded: !!model, meshes,
      maxDimension: Math.max(size.x, size.y, size.z),
      trafficCargo: !!traffic?.userData?.cargoTransport,
      convoyCargo: !!convoy?.userData?.cargoTransport,
      engineSockets: traffic?.starfallEngineNodes?.length || 0,
      ready: cargoTransportReady, loadError: cargoTransportLoadError
    };
  });
  L.check('Cargo Spaceship зарегистрирован в общем каталоге', !!result.entry && result.entry.model === 'model.glb' && result.entry.category === 'transport', result.entry);
  L.check('GLB загружен и содержит геометрию', result.loaded && result.meshes > 0, result);
  L.check('модель нормализована до 28 игровых единиц', Math.abs(result.maxDimension - 28) < .05, result.maxDimension);
  L.check('обычный нейтральный трафик использует Cargo Spaceship', result.trafficCargo, result);
  L.check('грузовой корабль каравана использует Cargo Spaceship', result.convoyCargo, result);
  L.check('двигательные сокеты созданы и подключены', result.engineSockets === 2, result.engineSockets);
  L.check('ошибок страницы нет', page.errors.length === 0, page.errors);
  process.exitCode = L.summary();
  await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(2); });
