const BABYLON=globalThis.BABYLON;
import {FlightModel} from "./flight-model.js";
import {InputAdapter} from "./input.js";
import {SaveSystem} from "./save.js";
import {HUD} from "./ui.js";
import {World} from "./world.js";

const canvas=document.getElementById("renderCanvas");
const overlay=document.getElementById("overlay");
const startButton=document.getElementById("start-button");
const bootMessage=document.getElementById("boot-message");
const hud=new HUD();
const flight=new FlightModel();
const saves=new SaveSystem();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

let engine,scene,world,input,camera,cameraTarget;
let running=false,paused=false,gameOver=false;
let lastTime=0,fps=0,frameCount=0,fpsWindow=0,frameMs=0,accumulator=0;
const FIXED_DT=1/60,MAX_FRAME_DELTA=.2,MAX_STEPS=8;
let fireCooldown=0,missileCooldown=0,enemyFireCooldown=0,respawnTimer=0,respawnAt=0,saveTimer=0;
let hull=100,shield=100,kills=0,credits=0;
let projectiles=[];
const projectilePool=[];

function segmentDistanceSquared(point,start,end){
  const segment=end.subtract(start);
  const lengthSquared=segment.lengthSquared();
  if(lengthSquared<1e-8)return BABYLON.Vector3.DistanceSquared(point,start);
  const t=clamp(BABYLON.Vector3.Dot(point.subtract(start),segment)/lengthSquared,0,1);
  const closest=start.add(segment.scale(t));
  return BABYLON.Vector3.DistanceSquared(point,closest);
}

function getProjectileMesh(kind){
  const mesh=projectilePool.pop();
  if(mesh){mesh.setEnabled(true);mesh.scaling.setAll(kind==="missile"?1.8:1);return mesh;}
  const created=BABYLON.MeshBuilder.CreateSphere(kind==="missile"?"missile-projectile":"laser-projectile",{diameter:kind==="missile"?1.5:.55,segments:8},scene);
  const material=new BABYLON.StandardMaterial("projectile-material-"+projectilePool.length+"-"+performance.now(),scene);
  material.emissiveColor=kind==="missile"?new BABYLON.Color3(1,.34,.06):new BABYLON.Color3(.12,.78,1);
  material.disableLighting=true;created.material=material;return created;
}

function releaseProjectile(projectile){
  projectile.mesh.setEnabled(false);
  projectilePool.push(projectile.mesh);
}

function spawnProjectile(origin,direction,owner,kind="laser"){
  const normalized=direction.normalizeToNew();
  const mesh=getProjectileMesh(kind);
  mesh.position.copyFrom(origin).addInPlace(normalized.scale(owner==="player"?9:11));
  const speed=kind==="missile"?220:owner==="player"?420:145;
  projectiles.push({
    mesh,owner,kind,velocity:normalized.scale(speed),ttl:kind==="missile"?5:owner==="enemy"?7:2.2,
    damage:kind==="missile"?28:owner==="player"?9:8,
    previous:mesh.position.clone()
  });
}

function explode(position,color=0xffa45a){
  const burst=BABYLON.MeshBuilder.CreateSphere("combat-burst",{diameter:2,segments:8},scene);
  burst.position.copyFrom(position);
  const material=new BABYLON.StandardMaterial("burst-material-"+performance.now(),scene);
  material.emissiveColor=BABYLON.Color3.FromHexString("#"+color.toString(16).padStart(6,"0"));
  material.disableLighting=true;burst.material=material;
  let age=0;
  const observer=scene.onBeforeRenderObservable.add(()=>{
    const dt=Math.min(engine.getDeltaTime()/1000,.05);age+=dt;
    burst.scaling.setAll(1+age*9);material.alpha=Math.max(0,1-age/.38);
    if(age>.38){scene.onBeforeRenderObservable.remove(observer);burst.dispose();material.dispose();}
  });
}

function damagePlayer(amount){
  const absorbed=Math.min(shield,amount);
  shield-=absorbed;
  hull=Math.max(0,hull-(amount-absorbed));
  if(hull<=0&&!gameOver){
    gameOver=true;paused=true;
    bootMessage.textContent="КОРАБЛЬ УНИЧТОЖЕН · УБИЙСТВ: "+kills+" · НАГРАДА: "+credits+" CR";
    startButton.textContent="ПЕРЕЗАПУСК";
    overlay.hidden=false;
    hud.toast("HULL CRITICAL");
  }
}

function damagePirate(amount,position){
  const destroyed=world.damagePirate(amount);
  if(destroyed){
    kills++;credits+=250;
    explode(position,0xff7b35);
    hud.toast("ЦЕЛЬ УНИЧТОЖЕНА · +250 CR");
    respawnTimer=4;respawnAt=performance.now()+4000;
    saves.saveSlice(snapshot());
  }else{
    explode(position,0x55dfff);
  }
}

function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const projectile=projectiles[i];
    projectile.ttl-=dt;
    const oldPosition=projectile.mesh.position.clone();
    if(projectile.kind==="missile"&&projectile.owner==="player"&&!world.pirateDestroyed){
      const desired=world.pirate.position.subtract(projectile.mesh.position).normalize();
      projectile.velocity= BABYLON.Vector3.Lerp(projectile.velocity,desired.scale(220),Math.min(1,dt*2.8));
    }
    projectile.previous.copyFrom(oldPosition);
    projectile.mesh.position.addInPlace(projectile.velocity.scale(dt));
    let hit=false;
    if(projectile.owner==="player"&&!world.pirateDestroyed){
      hit=segmentDistanceSquared(world.pirate.position,oldPosition,projectile.mesh.position)<24*24;
      if(hit)damagePirate(projectile.damage,projectile.mesh.position);
    }else if(projectile.owner==="enemy"){
      hit=segmentDistanceSquared(world.player.position,oldPosition,projectile.mesh.position)<15*15;
      if(hit){damagePlayer(projectile.damage);explode(projectile.mesh.position,0xff4b4b);}
    }
    if(hit||projectile.ttl<=0){
      releaseProjectile(projectile);projectiles.splice(i,1);
    }
  }
}

function snapshot(){
  return {
    position:{x:world.player.position.x,y:world.player.position.y,z:world.player.position.z},
    velocity:{x:flight.velocity.x,y:flight.velocity.y,z:flight.velocity.z},
    hull,shield,kills,credits
  };
}

function update(dt,now){
  const action=input.read();
  const player=world.player;
  const locked=input.pointer.locked;
  const yaw=locked?action.aimX:action.aimX*dt*1.7;
  const pitch=locked?action.aimY:action.aimY*dt*1.35;
  player.rotation.y+=yaw;
  player.rotation.x=clamp(player.rotation.x-pitch,-.65,.65);
  player.rotation.z+=(action.roll*.35-action.strafe*.13-player.rotation.z)*Math.min(1,dt*3.5);

  if(action.brake)flight.velocity.scaleInPlace(Math.exp(-2.7*dt));
  flight.step(dt,action,player);
  player.position.addInPlace(flight.velocity.scale(dt));
  player.computeWorldMatrix(true);
  if(cameraTarget){cameraTarget.position.copyFrom(player.position);cameraTarget.position.y+=5;cameraTarget.rotation.copyFrom(player.rotation);cameraTarget.computeWorldMatrix(true);}

  const enemyFires=world.updateAI(dt);
  if(enemyFires&&!world.pirateDestroyed){
    const aim=player.position.subtract(world.pirate.position).normalize();
    spawnProjectile(world.pirate.position,aim,"enemy","laser");
  }

  fireCooldown-=dt;missileCooldown-=dt;
  if(action.fire&&fireCooldown<=0){
    fireCooldown=.115;
    spawnProjectile(player.position,player.getDirection(BABYLON.Axis.Z),"player","laser");
  }
  if(action.missile&&missileCooldown<=0){
    missileCooldown=1.15;
    spawnProjectile(player.position,player.getDirection(BABYLON.Axis.Z),"player","missile");
  }

  updateProjectiles(dt);
  if(respawnAt>0){
    respawnTimer=Math.max(0,(respawnAt-now)/1000);
    if(now>=respawnAt){respawnAt=0;respawnTimer=0;world.respawnPirate();hud.toast("НОВАЯ ПИРАТСКАЯ ЦЕЛЬ");}
  }
  if(shield<100&&!gameOver)shield=Math.min(100,shield+2.2*dt);
  if(!gameOver&&hull<100&&shield>=100)hull=Math.min(100,hull+.15*dt);

  saveTimer+=dt;
  if(saveTimer>=5){saveTimer=0;saves.saveSlice(snapshot());}

  const distance=BABYLON.Vector3.Distance(player.position,world.pirate.position);
  hud.update({
    speed:flight.velocity.length(),hull,shield,
    target:world.pirateDestroyed?"TARGET DESTROYED": "PIRATE / "+(distance/1000).toFixed(2)+" KM",
    enemyHealth:world.pirateDestroyed?0:world.pirateHealth,
    kills,credits,fps,engine:true,projectiles:projectiles.length,
    frameMs,physics:"SWEPT COLLISION"
  });
}

async function boot(){
  try{
    if(!BABYLON)throw new Error("Babylon.js 7.0 CDN не загружен");
    const touchDevice=matchMedia("(pointer:coarse)").matches;
    engine=new BABYLON.Engine(canvas,!touchDevice,{
      stencil:true,antialias:!touchDevice,powerPreference:"high-performance",
      adaptToDeviceRatio:false,preserveDrawingBuffer:false
    });
    const renderRatio=Math.min(window.devicePixelRatio||1,1.5);
    engine.setHardwareScalingLevel(1/renderRatio);
    scene=new BABYLON.Scene(engine);
    scene.clearColor=new BABYLON.Color4(.002,.006,.018,1);
    const ambient=new BABYLON.HemisphericLight("ambient",new BABYLON.Vector3(0,1,0),scene);
    ambient.intensity=.62;
    const key=new BABYLON.DirectionalLight("key",new BABYLON.Vector3(-.4,-.6,.3),scene);
    key.intensity=1.35;

    world=new World(scene);
    cameraTarget=new BABYLON.TransformNode("chase-camera-target",scene);
    cameraTarget.position.copyFrom(world.player.position);cameraTarget.position.y+=5;cameraTarget.rotation.copyFrom(world.player.rotation);
    camera=new BABYLON.FollowCamera("chase-camera",new BABYLON.Vector3(0,10,36),scene);
    camera.lockedTarget=cameraTarget;camera.radius=62;camera.heightOffset=13;
    camera.rotationOffset=180;camera.cameraAcceleration=.045;camera.maxCameraSpeed=42;
    scene.activeCamera=camera;
    const glow=new BABYLON.GlowLayer("combat-glow",scene,{blurKernelSize:touchDevice?12:16});
    glow.intensity=touchDevice ? 0.26 : 0.34;

    input=new InputAdapter(canvas);
    if(new URLSearchParams(location.search).has("test")){
      globalThis.__STARFALL_TEST__={
        state:()=>({hull,shield,kills,credits,enemyHealth:world.pirateHealth,enemyDestroyed:world.pirateDestroyed,projectiles:projectiles.length,speed:flight.velocity.length(),respawnTimer,running,paused,playerPosition:world.player.position.asArray(),playerForward:world.player.getDirection(BABYLON.Axis.Z).asArray(),targetPosition:world.pirate.position.asArray(),pirateAsset:world.pirateAsset,projectileData:projectiles.map(p=>({position:p.mesh.position.asArray(),velocity:p.velocity.asArray(),ttl:p.ttl,owner:p.owner,kind:p.kind}))}),
        damageTarget:amount=>damagePirate(amount,world.pirate.position.clone()),
        fireMissile:()=>{world.player.computeWorldMatrix(true);spawnProjectile(world.player.position,world.player.getDirection(BABYLON.Axis.Z),"player","missile");},
        fireLaser:()=>{world.player.computeWorldMatrix(true);spawnProjectile(world.player.position,world.player.getDirection(BABYLON.Axis.Z),"player","laser");},
        fireEnemy:()=>{const forward=world.player.getDirection(BABYLON.Axis.Z);spawnProjectile(world.player.position.add(forward.scale(35)),forward.scale(-1),"enemy","laser");},
        damagePlayer:amount=>damagePlayer(amount),
        save:()=>saves.saveSlice(snapshot())
      };
    }
    const loaded=saves.load();
    if(loaded.slice?.data){
      const saved=loaded.slice.data;
      if(saved.position)world.player.position.set(saved.position.x||0,saved.position.y||0,saved.position.z||0);
      if(saved.velocity)flight.velocity.set(saved.velocity.x||0,saved.velocity.y||0,saved.velocity.z||0);
      hull=clamp(saved.hull??100,1,100);shield=clamp(saved.shield??100,0,100);
      kills=saved.kills||0;credits=saved.credits||0;
      bootMessage.textContent="СОХРАНЕНИЕ ВОССТАНОВЛЕНО · "+kills+" УНИЧТОЖЕНИЙ";
    }else if(loaded.legacyData){
      bootMessage.textContent="НАЙДЕНО СОХРАНЕНИЕ V85 · ОРИГИНАЛЬНЫЕ СЛОТЫ НЕ ИЗМЕНЯЮТСЯ";
    }else{
      bootMessage.textContent="BABYLON 7.0 · YUKA AI · FLIGHTMODEL · SWEPT COMBAT";
    }

    engine.onResizeObservable.add(()=>engine.resize());
    canvas.addEventListener("webglcontextlost",event=>{
      event.preventDefault();paused=true;hud.toast("WEBGL CONTEXT LOST");
    });
    canvas.addEventListener("webglcontextrestored",()=>{
      engine.resize();paused=false;lastTime=performance.now();accumulator=0;hud.toast("GRAPHICS RESTORED");
    });
    document.addEventListener("visibilitychange",()=>{
      paused=document.hidden;lastTime=performance.now();accumulator=0;
    });
    addEventListener("keydown",event=>{
      if((event.code==="Escape"||event.code==="KeyP")&&!event.repeat&&running&&!gameOver){
        paused=!paused;lastTime=performance.now();accumulator=0;hud.toast(paused?"PAUSED":"RESUMED");
      }
      if((event.code==="F3"||event.code==="Backquote")&&!event.repeat){
        document.getElementById("diagnostics").hidden=!document.getElementById("diagnostics").hidden;
      }
    });

    engine.runRenderLoop(()=>{
      if(!running||paused||!scene)return;
      const now=performance.now();
      const elapsed=Math.max(0,(now-lastTime)/1000);lastTime=now;
      accumulator+=Math.min(elapsed,MAX_FRAME_DELTA);
      let steps=0;
      while(accumulator>=FIXED_DT&&steps<MAX_STEPS){update(FIXED_DT,now);accumulator-=FIXED_DT;steps++;}
      if(steps===MAX_STEPS&&accumulator>=FIXED_DT)accumulator=0;
      frameMs=engine.getDeltaTime();
      scene.render();
      frameCount++;
      if(now-fpsWindow>=500){fps=frameCount*1000/(now-fpsWindow);frameCount=0;fpsWindow=now;}
    });

    startButton.disabled=false;
    document.getElementById("status").textContent="SYSTEMS NOMINAL";
    if(gameOver)startButton.textContent="ПЕРЕЗАПУСК";
    startButton.addEventListener("click",()=>{
      if(gameOver){location.reload();return;}
      overlay.hidden=true;running=true;paused=false;lastTime=performance.now();accumulator=0;input.activate();
      if(matchMedia("(pointer:fine)").matches)canvas.requestPointerLock?.();
    });
    hud.toast("COMBAT SYSTEM READY");
  }catch(error){
    console.error("[STARFALL BOOT]",error);
    bootMessage.textContent="ОШИБКА ЗАПУСКА: "+(error?.message||error);
    document.getElementById("status").textContent="BOOT ERROR";
  }
}

addEventListener("beforeunload",()=>{
  input?.dispose();engine?.stopRenderLoop();scene?.dispose();engine?.dispose();
});
boot();