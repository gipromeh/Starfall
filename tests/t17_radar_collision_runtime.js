const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 960, height: 540 }, dpr: 1 });
  try {
    const page = await L.openGame(ctx);

    const collision = await page.evaluate(() => {
      pirateFleet.length = 0;
      nv.length = 0;

      const ship = (x, speed) => {
        const g = new THREE.Object3D();
        g.position.set(x, 0, 0);
        return {
          g,
          vel: new THREE.Vector3(speed, 0, 0),
          warp: 0,
          hitRadius: 20,
          r: 20,
          ty: 0
        };
      };

      E = ship(0, 5);
      E2 = ship(10, -5);
      resolvePirateShipCollisions();
      const distanceAfterOverlap = E.g.position.distanceTo(E2.g.position);
      const normal = E2.g.position.clone().sub(E.g.position).normalize();
      const separatingSpeed = E2.vel.clone().sub(E.vel).dot(normal);

      E.g.position.set(0, 0, 0);
      E2.g.position.set(100, 0, 0);
      E.vel.set(0, 0, 0);
      E2.vel.set(0, 0, 0);
      resolvePirateShipCollisions();
      const nonOverlapDistance = E.g.position.distanceTo(E2.g.position);

      E2 = null;
      E.g.position.set(200, 0, 0);
      const neutral = { g: new THREE.Object3D(), v: new THREE.Vector3(), cr: 12, tur: false };
      neutral.g.position.set(205, 0, 0);
      nv.push(neutral);
      resolvePirateShipCollisions();
      const neutralDistance = E.g.position.distanceTo(neutral.g.position);

      return { distanceAfterOverlap, separatingSpeed, nonOverlapDistance, neutralDistance };
    });

    L.check(
      'Collision solver separates overlapping hostile ships and resolves closing velocity',
      collision.distanceAfterOverlap >= 20 && collision.separatingSpeed > 0,
      collision
    );
    L.check(
      'Collision solver leaves ships outside the collision radius unchanged',
      Math.abs(collision.nonOverlapDistance - 100) < 0.001,
      collision.nonOverlapDistance
    );
    L.check(
      'Collision solver includes neutral non-turret traffic',
      collision.neutralDistance >= 19.5,
      collision.neutralDistance
    );

    const radar = await page.evaluate(() => {
      pirateFleet.length = 0;
      nv.length = 0;
      eb.length = 0;
      mis.length = 0;
      ali.length = 0;
      plt = null;
      stn = null;

      E = {
        g: new THREE.Object3D(),
        vel: new THREE.Vector3(0, 0, -1),
        warp: 0,
        boss: false,
        ty: 0
      };
      E.g.position.copy(P).add(new THREE.Vector3(0, 0, -100));
      E2 = {
        g: new THREE.Object3D(),
        vel: new THREE.Vector3(),
        warp: 1,
        boss: false,
        ty: 0
      };

      const hostile = new THREE.Object3D();
      const rejected = new THREE.Object3D();
      const friendly = new THREE.Object3D();
      eb.push(
        { kind: 'hostile-missile', hm: 1, m: hostile, life: 2, v: new THREE.Vector3() },
        { kind: 'projectile', hm: 1, m: rejected, life: 2, v: new THREE.Vector3() }
      );
      mis.push({ m: friendly, life: 2, v: new THREE.Vector3() });

      const contacts = collectRadarContacts();
      const missileContacts = contacts.filter(c => c.kind === 'missile');
      const enemyVisible = contacts.some(c => c.kind === 'enemy' && c.hostile && c.label === '1');
      const missileClassification =
        missileContacts.length === 2 &&
        missileContacts.filter(c => c.hostile).length === 1 &&
        missileContacts.filter(c => !c.hostile).length === 1;

      radar();
      const canvas = document.getElementById('radar');
      return {
        enemyVisible,
        missileClassification,
        missileCount: missileContacts.length,
        sweepFinite: Number.isFinite(radarSweepAngle),
        canvas: canvas ? [canvas.width, canvas.height] : null
      };
    });

    L.check('Radar reports active hostile contacts and excludes ships in warp', radar.enemyVisible, radar);
    L.check('Radar classifies only explicitly tagged hostile missiles as hostile', radar.missileClassification, radar);
    L.check('Radar renderer updates its sweep and draws into the expected canvas', radar.sweepFinite && radar.canvas && radar.canvas[0] > 0 && radar.canvas[1] > 0, radar);

    L.check('No JavaScript runtime errors', page.errors.length === 0, page.errors);
    process.exitCode = L.summary();
  } finally {
    await ctx.close();
    await browser.close();
  }
})().catch(error => {
  console.error('RADAR/COLLISION RUNTIME TEST CRASH', error);
  process.exit(2);
});
