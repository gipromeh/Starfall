const assert = require('node:assert/strict');
const L = require('./lib');
const { createEAI } = require('../tools/combat-ai-lab/elite-eai.mjs');

const close = (a,b,eps=1e-8) => Math.abs(a-b) <= eps;
const closeVec = (a,b,eps=1e-8) => a.length===b.length && a.every((v,i)=>close(v,b[i],eps));
function cases(){
  const out=[];
  for(let i=0;i<32;i++){
    const f=[Math.sin(i*.71)+.13,Math.cos(i*.37)-.21,Math.sin(i*.19+1)];
    const d=[Math.cos(i*.43+0.2)*2,Math.sin(i*.29-0.3)*3,Math.cos(i*.17+0.7)*4];
    const hd=[Math.sin(i*.31)+.2,Math.cos(i*.23)-.1,Math.sin(i*.41+1)];
    const vel=[Math.cos(i*.2)*20,Math.sin(i*.3)*5,-15-i*.4];
    out.push({f,d,hd,vel,pos:[i*.7,-i*.2,i*.11],speed:Math.hypot(...vel),distance:50+i*17,options:{speed:35+i*.8,acceleration:30+i,turnRate:.7+i*.03},dt:1/60});
  }
  return out;
}
(async()=>{
 const browser=await L.launch();
 const ctx=await L.newCtx(browser,{viewport:{width:800,height:450},dpr:1});
 const page=await L.openGame(ctx);
 try{
  const input=cases(),node=createEAI(0x7a11ce55);
  const expected=input.map(c=>{
   const direction=c.d,forward=c.f;
   const projection=node.project(direction,forward),ocs=node.projectOCS(direction,forward);
   const e={hd:[...c.hd],vel:[...c.vel],position:[...c.pos],speed:c.speed};
   node.command(e,direction,c.distance,c.options);
   node.integrate(e,c.dt);
   return{projection,ocs,hd:e.hd,vel:e.vel,position:e.position,speed:e.speed,yaw:e.ocsYaw,pitch:e.ocsPitch,accel:e.ocsAccel,targetSpeed:e.ocsTargetSpeed};
  });
  const actual=await page.evaluate(input=>{
   const out=input.map(c=>{
    const v=a=>new THREE.Vector3(...a);
    const direction=v(c.d),forward=v(c.f);
    const p=EAI.project(direction,forward),o=EAI.projectOCS(direction,forward);
    const e={hd:v(c.hd),vel:v(c.vel),speed:c.speed};
    const object={position:v(c.pos)};
    EAI.command(e,direction,c.distance,c.options);
    EAI.integrate(e,c.dt,object);
    return{projection:p,ocs:o,hd:e.hd.toArray(),vel:e.vel.toArray(),position:object.position.toArray(),speed:e.speed,yaw:e.ocsYaw,pitch:e.ocsPitch,accel:e.ocsAccel,targetSpeed:e.ocsTargetSpeed};
   });
   EAI.seed(0x7a11ce55);const random=Array.from({length:32},()=>EAI.rand());
   const phaseA={aiClock:0},phaseB={aiClock:EAI.STEP/2};let ticksA=0,ticksB=0;
   for(let i=0;i<8;i++){if(EAI.think(phaseA,1/60))ticksA++;if(EAI.think(phaseB,1/60))ticksB++}
   const old=EAI.rand;EAI.seed(0x7a11ce55);const gates=[];
   try{for(let i=0;i<16;i++){const h=(i%4-1.5)*.12,d=-.5-(i%3)*.01;gates.push(EAI.fireGate({h,l:0,d},80+i*12,420,.65,i%2===0));}}
   finally{EAI.rand=old;}
   return{out,random,ticksA,ticksB,gates};
  },input);
  assert.equal(actual.out.length,expected.length);
  for(let i=0;i<expected.length;i++){
   const a=actual.out[i],e=expected[i];
   for(const key of ['projection','ocs'])for(const k of Object.keys(e[key]))assert.ok(close(a[key][k],e[key][k]),`case ${i} ${key}.${k}: ${a[key][k]} != ${e[key][k]}`);
   for(const key of ['hd','vel','position'])assert.ok(closeVec(a[key],e[key]),`case ${i} ${key}: ${a[key]} != ${e[key]}`);
   for(const key of ['speed','yaw','pitch','accel','targetSpeed'])assert.ok(close(a[key],e[key]),`case ${i} ${key}: ${a[key]} != ${e[key]}`);
  }
  const n=createEAI(0x7a11ce55),random=Array.from({length:32},()=>n.rand());
  assert.ok(closeVec(actual.random,random));
  assert.equal(actual.ticksA,2);assert.equal(actual.ticksB,2);
  n.seed(0x7a11ce55);const gates=[];
  for(let i=0;i<16;i++){const h=(i%4-1.5)*.12,d=-.5-(i%3)*.01;gates.push(n.fireGate({h,l:0,d},80+i*12,420,.65,i%2===0));}
  assert.deepEqual(actual.gates,gates);
  console.log('PASS production EAI parity: 32 vector/command/integration cases, 32 PRNG outputs, decision cadence and 16 fire-gate cases');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
