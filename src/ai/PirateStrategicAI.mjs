import assert from 'node:assert/strict';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const copyPosition=p=>({x:Number.isFinite(Number(p?.x))?Number(p.x):0,y:Number.isFinite(Number(p?.y))?Number(p.y):0,z:Number.isFinite(Number(p?.z))?Number(p.z):0});

/**
 * Strategic simulation for pirate groups outside the active combat bubble.
 * It stores abstract world positions and never creates Three.js objects.
 */
export function createPirateStrategicAI({seed=0x51fa11,maxGroups=48,maxShips=6,decisionInterval=2}={}) {
  const groups=new Map();
  let rngState=initialSeed;
  const initialSeed=(seed>>>0)||0x51fa11;
  let clock=0,nextId=1,worldTime=0;
  const roles=['raider','interceptor','ambusher','smuggler'];
  const states=new Set(['patrol','intercept','raid','retreat','return','disabled']);
  const rand=()=>{rngState^=rngState<<13;rngState^=rngState>>>17;rngState^=rngState<<5;return(rngState>>>0)/4294967296;};
  const makeId=()=> 'pirate-'+(nextId++).toString(36);
  function normalizeGroup(input={}) {
    const id=typeof input.id==='string'&&input.id?input.id:makeId();
    const requestedShips=Number(input.ships??2);
    if(!Number.isInteger(requestedShips)||requestedShips<1||requestedShips>maxShips)throw new RangeError('ships must be an integer between 1 and '+maxShips);
    const position=copyPosition(input.position),velocity=copyPosition(input.velocity);
    const finite=(value,fallback,min,max)=>clamp(Number.isFinite(Number(value))?Number(value):fallback,min,max);
    const state=states.has(input.state)?input.state:'patrol';
    const role=roles.includes(input.role)?input.role:'raider';
    return {id,faction:String(input.faction||'freebooters'),role,state,ships:requestedShips,
      position,velocity,targetId:input.targetId==null?null:String(input.targetId),homeId:input.homeId==null?null:String(input.homeId),
      aggression:finite(input.aggression,.65,0,1),morale:finite(input.morale,.8,0,1),
      hull:finite(input.hull,1,0,1),cargo:finite(input.cargo,0,0,1e9),
      cooldown:finite(input.cooldown,0,0,1e6),seed:(input.seed>>>0)||Math.floor(rand()*0xffffffff),
      lastDecision:finite(input.lastDecision,0,0,1e12),kills:Math.trunc(finite(input.kills,0,0,1e9))};
  }
  function addGroup(input) {
    if(groups.size>=maxGroups)throw new Error('Pirate strategic group capacity reached');
    const g=normalizeGroup(input);
    if(groups.has(g.id))throw new Error('Duplicate pirate group id: '+g.id);
    groups.set(g.id,g);return snapshotGroup(g);
  }
  function snapshotGroup(g) { return {...g,position:{...g.position},velocity:{...g.velocity}}; }
  function removeGroup(id) { return groups.delete(id); }
  function transition(g,state,reason) { if(g.state!==state){g.state=state;g.lastReason=reason;g.cooldown=.8;} }
  function chooseTarget(g,contacts) {
    let best=null,bestScore=-Infinity;
    for(const c of contacts) {
      if(!c||!c.id||c.faction===g.faction||c.destroyed)continue;
      const p=copyPosition(c.position),d=distance(g.position,p);
      const value=(Number(c.value)||0)*.35+(Number(c.vulnerability)||.5)*.3+(Number(c.tradeRouteRisk)||0)*.25+g.aggression*.2-d/100000;
      if(d>180000||value<=bestScore)continue;
      best={id:String(c.id),position:p,velocity:copyPosition(c.velocity),distance:d,score:value};bestScore=value;
    }
    return best;
  }
  function decide(g,context) {
    if(g.state==='disabled')return;
    const threat=Number(context.threatByGroup?.[g.id]||0);
    const damage=1-g.hull;
    if(damage>.72||g.morale<.18||threat>g.ships*1.35){transition(g,'retreat','loss-risk');return;}
    if(g.state==='retreat'||g.state==='return'){
      if(g.homeId&&context.homePositions?.[g.homeId]){
        const home=copyPosition(context.homePositions[g.homeId]);
        if(distance(g.position,home)<5000){transition(g,'patrol','reached-safe-haven');g.targetId=null;return;}
        transition(g,'return','return-to-safe-haven');g.targetId=g.homeId;return;
      }
      transition(g,'retreat','no-home-known');return;
    }
    const target=chooseTarget(g,context.contacts||[]);
    if(target&&target.score>.15&&g.ships>=1){
      g.targetId=target.id;
      transition(g,g.role==='ambusher'?'ambush':'intercept','profitable-contact');
    } else {
      g.targetId=null;
      if(g.state!=='patrol')transition(g,'patrol','no-profitable-contact');
    }
  }
  function integrate(g,dt,context) {
    const target=g.targetId&&(context.contacts||[]).find(c=>c.id===g.targetId);
    if(g.state==='disabled')return;
    let desired={x:0,y:0,z:0};
    if(g.state==='intercept'||g.state==='ambush'||g.state==='raid') {
      const point=target?copyPosition(target.position):g.position;
      const offset={x:point.x-g.position.x,y:point.y-g.position.y,z:point.z-g.position.z};
      const len=Math.hypot(offset.x,offset.y,offset.z)||1;
      desired={x:offset.x/len,y:offset.y/len,z:offset.z/len};
    } else if(g.state==='return'&&g.homeId&&context.homePositions?.[g.homeId]) {
      const p=copyPosition(context.homePositions[g.homeId]),dx=p.x-g.position.x,dy=p.y-g.position.y,dz=p.z-g.position.z,n=Math.hypot(dx,dy,dz)||1;
      desired={x:dx/n,y:dy/n,z:dz/n};
    } else if(g.state==='retreat') {
      const p=g.homeId&&context.homePositions?.[g.homeId]?copyPosition(context.homePositions[g.homeId]):g.position;
      const dx=g.position.x-p.x,dy=g.position.y-p.y,dz=g.position.z-p.z,n=Math.hypot(dx,dy,dz)||1;
      desired={x:dx/n,y:dy/n,z:dz/n};
    } else {
      const phase=worldTime*.07+(g.seed%10000)*.001;
      desired={x:Math.cos(phase),y:Math.sin(phase*.37)*.12,z:Math.sin(phase)};
    }
    const speed=g.state==='retreat'||g.state==='return'?420:g.state==='patrol'?180:320;
    g.velocity.x+=(desired.x*speed-g.velocity.x)*Math.min(1,dt*.8);
    g.velocity.y+=(desired.y*speed-g.velocity.y)*Math.min(1,dt*.8);
    g.velocity.z+=(desired.z*speed-g.velocity.z)*Math.min(1,dt*.8);
    g.position.x+=g.velocity.x*dt;g.position.y+=g.velocity.y*dt;g.position.z+=g.velocity.z*dt;
    g.cooldown=Math.max(0,g.cooldown-dt);
  }
  function update(dt,context={}) {
    if(!Number.isFinite(dt)||dt<0)throw new TypeError('dt must be a finite non-negative number');
    if(!context||typeof context!=='object'||Array.isArray(context))throw new TypeError('context must be an object');
    const step=Math.min(dt,30);worldTime+=step;clock+=step;
    const interval=clamp(decisionInterval,.25,10);let decisions=0;
    while(clock>=interval){clock-=interval;decisions++;}
    for(const g of groups.values())integrate(g,step,context);
    if(decisions){
      const snapshot={...context,contacts:Array.isArray(context.contacts)?context.contacts:[]};
      for(const g of groups.values())decide(g,snapshot);
    }
    return {groups:groups.size,decisions,worldTime};
  }
  function snapshot(){return {version:1,seed:initialSeed,rngState,nextId,worldTime,clock,groups:[...groups.values()].map(snapshotGroup)};}
  function restore(data){
    if(!data||data.version!==1||!Array.isArray(data.groups)||data.groups.length>maxGroups)throw new TypeError('Invalid pirate strategic save');
    const next=new Map();
    for(const row of data.groups){
      if(!row||typeof row.id!=='string'||!row.id||!states.has(row.state)||!roles.includes(row.role)||!Number.isInteger(row.ships)||row.ships<1||row.ships>maxShips)throw new TypeError('Invalid saved pirate group');
      for(const key of ['aggression','morale','hull','cargo','cooldown','lastDecision','kills'])if(!Number.isFinite(Number(row[key])))throw new TypeError('Invalid saved pirate group field: '+key);
      for(const key of ['x','y','z'])if(!Number.isFinite(Number(row.position?.[key]))||!Number.isFinite(Number(row.velocity?.[key])))throw new TypeError('Invalid saved pirate vector');
      const g=normalizeGroup(row);if(next.has(g.id))throw new Error('Duplicate saved pirate group: '+g.id);next.set(g.id,g);
    }
    const nextSeed=(data.seed>>>0)||initialSeed,nextRng=(data.rngState>>>0)||nextSeed,nextIdValue=Math.max(1,Math.trunc(data.nextId)||1),nextWorldTime=Number(data.worldTime),nextClock=Number(data.clock);
    if(!Number.isFinite(nextWorldTime)||nextWorldTime<0||!Number.isFinite(nextClock)||nextClock<0||!Number.isSafeInteger(nextIdValue))throw new TypeError('Invalid pirate strategic clock');
    groups.clear();for(const [id,g] of next)groups.set(id,g);
    rngState=nextRng;nextId=nextIdValue;worldTime=nextWorldTime;clock=clamp(nextClock,0,clamp(decisionInterval,.25,10));
  }
  return {addGroup,removeGroup,update,snapshot,restore,getGroup:id=>groups.has(id)?snapshotGroup(groups.get(id)):null,list:()=>[...groups.values()].map(snapshotGroup)};
}

/** Converts a strategic contact into a stable lightweight telemetry record. */
export function toPirateContact(group) {
  if(!group||typeof group.id!=='string')throw new TypeError('A pirate group with a stable id is required');
  return {id:group.id,faction:group.faction,role:group.role,state:group.state,ships:group.ships,
    position:copyPosition(group.position),velocity:copyPosition(group.velocity),hull:group.hull,morale:group.morale};
}
