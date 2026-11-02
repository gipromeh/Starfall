import fs from 'node:fs';
import {createEAI,STEP,vec} from './elite-eai.mjs';
const {sub,add,scale,norm,dot}=vec;
const DT=1/60, MAX_SECONDS=90, RANGE=420, SHOT_SPEED=200, DAMAGE=12, HULL=180;
const profiles=[
 {id:'interceptor',speed:46,accel:60,turn:1.8,aimBias:0},
 {id:'heavy',speed:34.5,accel:42,turn:1.25,aimBias:.015},
 {id:'agile',speed:49,accel:72,turn:2.1,aimBias:.025}
];
function pilot(profile,position,heading,seed){return{profile,position:[...position],hd:[...heading],vel:scale(heading,profile.speed),speed:profile.speed,hp:HULL,aiClock:0,fire:0,shots:0,hits:0,damage:0,alive:true,seed};}
function fight(seed,aProfile,bProfile){
 const ai=createEAI(seed),a=pilot(aProfile,[-260,0,0],[1,0,0],seed),b=pilot(bProfile,[260,0,0],[-1,0,0],seed^0x9e3779b9);
 ai.seed(seed);let t=0,events=0;
 while(t<MAX_SECONDS&&a.alive&&b.alive){
  for(const [self,target] of [[a,b],[b,a]]){
   if(!self.alive||!target.alive)continue;
   const delta=sub(target.position,self.position),distance=Math.hypot(...delta),direction=norm(delta),think=ai.think(self,DT);
   if(think)ai.command(self,direction,distance,{speed:self.profile.speed,acceleration:self.profile.accel,turnRate:self.profile.turn});
   ai.integrate(self,DT);
   self.fire-=DT;
   const aim=dot(self.hd,direction),projection=ai.project(direction,self.hd),ocs=ai.projectOCS(delta,self.hd);
   if(think&&distance<RANGE&&aim>.78&&self.fire<=0&&ai.fireGate(ocs,distance,RANGE,ai.fireChance(projection,distance,RANGE),true)){
    self.shots++;events++;
    // Explicitly abstract weapon model: bounded hit test approximates the production
    // projectile's forward travel; it is not a port of the Three.js collision pipeline.
    const hitProbability=Math.max(0,Math.min(.92,(aim-.72)*2.1))*(1-distance/RANGE*.18);
    if(ai.rand()<hitProbability){target.hp-=DAMAGE;self.hits++;self.damage+=DAMAGE;if(target.hp<=0){target.alive=false;break;}}
    self.fire=.42;
   }
  }
  t+=DT;
 }
 const winner=a.alive&&!b.alive?'a':b.alive&&!a.alive?'b':'draw';
 return{seed,a:aProfile.id,b:bProfile.id,winner,duration_seconds:+t.toFixed(3),a_hp:+Math.max(0,a.hp).toFixed(2),b_hp:+Math.max(0,b.hp).toFixed(2),a_shots:a.shots,b_shots:b.shots,a_hits:a.hits,b_hits:b.hits,a_damage:a.damage,b_damage:b.damage,events};
}
const scenarios=[['interceptor','interceptor'],['interceptor','heavy'],['heavy','agile'],['agile','interceptor'],['heavy','heavy']];
const N=1200,results=[];
for(let i=0;i<N;i++){const [a,b]=scenarios[i%scenarios.length];results.push(fight((0x51f15e+i*0x9e3779b1)>>>0,profiles.find(p=>p.id===a),profiles.find(p=>p.id===b)));}
const summary={schema:'starfall.combat-ai-lab.v1',model:'STARFALL v90 EAI kernel port + explicitly abstract weapon hit model',elite_reference:'ELITE_GAME_PASSPORT.md §§5, 13–14; ELITE_TO_STARFALL_V90.md',production_modified:false,seed_base:'0x51f15e',dt:DT,decision_step:STEP,battles:N,completed_at:new Date().toISOString(),outcomes:{a_wins:results.filter(x=>x.winner==='a').length,b_wins:results.filter(x=>x.winner==='b').length,draws:results.filter(x=>x.winner==='draw').length},metrics:{mean_duration_seconds:+(results.reduce((s,x)=>s+x.duration_seconds,0)/N).toFixed(3),mean_shots:+(results.reduce((s,x)=>s+x.a_shots+x.b_shots,0)/(2*N)).toFixed(3),mean_hit_rate:+(results.reduce((s,x)=>s+x.a_hits+x.b_hits,0)/Math.max(1,results.reduce((s,x)=>s+x.a_shots+x.b_shots,0))).toFixed(4),mean_damage:+(results.reduce((s,x)=>s+x.a_damage+x.b_damage,0)/(2*N)).toFixed(2)},by_matchup:Object.fromEntries(scenarios.map(([a,b])=>{const r=results.filter(x=>x.a===a&&x.b===b);return[a+' vs '+b,{battles:r.length,a_win_rate:+(r.filter(x=>x.winner==='a').length/r.length).toFixed(4),b_win_rate:+(r.filter(x=>x.winner==='b').length/r.length).toFixed(4),draw_rate:+(r.filter(x=>x.winner==='draw').length/r.length).toFixed(4),mean_duration:+(r.reduce((s,x)=>s+x.duration_seconds,0)/r.length).toFixed(3)}]}))};
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/combat-ai-summary.json',JSON.stringify(summary,null,2));fs.writeFileSync('artifacts/combat-ai-battles.json',JSON.stringify(results));
console.log(JSON.stringify(summary,null,2));
if(results.length!==N||!Number.isFinite(summary.metrics.mean_hit_rate))process.exitCode=1;
