const fs = require('node:fs');
const path = require('node:path');
const L = require('./lib');

(async () => {
  const browser = await L.launch();
  const ctx = await L.newCtx(browser, { viewport: { width: 800, height: 450 }, dpr: 1 });
  await ctx.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => cb && cb.name === 'loop' ? 0 : raf(cb);
  });
  const page = await L.openGame(ctx);
  try {
    await page.click('#play');
    await page.waitForFunction(() => state === 'dock', null, { timeout: 60000 });
    await page.waitForFunction(() => pirateAssetsReady === true, null, { timeout: 60000 });

    const report = await page.evaluate(() => {
      const DT = 1 / 60, FRAMES = 3600, TRIALS = 12, rows = [];
      const originalShootLaser = shootLaser;
      const originalDamage = pirateFleetDamage, originalPlayerDamage = dmg;
      const originalRandom = Math.random, originalFireGate = EAI.fireGate;
      let playerShots = 0, hostileShots = 0, enemyHitEvents = 0;
      let playerHitEvents = 0, playerDamageReceived = 0, fireGatePasses = 0;
      const slotShots = [0, 0];
      const countedHostileProjectiles = new WeakSet();

      pirateFleetDamage = function (e, damage, missile) {
        const before = e?.hp ?? 0;
        originalDamage(e, damage, missile);
        if (e && e.hp < before) enemyHitEvents++;
      };
      dmg = function (amount) {
        playerHitEvents++;
        playerDamageReceived += amount * 100 / SHIPS[shp].hull;
        return originalPlayerDamage(amount);
      };
      shootLaser = function (arr, ...args) {
        if (arr === bul) playerShots++;
        else if (arr === eb) {
          hostileShots++;

        }
        return originalShootLaser(arr, ...args);
      };
      EAI.fireGate = function (...args) {
        const allowed = originalFireGate(...args);
        if (allowed) fireGatePasses++;
        return allowed;
      };

      try {
        for (let trial = 0; trial < TRIALS; trial++) {
          if (state !== 'dock') dock();
          lift();
          QL.setMode('low');
          pirateFleetInit();

          const seed = (0x4f1bbcdc + Math.imul(trial + 1, 0x9e3779b1)) >>> 0;
          let randomState = seed || 1;
          Math.random = () => {
            randomState ^= randomState << 13;
            randomState ^= randomState >>> 17;
            randomState ^= randomState << 5;
            return (randomState >>> 0) / 4294967296;
          };
          EAI.seed(seed);

          Q.setFromEuler(new THREE.Euler((trial % 3 - 1) * .035, (trial % 4 - 1.5) * .055, 0));
          rig.quaternion.copy(Q);
          P.set(0, 0, 0);
          vel.set(0, 0, 0);
          thl = 0;
          thr = 0;
          mouse.x = 0;
          mouse.y = 0;
          firing = true;
          for (const key of Object.keys(keys)) keys[key] = false;
          fireT = 0;
          heat = 0;
          hot = false;
          hull = 100;
          shield = 100;
          used = 1;
          sinceHit = 0;

          pirateFleet.forEach(e => {
            e.warp = 0;
            e.g.visible = true;
            e.fire = 0;
            e.burst = 0;
            e.burstGap = 0;
            e.aiIntent = 'ATTACK';
            e.state = 'ATTACK';
          });

          playerShots = 0;
          hostileShots = 0;
          enemyHitEvents = 0;
          playerHitEvents = 0;
          playerDamageReceived = 0;
          fireGatePasses = 0;
          slotShots[0] = 0;
          slotShots[1] = 0;

          let attackFrames = 0, evadeFrames = 0, reengageTransitions = 0;
          let maneuverFrames = 0, pathLength = 0, maxSpeed = 0;
          const previousPlayerPosition = P.clone();
          let previousStates = pirateFleet.map(e => e.aiIntent);
          let frames = 0;
          for (; frames < FRAMES && state === 'play'; frames++) {
            const phase = Math.floor(frames / 90) % 4;
            keys.KeyA = phase === 0; keys.KeyD = phase === 2;
            keys.KeyR = phase === 1; keys.KeyC = phase === 3;
            keys.KeyW = false; keys.KeyS = false; thl = 0.72;
            mouse.x = Math.sin(frames * 0.013 + trial * 0.71) * 0.34;
            mouse.y = Math.sin(frames * 0.009 + trial * 1.13) * 0.22;
            maneuverFrames++;
            upd(DT);
            pathLength += P.distanceTo(previousPlayerPosition);
            previousPlayerPosition.copy(P);
            maxSpeed = Math.max(maxSpeed, vel.length());
            for (const projectile of eb) {
              if (projectile.pirateFleet && !countedHostileProjectiles.has(projectile)) {
                countedHostileProjectiles.add(projectile);
                const slot = projectile.pirateFleetSlot;
                if (slot === 0 || slot === 1) slotShots[slot]++;
              }
            }
            for (let i = 0; i < pirateFleet.length; i++) {
              const e = pirateFleet[i];
              if (e.aiIntent === 'ATTACK') attackFrames++;
              if (e.aiIntent === 'EVADE') evadeFrames++;
              if (previousStates[i] === 'EVADE' && e.aiIntent === 'ATTACK') reengageTransitions++;
              previousStates[i] = e.aiIntent;
            }
          }

          const active = pirateFleet.filter(e => e.g && e.hp > 0);
          const enemyDamage = pirateFleet.reduce((sum, e) => sum + Math.max(0, e.mx - e.hp), 0);
          rows.push({
            trial, seed, simulated_seconds: +(frames * DT).toFixed(3), state,
            maneuver_frames: maneuverFrames, path_length: +pathLength.toFixed(2), max_speed: +maxSpeed.toFixed(2),
            player_hull: +hull.toFixed(2), player_shield: +shield.toFixed(2),
            player_shots: playerShots, hostile_shots: hostileShots,
            hostile_shots_by_slot: [...slotShots], fire_gate_passes: fireGatePasses,
            player_hit_events: playerHitEvents,
            player_damage_received: +playerDamageReceived.toFixed(2),
            enemy_damage: +enemyDamage.toFixed(2), enemy_hits: enemyHitEvents,
            active_enemies: active.length, attack_frames: attackFrames,
            evade_frames: evadeFrames, reengage_transitions: reengageTransitions,
            enemy_states: pirateFleet.map(e => e.state || 'destroyed'),
            enemy_intents: pirateFleet.map(e => e.aiIntent || 'none'),
            enemy_hp: pirateFleet.map(e => e.hp)
          });
          firing = false;
          dock();
        }
      } finally {
        shootLaser = originalShootLaser;
        pirateFleetDamage = originalDamage;
        dmg = originalPlayerDamage;
        EAI.fireGate = originalFireGate;
        Math.random = originalRandom;
        firing = false;
      }

      return {
        schema: 'starfall.v92-maneuver-combat-validation.v1',
        engine: 'STARFALL_CURRENT.html v92+ browser runtime; production upd(), pirateFleetUpdate(), projectile collision and damage handlers',
        production_modified: false,
        frame_dt: DT, frames_per_trial: FRAMES, trials: TRIALS, results: rows,
        aggregate: {
          player_shots: rows.reduce((a, x) => a + x.player_shots, 0),
          hostile_shots: rows.reduce((a, x) => a + x.hostile_shots, 0),
          hostile_shots_by_slot: [0, 1].map(i => rows.reduce((a, x) => a + x.hostile_shots_by_slot[i], 0)),
          fire_gate_passes: rows.reduce((a, x) => a + x.fire_gate_passes, 0),
          enemy_damage: +rows.reduce((a, x) => a + x.enemy_damage, 0).toFixed(2),
          enemy_hits: rows.reduce((a, x) => a + x.enemy_hits, 0),
          player_hit_events: rows.reduce((a, x) => a + x.player_hit_events, 0),
          player_damage_received: +rows.reduce((a, x) => a + x.player_damage_received, 0).toFixed(2),
          player_deaths: rows.filter(x => x.state === 'dying').length,
          enemy_wipes: rows.filter(x => x.active_enemies === 0).length,
          trials_with_hostile_fire: rows.filter(x => x.hostile_shots > 0).length,
          trials_with_reengagement: rows.filter(x => x.reengage_transitions > 0).length,
          trials_survived_60s: rows.filter(x => x.simulated_seconds >= 59.9 && x.state === 'play').length,
          mean_survival_seconds: +(rows.reduce((a, x) => a + x.simulated_seconds, 0) / rows.length).toFixed(2),
          total_maneuver_frames: rows.reduce((a, x) => a + x.maneuver_frames, 0),
          mean_path_length: +(rows.reduce((a, x) => a + x.path_length, 0) / rows.length).toFixed(2),
          mean_max_speed: +(rows.reduce((a, x) => a + x.max_speed, 0) / rows.length).toFixed(2)
        }
      };
    });

    fs.mkdirSync(path.join(__dirname, '..', 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '..', 'artifacts', 'v92-maneuver-combat.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));

    if (report.results.length !== 12) throw new Error('Expected 12 production trials');
    if (report.aggregate.enemy_hits < 1 || report.aggregate.enemy_damage <= 0) {
      throw new Error('Production projectile collision path did not damage pirates: ' + JSON.stringify(report.aggregate));
    }
    if (report.aggregate.hostile_shots <= 0 || report.aggregate.fire_gate_passes <= 0) {
      throw new Error('Production pirate firing path was never exercised: ' + JSON.stringify(report.aggregate));
    }
    if (report.aggregate.trials_with_hostile_fire < 6) {
      throw new Error('Hostile fire was absent in too many deterministic trials: ' + JSON.stringify(report.aggregate));
    }
    if (report.aggregate.trials_with_reengagement < 6) {
      throw new Error('Pirate AI failed to re-engage after evasion in enough trials: ' + JSON.stringify(report.aggregate));
    }
    if (report.aggregate.hostile_shots_by_slot.some(count => count <= 0)) {
      throw new Error('Both pirate fleet slots must exercise hostile firing: ' + JSON.stringify(report.aggregate));
    }
    for (const r of report.results) {
      for (const key of ['player_hull', 'player_shield', 'enemy_damage']) {
        if (!Number.isFinite(r[key])) throw new Error('Non-finite combat state: ' + JSON.stringify(r));
      }
      if (r.player_shots < 1) throw new Error('No player projectiles were produced: ' + JSON.stringify(r));
      if (r.simulated_seconds < 59.9 && r.state === 'play') throw new Error('Trial ended before its fixed horizon: ' + JSON.stringify(r));
    }

    if (report.aggregate.total_maneuver_frames < 12 * 60) throw new Error('Maneuver input was not applied: ' + JSON.stringify(report.aggregate));
    if (report.aggregate.mean_path_length <= 100 || report.aggregate.mean_max_speed <= 1) throw new Error('Player movement was not measurable: ' + JSON.stringify(report.aggregate));
    console.log('PASS v92 active-maneuver production combat validation');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
