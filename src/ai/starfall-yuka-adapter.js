(function(global){
"use strict";
const T=global.THREE;
const forward=new T.Vector3(),up=new T.Vector3(),right=new T.Vector3(),back=new T.Vector3();
const basis=new T.Matrix4(),targetRotation=new T.Quaternion();
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function integrate(entity,steeringForce,dt,options={}){
 if(!entity||!entity.g||!entity.g.position||!entity.vel||!steeringForce)return null;
 dt=clamp(Number(dt)||0,0,.1);if(dt<=0)return{speed:entity.vel.length(),acceleration:0};
 const maxAcceleration=Math.max(1,Number(options.maxAcceleration)||72),maxSpeed=Math.max(1,Number(options.maxSpeed)||58);
 let ax=Number(steeringForce.x)||0,ay=Number(steeringForce.y)||0,az=Number(steeringForce.z)||0;
 const magnitude=Math.hypot(ax,ay,az),scale=magnitude>maxAcceleration?maxAcceleration/magnitude:1;
 ax*=scale;ay*=scale;az*=scale;entity.vel.x+=ax*dt;entity.vel.y+=ay*dt;entity.vel.z+=az*dt;
 const speed=entity.vel.length();if(speed>maxSpeed)entity.vel.multiplyScalar(maxSpeed/speed);
 entity.g.position.addScaledVector(entity.vel,dt);
 if(entity.vel.lengthSq()>1e-8){
  if(entity.hd)entity.hd.copy(entity.vel).normalize();
  forward.set(entity.vel.x,entity.vel.y,entity.vel.z).normalize();up.set(0,1,0);
  if(Math.abs(forward.dot(up))>.98)up.set(0,0,1);
  right.crossVectors(forward,up).normalize();up.crossVectors(right,forward).normalize();
  back.copy(forward).negate();basis.makeBasis(right,up,back);targetRotation.setFromRotationMatrix(basis);
  entity.g.quaternion.slerp(targetRotation,1-Math.exp(-Math.max(.1,Number(options.turnRate)||1.8)*dt));
 }
 entity.speed=entity.vel.length();if(entity.yukaPilot)entity.yukaPilot.adapterTicks=(entity.yukaPilot.adapterTicks||0)+1;
 return{speed:entity.speed,acceleration:magnitude*scale,position:entity.g.position};
}
global.SF_STARFALL_YUKA_ADAPTER=Object.freeze({version:"1.0.0",authority:"STARFALL",orientationAuthority:"STARFALL",integrate});
})(window);
