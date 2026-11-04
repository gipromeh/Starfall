// Port of STARFALL_CURRENT.html v90 EAI kernel. Keep parity with source comments and tests/t11_pirate_fleet.js.
export const STEP = 4 / 60;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => { const n=Math.hypot(...a); return n>1e-12?a.map(v=>v/n):[0,0,0]; };
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const rotate=(v,axis,angle)=>{const c=Math.cos(angle),s=Math.sin(angle),d=dot(axis,v),x=cross(axis,v);return add(add(scale(v,c),scale(x,s)),scale(axis,d*(1-c)));};
export function createEAI(seed=0x6d2b79f5){
 let rng=(seed>>>0)||0x6d2b79f5;
 const api={};
 api.seed=v=>{rng=(v>>>0)||0x6d2b79f5;};
 api.rand=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return(rng>>>0)/4294967296;};
 api.think=(e,dt)=>{e.aiClock=(e.aiClock||0)+Math.max(0,Math.min(.1,dt));if(e.aiClock+1e-9<STEP)return false;e.aiClock-=STEP;e.aiTicks=(e.aiTicks||0)+1;return true;};
 api.project=(direction,forward)=>{const f=norm(forward);let r=cross(f,[0,1,0]);r=norm(Math.hypot(...r)<1e-8?[1,0,0]:r);const u=norm(cross(r,f));return{x:dot(direction,r),y:dot(direction,u),forward:dot(direction,f)};};
 api.projectOCS=(direction,forward,up=[0,1,0])=>{const f=norm(forward);let r=cross(f,up);r=norm(Math.hypot(...r)<1e-8?[1,0,0]:r);const u=norm(cross(r,f)),d=scale(norm(direction),.5);return{h:-dot(r,d),l:-dot(u,d),d:-dot(f,d)};};
 api.command=(e,direction,distance,options={})=>{const p=api.projectOCS(direction,e.hd||[0,0,-1]);const q=v=>Math.sign(v)*Math.min(15,Math.floor(Math.abs(v)*30+.5));e.ocsProjection=p;e.speed=e.speed||e.sp2||Math.hypot(...(e.vel||[0,0,0]));e.ocsYaw=q(p.h);e.ocsPitch=-q(p.l);const rb=Math.min(255,Math.floor(Math.max(0,distance)/32));let accel=rb>12?2:rb<5?-1:1;if(Math.abs(p.h)>.28||Math.abs(p.l)>.28)accel=Math.max(0,accel-1);e.ocsAccel=accel;e.ocsTargetSpeed=Math.max(0,options.speed||0);e.ocsMaxAcceleration=Math.max(1,options.acceleration||40);e.ocsTurnRate=Math.max(.1,options.turnRate||1);return p;};
 api.integrate=(e,dt)=>{if(!e.hd)e.hd=[0,0,-1];e.speed=e.speed||e.sp2||Math.hypot(...(e.vel||[0,0,0]));const tr=e.ocsTurnRate||1,ma=e.ocsMaxAcceleration||40;let right0=cross(e.hd,[0,1,0]);right0=norm(Math.hypot(...right0)>1e-8?right0:[1,0,0]);const localUp=norm(cross(right0,e.hd));const yaw=(e.ocsYaw||0)/15*tr*dt;if(yaw)e.hd=rotate(e.hd,localUp,yaw);let right=cross(e.hd,[0,1,0]);if(Math.hypot(...right)>1e-8){right=norm(right);const pitch=(e.ocsPitch||0)/15*tr*dt;if(pitch)e.hd=rotate(e.hd,right,pitch);}e.hd=norm(e.hd);const throttle=e.ocsAccel==null?1:e.ocsAccel===2?1:e.ocsAccel===1?.92:e.ocsAccel===0?.78:.55;const target=(e.ocsTargetSpeed||e.speed||0)*throttle;e.speed=Math.max(0,e.speed)+clamp(target-e.speed,-ma*dt,ma*dt);const desired=scale(e.hd,e.speed);let delta=sub(desired,e.vel),len=Math.hypot(...delta),limit=ma*dt;if(len>limit)delta=scale(delta,limit/len);e.vel=add(e.vel,delta);e.position=add(e.position,scale(e.vel,dt));return e.ocsProjection;};
 api.fireChance=(p,distance,range)=>{const alignment=clamp((p.forward-.5)/.5,0,1),proximity=clamp(1-distance/Math.max(1,range),0,1);return clamp(.25+.55*alignment+.2*proximity,.2,.98);};
 api.fireGate=(p,distance,range,descriptor,combatRank)=>{const rb=Math.floor(Math.max(0,distance)/32),xor=(p.h<0)!==(p.d<0),centered=Math.abs(p.h)<=.18;if(rb>=12||distance>=range||p.d>=-.02)return false;if(!xor&&!centered)return false;if(rb>=4&&!centered)return false;return api.rand()<clamp(descriptor,0,1)*(combatRank?1:.5);};
 api.chooseVector=(e,relative,aiThink,options={})=>{
  const hd=norm(e.hd||[0,0,-1]),up=options.up||[0,1,0];
  let right=cross(hd,up);right=norm(Math.hypot(...right)<1e-8?[1,0,0]:right);
  const localUp=norm(cross(right,hd)),lx=dot(relative,right),ly=dot(relative,localUp),lz=dot(relative,hd);
  const distance=Math.hypot(...relative),near=Math.abs(lx)<(options.nearX||260)&&Math.abs(ly)<(options.nearY||220)&&Math.abs(lz)<(options.nearZ||340);
  if(aiThink){
   if(distance>(options.reengageDistance||720))e.aiCloseEvaded=false;
   if(e.aiIntent==="EVADE"){
    if(options.incoming)e.aiEvadeTicks=0;else e.aiEvadeTicks=(e.aiEvadeTicks||0)+1;
    if(!options.incoming&&e.aiEvadeTicks>=(options.minEvadeTicks||8)){e.aiIntent="ATTACK";if(near)e.aiCloseEvaded=true;}
   }else if(options.incoming||(near&&!e.aiCloseEvaded)){
    e.aiEvadeSide=api.rand()<.5?-1:1;e.aiEvadeTicks=0;e.aiIntent="EVADE";
    if(near)e.aiCloseEvaded=true;
   }else e.aiIntent="ATTACK";
  }
  if(!e.aiIntent)e.aiIntent="ATTACK";
  const side=e.aiEvadeSide||e.aiSideSign||1;
  let direction=relative.slice();
  if(e.aiIntent==="EVADE")direction=add(scale(direction,-1),add(scale(right,side*.38),scale(localUp,.12)));
  else direction=add(direction,scale(right,(e.aiSideSign||side)*.07));
  if(Math.hypot(...direction)<1e-10)direction=hd;
  return norm(direction);
 };
 return api;
}
export const vec={dot,cross,norm,sub,add,scale};
