(function(global){
"use strict";
const Y=global.YUKA;
if(!Y||!Y.Think||!Y.GoalEvaluator||!Y.GameEntity)throw new Error("Yuka Decision Layer requires Yuka 0.7.8");
const STEP=1/15,brains=new WeakMap(),active=new Set();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=(v,f)=>Number.isFinite(v)?v:f;
function fallback(mode){return mode==="formation"?"FORM":mode==="return"?"RETURN":mode==="patrol"?"PATROL":"PURSUE"}
class IntentEvaluator extends Y.GoalEvaluator{
 constructor(intent,score,bias){super(bias||1);this.intent=intent;this.score=score}
 calculateDesirability(owner){const s=owner.userData.snapshot;if(!s)return 0;const raw=clamp(this.score(s),0,1);return clamp(raw+(s.previousIntent===this.intent?.045:0),0,1)}
 setGoal(owner){owner.userData.intent=this.intent}
}
function createBrain(entity){
 const owner=new Y.GameEntity();owner.userData={snapshot:null,intent:null};
 const type=Number.isInteger(entity.ty)?entity.ty:0,think=new Y.Think(owner);
 think.addEvaluator(new IntentEvaluator("EVADE",s=>s.threatClosing&&s.threatDistance<=s.threatRadius?1:s.threatDistance<=s.threatRadius*.45?.86:0,1.25));
 think.addEvaluator(new IntentEvaluator("RETREAT",s=>s.mode==="combat"?(s.hullFraction<=.14?.97:s.hullFraction<=.24&&s.distance<360?.88:0):0,type===2?1.12:1.04));
 think.addEvaluator(new IntentEvaluator("ATTACK",s=>s.mode==="combat"&&s.targetDetected&&s.distance<=s.fireRange*1.08?.78+(s.weaponReady?.08:0):0,type===2?1.1:type===1?1.04:1));
 think.addEvaluator(new IntentEvaluator("PURSUE",s=>s.mode==="combat"&&s.targetDetected?.73:0,type===1?1.1:1));
 think.addEvaluator(new IntentEvaluator("FORM",s=>s.mode==="formation"?.82:0,1));
 think.addEvaluator(new IntentEvaluator("RETURN",s=>s.mode==="return"?.82:0,1));
 think.addEvaluator(new IntentEvaluator("PATROL",s=>s.mode==="patrol"&&!s.targetDetected?.72:0,type===1?1.08:1));
 think.addEvaluator(new IntentEvaluator("IDLE",()=>.01,1));
 const brain={owner,think,intent:"PATROL",accumulator:0,ticks:0,lastChanged:false};brains.set(entity,brain);active.add(entity);return brain;
}
function decide(entity,context={},dt=0){
 if(!entity)return null;
 const brain=brains.get(entity)||createBrain(entity);brain.accumulator+=clamp(finite(dt,0),0,.1);
 if(brain.accumulator+1e-8>=STEP){
  brain.accumulator=Math.max(0,brain.accumulator-STEP);
  const mode=context.mode||"combat",threat=context.threat||null,self=entity.g&&entity.g.position;
  let threatDistance=Infinity,threatClosing=false;
  if(threat&&threat.position&&threat.velocity&&self){
   const dx=self.x-threat.position.x,dy=self.y-threat.position.y,dz=self.z-threat.position.z;
   threatDistance=Math.hypot(dx,dy,dz);threatClosing=threat.velocity.x*dx+threat.velocity.y*dy+threat.velocity.z*dz>0;
  }
  const hull=context.hullFraction!==undefined?clamp(context.hullFraction,0,1):clamp(finite(entity.hp,1)/Math.max(1,finite(entity.mx,1)),0,1);
  brain.owner.userData.snapshot={mode,targetDetected:context.targetDetected===true,distance:Math.max(0,finite(context.distance,Infinity)),
   fireRange:Math.max(1,finite(context.fireRange,420)),weaponReady:context.weaponReady===true,hullFraction:hull,
   threatDistance,threatRadius:Math.max(1,finite(context.threatRadius,220)),threatClosing,
   role:finite(context.role,finite(entity.ty,0)),previousIntent:brain.intent};
  brain.owner.userData.intent=null;brain.think.arbitrate();
  const next=brain.owner.userData.intent||fallback(mode);brain.lastChanged=next!==brain.intent;brain.intent=next;brain.ticks++;
 }
 return {intent:brain.intent,changed:brain.lastChanged,ticks:brain.ticks,decisionHz:15};
}
function reset(entity){if(!entity)return;brains.delete(entity);active.delete(entity)}
function inspect(entity){const b=entity&&brains.get(entity);return b?{intent:b.intent,ticks:b.ticks,accumulator:b.accumulator,thinkType:b.think.constructor.name}:null}
global.SF_YUKA_DECISION=Object.freeze({version:"1.0.0",decisionHz:15,decide,reset,inspect,activeCount:()=>active.size});
})(window);
