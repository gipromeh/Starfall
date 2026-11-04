const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 960, height: 540 }, dpr: 1 });
  const page = await L.openGame(ctx);

  await page.waitForFunction(() => typeof civilianArgoTemplate !== 'undefined' && !!civilianArgoTemplate, null, { timeout: 60000 });
  const argo = await page.evaluate(() => {
    const instance = mkFreighter();
    const bounds = new THREE.Box3().setFromObject(instance);
    const size = bounds.getSize(new THREE.Vector3());
    let triangles = 0, meshes = 0;
    instance.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      meshes++;
      const index = o.geometry.index;
      triangles += index ? index.count / 3 : (o.geometry.attributes.position?.count || 0) / 3;
    });
    const result = {
      model: instance.userData.trafficModel,
      isClone: instance !== civilianArgoTemplate,
      maxDimension: Math.max(size.x, size.y, size.z),
      meshes,
      triangles
    };
    S.remove(instance);
    return result;
  });
  L.check('main civilian traffic instantiates the NASA Argo GLB clone', argo.model === 'nasa-argo' && argo.isClone && argo.meshes > 0, argo);
  L.check('Argo is normalized to the civilian freighter envelope', argo.maxDimension > 95 && argo.maxDimension < 101, argo);
  L.check('Argo stays inside the expected mobile geometry budget', argo.triangles > 8000 && argo.triangles < 11000, argo);

  await page.evaluate(() => makePlanet());
  await page.waitForFunction(() => !!(stn && stn.userData.nasaBaseStationAttached), null, { timeout: 60000 });
  const station = await page.evaluate(() => ({
    attached: !!stn.userData.nasaBaseStationAttached,
    pending: !!stn.userData.nasaBaseStationPending,
    stationVisible: !!stn.visible,
    children: stn.children.length
  }));
  L.check('NASA Base Station is attached to the active orbital station', station.attached && !station.pending && station.children > 0, station);

  await browser.close();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
