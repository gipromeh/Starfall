const fs = require('node:fs');
const path = require('node:path');
const L = require('./lib');

(async()=>{
 const browser=await L.launch();
 const ctx=await L.newCtx(browser,{viewport:{width:800,height:450},dpr:1});
 await ctx.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb&&cb.name==='loop'?0:raf(cb);});
 const page=await L.openGame(ctx);
 try{
  await page.click('#play');
  await page.waitForFunction(()=>state==='dock',null,{timeout:60000});
  await page.waitForFunction(()=>pirateAssetsReady===true,null,{timeout:60000});
  const report=await page.evaluate(()=>{
   const DT=1/60,FRAMES=1200,TRIALS=12,rows=[];
   const originalShootLaser=shootLaser;
   let playerShots=0,hostileShots=0,enemyHitEvents=0,playerHitEvents=0,playerDamageReceived=0;
   const originalDamage=pirateFleetDamage,originalPlayerDamage=dmg,originalRandom=Math.random;
   pirateFleetDamage=function(e,d,missile){const before=e?.hp??0;originalDamage(e,d,missile);if(e&&e.hp<before)enemyHitEvents++;};
   dmg=function(n){playerHitEvents++;playerDamageReceived+=n*100/SHIPS[shp].hull;return originalPlayerDamage(n);};
   shootLaser=function(arr,...args){if(arr===bul)playerShots++;else if(arr===eb)hostileShots++;return originalShootLaser(arr,...args)};
   try{
    for(let trial=0;trial<TRIALS;trial++){
     if(state!=='dock')dock();
     lift();QL.setMode('low');pirateFleetInit();
     const seed=(0x4f1bbcdc+Math.imul(trial+1,0x9e3779b1))>>>0;
     let randomState=seed||1;Math.random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return(randomState>>>0)/4294967296;};
     EAI.seed(seed);
     Q.setFromEuler(new THREE.Euler((trial%3-1)*.035,(trial%4-1.5)*.055,0));
     rig.quaternion.copy(Q);P.set(0,0,0);vel.set(0,0,0);thl=0;thr=0;
     mouse.x=0;mouse.y=0;firing=true;fireT=0;heat=0;hot=false;
     hull=100;shield=100;used=1;sinceHit=0;
     pirateFleet.forEach(e=>{e.warp=0;e.g.visible=true;e.fire=0;e.burst=0;e.burstGap=0});
     playerShots=0;hostileShots=0;enemyHitEvents=0;playerHitEvents=0;playerDamageReceived=0;
     let frames=0;
     for(;frames<FRAMES&&state==='play';frames++)upd(DT);
     const active=pirateFleet.filter(e=>e.g&&e.hp>0);
     const enemyDamage=pirateFleet.reduce((sum,e)=>sum+Math.max(0,e.mx-e.hp),0);
     const enemyHits=enemyHitEvents;
     rows.push({trial,seed,simulated_seconds:+(frames*DT).toFixed(3),state,player_hull:+hull.toFixed(2),player_shield:+shield.toFixed(2),player_shots:playerShots,hostile_shots:hostileShots,player_hit_events:playerHitEvents,player_damage_received:+playerDamageReceived.toFixed(2),enemy_damage:+enemyDamage.toFixed(2),enemy_hits:enemyHits,active_enemies:active.length,enemy_states:pirateFleet.map(e=>e.state||'destroyed'),enemy_hp:pirateFleet.map(e=>e.hp)});
     firing=false;
     dock();
    }
   }finally{shootLaser=originalShootLaser;pirateFleetDamage=originalDamage;dmg=originalPlayerDamage;Math.random=originalRandom;firing=false;}
   return{schema:'starfall.production-combat-batch.v1',engine:'starfall.html v90 actual browser runtime; upd() including pirateFleetUpdate(), production projectile movement/collision and damage handlers',production_modified:false,frame_dt:DT,frames_per_trial:FRAMES,trials:TRIALS,results:rows,aggregate:{player_shots:rows.reduce((a,x)=>a+x.player_shots,0),hostile_shots:rows.reduce((a,x)=>a+x.hostile_shots,0),enemy_damage:+rows.reduce((a,x)=>a+x.enemy_damage,0).toFixed(2),enemy_hits:rows.reduce((a,x)=>a+x.enemy_hits,0),player_deaths:rows.filter(x=>x.state==='dying').length,enemy_wipes:rows.filter(x=>x.active_enemies===0).length,enemy_hit_events:rows.reduce((a,x)=>a+x.enemy_hits,0),player_hit_events:rows.reduce((a,x)=>a+x.player_hit_events,0),player_damage_received:+rows.reduce((a,x)=>a+x.player_damage_received,0).toFixed(2)}};
  });
  console.log('PRODUCTION_COMBAT_REPORT '+JSON.stringify(report));
  if(report.results.length!==12)throw new Error('Expected 12 production trials');
  if(report.aggregate.enemy_hits<1||report.aggregate.enemy_damage<=0)throw new Error('Production projectile collision path did not damage any pirate: '+JSON.stringify(report.aggregate));
  for(const r of report.results){for(const key of ['player_hull','player_shield','enemy_damage'])if(!Number.isFinite(r[key]))throw new Error('Non-finite combat state: '+JSON.stringify(r));if(r.player_shots<1)throw new Error('No player projectiles were produced: '+JSON.stringify(r));}
  fs.mkdirSync(path.join(__dirname,'..','artifacts'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'..','artifacts','production-combat.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  console.log('PASS production combat batch: 12 deterministic seeded trials, actual game update and projectile collision pipeline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
