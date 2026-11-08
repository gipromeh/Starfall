(function(global){
"use strict";
const Y=global.YUKA;
if(!Y)throw new Error("Yuka 0.7.8 failed to load");
const pilots=new WeakMap();
let activePilots=0;
const set3=(v,p)=>v.set(p.x,p.y,p.z);
const setQ=(q,p)=>q.set(p.x,p.y,p.z,p.w);
function createPilot(entity){
 const vehicle=new Y.Vehicle(),target=new Y.Vehicle(),threat=new Y.Vehicle();
 vehicle.forward.set(0,0,-1);vehicle.up.set(0,1,0);vehicle.updateOrientation=false;
 target.forward.set(0,0,-1);target.up.set(0,1,0);
 threat.forward.set(0,0,-1);threat.up.set(0,1,0);
 const pursuit=new Y.PursuitBehavior(target,1.25);
 const evade=new Y.EvadeBehavior(threat,220,1.2);
 const wander=new Y.WanderBehavior(18,48,10);
 const arrive=new Y.ArriveBehavior(target.position,2.8,14);
 const pilot={vehicle,target,threat,pursuit,evade,wander,arrive,facing:new Y.Vector3(),lastMode:""};
 pilots.set(entity,pilot);activePilots++;entity.yukaPilot=pilot;
 return pilot;
}
function reset(entity){if(entity&&pilots.has(entity)){pilots.delete(entity);activePilots--;delete entity.yukaPilot}}
function update(entity,dt,targetData,options={}){
 if(!entity||!entity.g||!targetData)return null;
 const pilot=pilots.get(entity)||createPilot(entity),v=pilot.vehicle,g=entity.g;
 dt=Math.max(0,Math.min(.1,Number(dt)||0));
 set3(v.position,g.position);set3(v.velocity,entity.vel||{x:0,y:0,z:0});setQ(v.rotation,g.quaternion);
 set3(pilot.target.position,targetData.position);set3(pilot.target.velocity,targetData.velocity||{x:0,y:0,z:0});
 if(targetData.quaternion)setQ(pilot.target.rotation,targetData.quaternion);
 v.maxSpeed=Math.max(1,options.speed||58);
 v.maxForce=Math.max(1,options.acceleration||72);
 v.mass=1;v.maxTurnRate=Math.max(.25,options.turnRate||1.8);
 v._worldMatrixDirty=true;void v.worldMatrix;
 v.steering.clear();
 let evading=false;
 if(options.threat&&options.threat.position&&options.threat.velocity){
  set3(pilot.threat.position,options.threat.position);set3(pilot.threat.velocity,options.threat.velocity);
  pilot.evade.panicDistance=options.threatRadius||220;
  pilot.evade.predictionFactor=options.predictionFactor||1.2;
  v.steering.add(pilot.evade);evading=true;
 }else if(options.mode==="patrol"){
  v.steering.add(pilot.wander);
 }else if(options.mode==="arrive"){
  pilot.arrive.target.copy(options.targetPosition||pilot.target.position);
  pilot.arrive.deceleration=options.deceleration||2.8;
  pilot.arrive.tolerance=options.tolerance===undefined?14:options.tolerance;
  v.steering.add(pilot.arrive);
 }else{
  pilot.pursuit.predictionFactor=options.predictionFactor||1.25;
  v.steering.add(pilot.pursuit);
 }
 v.update(dt);
 if(v.velocity.squaredLength()>1e-6){
  pilot.facing.copy(v.position).add(v.velocity);
  v.rotateTo(pilot.facing,dt);
 }
 g.position.set(v.position.x,v.position.y,v.position.z);
 entity.vel.set(v.velocity.x,v.velocity.y,v.velocity.z);
 if(entity.vel.lengthSq()>1e-6)entity.hd.copy(entity.vel).normalize();
 g.quaternion.set(v.rotation.x,v.rotation.y,v.rotation.z,v.rotation.w);
 v._worldMatrixDirty=true;void v.worldMatrix;
 entity.speed=entity.vel.length();
 entity.state=entity.aiIntent=evading?"EVADE":(options.mode==="patrol"?"PATROL":options.mode==="arrive"?"RETURN":"ATTACK");
 return {evading,speed:entity.speed,position:entity.vel.lengthSq()?g.position:null,behavior:evading?"EvadeBehavior":options.mode==="patrol"?"WanderBehavior":options.mode==="arrive"?"ArriveBehavior":"PursuitBehavior"};
}
global.SF_YUKA_PIRATE_AI={version:"0.7.8",ready:true,reset,update,activeCount:()=>activePilots};
})(window);
