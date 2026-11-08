const L = require('./lib');
(async () => {
 const browser=await L.launch();
 const ctx=await L.newCtx(browser,{viewport:{width:960,height:540},dpr:1});
 const page=await L.openGame(ctx);
 page.on('pageerror',err=>console.error('PAGE ERROR:',err.stack||err.message));
 await page.click('#play',{noWaitAfter:true});
 await page.waitForFunction(()=>state==='dock',null,{timeout:60000});
 await page.evaluate(()=>{lift();QL.setMode('low');pirateFleetInit()});
 await page.waitForFunction(()=>state==='play'&&pirateFleet.length===2,null,{timeout:20000});
 const result=await page.evaluate(()=>{
  const Y=window.YUKA,originalUpdate=Y.Vehicle.prototype.update;let vehicleUpdates=0;
  Y.Vehicle.prototype.update=function(delta){vehicleUpdates++;return originalUpdate.call(this,delta)};
  const makePilot=(hp=100)=>({slot:99,ty:0,hp,mx:100,g:{position:new THREE.Vector3(0,0,0),quaternion:new THREE.Quaternion()},vel:new THREE.Vector3(),hd:new THREE.Vector3(0,0,-1)});
  const target={position:new THREE.Vector3(200,0,0),velocity:new THREE.Vector3(),quaternion:new THREE.Quaternion()};
  const opts={mode:'combat',targetDetected:true,distance:200,fireRange:400,weaponReady:true,speed:52,acceleration:80,turnRate:30};
  const probes=[];
  try{
   const attacker=makePilot();probes.push(attacker);const before=attacker.g.position.clone();
   const attack=SF_YUKA_PIRATE_AI.update(attacker,1/15+1e-5,target,opts),movement=before.distanceTo(attacker.g.position);
   const attackInfo=SF_YUKA_PIRATE_AI.inspect(attacker);
   const facing=new THREE.Vector3(0,0,-1).applyQuaternion(attacker.g.quaternion).normalize();
   const orientationAlignment=facing.dot(attacker.vel.clone().normalize());
   const evader=makePilot();probes.push(evader);
   const threat={position:new THREE.Vector3(0,0,42),velocity:new THREE.Vector3(0,0,-120)};
   const evade=SF_YUKA_PIRATE_AI.update(evader,1/15+1e-5,target,{...opts,threat,threatRadius:220});
   const retreat=makePilot(10);probes.push(retreat);
   const retreatResult=SF_YUKA_PIRATE_AI.update(retreat,1/15+1e-5,target,opts);
   const patrol=makePilot();probes.push(patrol);
   const patrolResult=SF_YUKA_PIRATE_AI.update(patrol,1/15+1e-5,target,{...opts,mode:'patrol',targetDetected:false});
   const formation=makePilot();probes.push(formation);
   const formationResult=SF_YUKA_PIRATE_AI.update(formation,1/15+1e-5,target,{...opts,mode:'formation',targetDetected:false});
   const neighbors=[makePilot(),makePilot()];probes.push(...neighbors);
   const wing=makePilot();probes.push(wing);
   SF_YUKA_PIRATE_AI.update(wing,1/15+1e-5,target,{...opts,mode:'formation',targetDetected:false,neighbors});
   const wingInfo=SF_YUKA_PIRATE_AI.inspect(wing);
   const output={decisionLayer:SF_YUKA_DECISION.version,adapter:SF_STARFALL_YUKA_ADAPTER.version,thinkType:attackInfo.thinkType,
    attack:attack.intent,evade:evade.intent,retreat:retreatResult.intent,patrol:patrolResult.intent,formation:formationResult.intent,
    movement,decisionTicks:attackInfo.decisionTicks,adapterTicks:attackInfo.adapterTicks,orientationAlignment,
    neighborCount:wingInfo.neighborCount,vehicleUpdates,orientationAuthority:SF_STARFALL_YUKA_ADAPTER.orientationAuthority};
   for(const entity of probes)SF_YUKA_PIRATE_AI.reset(entity);
   return output;
  }finally{if(originalUpdate)Y.Vehicle.prototype.update=originalUpdate;else delete Y.Vehicle.prototype.update}
 });
 L.check('Yuka Think arbitrate() формирует стратегические намерения',result.decisionLayer==='1.0.0'&&result.thinkType==='Think'&&result.attack==='ATTACK',result);
 L.check('Decision Layer выбирает EVADE при входящем снаряде и RETREAT при критическом корпусе',result.evade==='EVADE'&&result.retreat==='RETREAT',result);
 L.check('Decision Layer различает PATROL и FORM',result.patrol==='PATROL'&&result.formation==='FORM',result);
 L.check('Starfall Adapter интегрирует позицию и quaternion; Yuka Vehicle.update не вызывается',
  result.movement>0&&result.adapter==='1.0.0'&&result.adapterTicks===1&&result.vehicleUpdates===0&&result.orientationAuthority==='STARFALL'&&result.orientationAlignment>.9,result);
 L.check('Yuka Steering Layer учитывает соседей эскадрильи',result.neighborCount===2,result);
 await page.waitForFunction(()=>pirateFleet.every(e=>e.g&&e.warp<=0&&e.yukaPilot&&SF_YUKA_PIRATE_AI.inspect(e)?.decisionTicks>0),null,{timeout:30000});
 const live=await page.evaluate(()=>{
  const fleet=pirateFleet;
  return {count:fleet.length,ready:fleet.every(e=>e.yukaPilot&&SF_YUKA_PIRATE_AI.inspect(e)?.thinkType==='Think'),
   adapterTicks:fleet.map(e=>SF_YUKA_PIRATE_AI.inspect(e)?.adapterTicks||0),
   decisionTicks:fleet.map(e=>SF_YUKA_PIRATE_AI.inspect(e)?.decisionTicks||0)};
 });
 L.check('живая эскадрилья использует единый Yuka Decision → Steering → Starfall Adapter цикл',
  live.count===2&&live.ready&&live.adapterTicks.every(n=>n>0)&&live.decisionTicks.every(n=>n>0),live);
 L.check('ошибок выполнения страницы нет',page.errors.length===0,page.errors);
 process.exitCode=L.summary();await browser.close();
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
