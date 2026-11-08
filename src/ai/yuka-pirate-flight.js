(function(global){
"use strict";
const Y=global.YUKA,Decision=global.SF_YUKA_DECISION,Adapter=global.SF_STARFALL_YUKA_ADAPTER,EMPTY=[];
if(!Y||!Decision||!Adapter)throw new Error("Yuka steering requires Decision Layer and Starfall Adapter");
const pilots=new WeakMap(),active=new Set(),set3=(v,p)=>v.set(p.x,p.y,p.z),setQ=(q,p)=>q.set(p.x,p.y,p.z,p.w);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function createPilot(entity){
 const vehicle=new Y.Vehicle(),target=new Y.Vehicle(),threat=new Y.Vehicle();
 vehicle.forward.set(0,0,-1);vehicle.up.set(0,1,0);vehicle.updateOrientation=false;
 target.forward.set(0,0,-1);target.up.set(0,1,0);threat.forward.set(0,0,-1);threat.up.set(0,1,0);
 const pursuit=new Y.PursuitBehavior(target,1.25),evade=new Y.EvadeBehavior(threat,220,1.2);
 const wander=new Y.WanderBehavior(18,48,10),arrive=new Y.ArriveBehavior(target.position,2.8,14),flee=new Y.FleeBehavior(target.position,1e9);
 const separation=new Y.SeparationBehavior(),alignment=new Y.AlignmentBehavior(),cohesion=new Y.CohesionBehavior();
 separation.weight=.55;alignment.weight=.12;cohesion.weight=.16;
 const force=new Y.Vector3(),pilot={vehicle,target,threat,pursuit,evade,wander,arrive,flee,separation,alignment,cohesion,force,lastBehavior:"",lastIntent:"PATROL",adapterTicks:0,decisionTicks:0};
 pilots.set(entity,pilot);active.add(entity);entity.yukaPilot=pilot;return pilot;
}
function reset(entity){if(!entity)return;pilots.delete(entity);active.delete(entity);Decision.reset(entity);delete entity.yukaPilot}
function update(entity,dt,targetData,options={}){
 if(!entity||!entity.g||!entity.g.position||!entity.vel||!targetData||!targetData.position)return null;
 const pilot=pilots.get(entity)||createPilot(entity),v=pilot.vehicle,g=entity.g;dt=clamp(Number(dt)||0,0,.1);
 set3(v.position,g.position);set3(v.velocity,entity.vel);setQ(v.rotation,g.quaternion);
 set3(pilot.target.position,targetData.position);set3(pilot.target.velocity,targetData.velocity||{x:0,y:0,z:0});
 if(targetData.quaternion)setQ(pilot.target.rotation,targetData.quaternion);
 v.maxSpeed=Math.max(1,Number(options.speed)||58);v.maxForce=Math.max(1,Number(options.acceleration)||72);
 v.mass=1;v.maxTurnRate=Math.max(.25,Number(options.turnRate)||1.8);
 const requestedMode=options.mode||"combat",mode=requestedMode==="pursuit"?"combat":requestedMode==="arrive"?(options.returning?"return":"formation"):requestedMode;
 const distance=Number.isFinite(options.distance)?Math.max(0,options.distance):v.position.distanceTo(pilot.target.position);
 const decision=Decision.decide(entity,{mode,targetDetected:options.targetDetected===undefined?mode==="combat":options.targetDetected===true,
  distance,fireRange:options.fireRange,weaponReady:options.weaponReady===true,hullFraction:options.hullFraction,
  threat:options.threat,threatRadius:options.threatRadius,role:entity.ty},dt);
 if(!decision)return null;pilot.decisionTicks=decision.ticks;v.steering.clear();v.neighbors.length=0;
 const neighbors=Array.isArray(options.neighbors)?options.neighbors:EMPTY;
 for(const other of neighbors){if(!other||other===entity||!other.g||!other.g.position)continue;
  const otherPilot=pilots.get(other)||createPilot(other),ov=otherPilot.vehicle;
  set3(ov.position,other.g.position);set3(ov.velocity,other.vel||{x:0,y:0,z:0});
  if(other.g.quaternion)setQ(ov.rotation,other.g.quaternion);v.neighbors.push(ov);
 }
 let behavior;
 if(decision.intent==="EVADE"&&options.threat&&options.threat.position&&options.threat.velocity){
  set3(pilot.threat.position,options.threat.position);set3(pilot.threat.velocity,options.threat.velocity);
  pilot.evade.panicDistance=Math.max(1,Number(options.threatRadius)||220);pilot.evade.predictionFactor=Number(options.predictionFactor)||1.2;
  v.steering.add(pilot.evade);behavior="EvadeBehavior";
 }else if(decision.intent==="RETREAT"){pilot.flee.target.copy(pilot.target.position);pilot.flee.panicDistance=1e9;v.steering.add(pilot.flee);behavior="FleeBehavior"}
 else if(decision.intent==="PATROL"){v.steering.add(pilot.wander);behavior="WanderBehavior"}
 else if(decision.intent==="FORM"||decision.intent==="RETURN"){
  pilot.arrive.target.copy(options.targetPosition||pilot.target.position);pilot.arrive.deceleration=Number(options.deceleration)||2.8;
  pilot.arrive.tolerance=options.tolerance===undefined?14:Math.max(0,Number(options.tolerance)||0);
  v.steering.add(pilot.arrive);behavior="ArriveBehavior";if(v.neighbors.length){v.steering.add(pilot.alignment);v.steering.add(pilot.cohesion)}
 }else{pilot.pursuit.predictionFactor=Number(options.predictionFactor)||1.25;v.steering.add(pilot.pursuit);behavior="PursuitBehavior"}
 if(v.neighbors.length&&decision.intent!=="EVADE"&&decision.intent!=="RETREAT")v.steering.add(pilot.separation);
 const force=v.steering.calculate(dt,pilot.force),heading=entity.hd||{x:0,y:0,z:-1};
 const rightX=-heading.z,rightZ=heading.x,rightLength=Math.hypot(rightX,rightZ)||1,lateral=(force.x*rightX+force.z*rightZ)/rightLength;
 entity.ocsYaw=clamp(lateral/Math.max(1,v.maxForce)*15,-15,15);
 const motion=Adapter.integrate(entity,force,dt,{maxAcceleration:v.maxForce,maxSpeed:v.maxSpeed,turnRate:v.maxTurnRate});
 v.position.set(g.position.x,g.position.y,g.position.z);v.velocity.set(entity.vel.x,entity.vel.y,entity.vel.z);setQ(v.rotation,g.quaternion);
 pilot.lastBehavior=behavior;pilot.lastIntent=decision.intent;
 const state=decision.intent==="IDLE"?(mode==="formation"?"FORM":"PATROL"):decision.intent;
 entity.state=entity.aiIntent=state;
 return{intent:state,evading:state==="EVADE",speed:entity.speed,behavior,decisionTicks:decision.ticks,adapterTicks:pilot.adapterTicks,acceleration:motion&&motion.acceleration};
}
function inspect(entity){const p=entity&&pilots.get(entity),d=entity&&Decision.inspect(entity);
 return p?{intent:p.lastIntent,behavior:p.lastBehavior,decisionTicks:p.decisionTicks,adapterTicks:p.adapterTicks,thinkType:d&&d.thinkType,neighborCount:p.vehicle.neighbors.length}:null}
global.SF_YUKA_PIRATE_AI=Object.freeze({version:"0.7.8",ready:true,reset,update,inspect,activeCount:()=>active.size,
 get decisionHz(){return Decision.decisionHz},get adapterAuthority(){return Adapter.authority}});
})(window);
