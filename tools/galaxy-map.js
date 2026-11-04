/* STARFALL Galaxy Map: ED3D-inspired mode on the existing Three.js renderer.
   One WebGL context; external Spansh records remain reference-only. */
(() => {
'use strict';
if (window.SF_GALAXY_MAP) return;
const $ = id => document.getElementById(id);
const node = (tag, attrs, parent) => {
  const n=document.createElement(tag);
  Object.entries(attrs||{}).forEach(([k,v])=>k==='text'?n.textContent=v:n.setAttribute(k,v));
  if(parent)parent.appendChild(n);return n;
};
const css = [
'#sf-galaxy{position:fixed;inset:0;z-index:80;display:none;pointer-events:none;color:#d7f2ff;background:transparent;font:13px "Exo 2",sans-serif;letter-spacing:.04em}',
'#sf-galaxy .top{pointer-events:auto;position:absolute;z-index:3;left:0;right:0;top:0;display:flex;align-items:center;gap:9px;padding:max(10px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 10px max(14px,env(safe-area-inset-left));background:linear-gradient(#020813ee,#02081399,transparent)}',
'#sf-galaxy .title{font:19px "Russo One",sans-serif;letter-spacing:.14em;color:#72dfff;text-shadow:0 0 16px #28bfff}',
'#sf-galaxy .spacer{flex:1}#sf-galaxy button{min-width:0;padding:8px 12px;border:1px solid #4fd0ff99;background:#06203aee;color:#d7f2ff;font:700 11px "Exo 2",sans-serif;letter-spacing:.06em;cursor:pointer}',
'#sf-galaxy button:disabled{opacity:.35}#sf-galaxy input{width:min(270px,42vw);padding:9px 11px;border:1px solid #4fd0ff88;background:#031426ee;color:#e8f8ff;outline:none;font:13px "Exo 2",sans-serif}',
'#sf-galaxy .side{position:absolute;z-index:3;left:max(12px,env(safe-area-inset-left));top:68px;bottom:max(12px,env(safe-area-inset-bottom));width:min(320px,36vw);display:flex;flex-direction:column;gap:8px;pointer-events:none}',
'#sf-galaxy .panel{pointer-events:auto;border:1px solid #4fd0ff55;background:linear-gradient(135deg,#061a2def,#020916ef);box-shadow:0 0 22px #001a33aa;padding:10px;backdrop-filter:blur(8px)}',
'#sf-galaxy h3{margin:0 0 8px;color:#76dfff;font:13px "Russo One",sans-serif;letter-spacing:.12em}',
'#sf-galaxy .meta{font-size:11px;line-height:1.6;color:#9fc8df;overflow-wrap:anywhere;white-space:pre-line}',
'#sf-galaxy .results{display:flex;flex-direction:column;gap:4px;max-height:30vh;overflow:auto}',
'#sf-galaxy .results button{text-align:left;text-transform:none;display:flex;justify-content:space-between;gap:8px}',
'#sf-galaxy .results small{color:#80b5d2;white-space:nowrap}#sf-galaxy .actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
'#sf-galaxy .status{font-size:11px;line-height:1.5;color:#8ebbd4;min-height:30px}',
'#sf-galaxy .bottom{pointer-events:auto;position:absolute;z-index:3;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));display:flex;gap:6px}',
'#sf-galaxy .hint{position:absolute;right:16px;top:72px;z-index:2;padding:8px 10px;background:#020916aa;border:1px solid #4fd0ff33;color:#9fc8df;font-size:10px;line-height:1.55;pointer-events:none}',
'#sf-galaxy .close{border-color:#ff987788;color:#ffd2c1}#sf-galaxy-menu{min-width:min(440px,86vw);height:48px;font-size:15px;letter-spacing:.14em}',
'#sf-galaxy .flight-controls{position:absolute;z-index:4;left:max(12px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));display:none;grid-template-columns:repeat(3,48px);gap:5px;pointer-events:auto}',
'#sf-galaxy .flight-controls button{height:44px;padding:4px;font-size:14px;background:#06203add;touch-action:none;user-select:none;-webkit-user-select:none}',
'@media(max-width:700px){#sf-galaxy .flight-controls{grid-template-columns:repeat(3,54px)}#sf-galaxy .flight-controls button{height:50px}}',
'#sf-galaxy-hud{position:absolute;z-index:12;left:max(14px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));display:none;min-width:0;padding:8px 13px;font-size:11px;pointer-events:auto}',
'@media(max-width:700px){#sf-galaxy .title{font-size:12px;white-space:nowrap}#sf-galaxy .top{gap:6px}#sf-galaxy .side{top:60px;width:min(270px,68vw);bottom:90px}#sf-galaxy .hint{display:none}#sf-galaxy .panel{padding:8px}#sf-galaxy .results{max-height:22vh}#sf-galaxy .bottom{left:12px;right:12px;bottom:max(10px,env(safe-area-inset-bottom));flex-wrap:wrap}#sf-galaxy .bottom button{flex:1 1 28%}#sf-galaxy input{width:min(36vw,190px)}}'
].join('\n');
const style=node('style',{},document.head);style.textContent=css;
const root=node('section',{id:'sf-galaxy','aria-label':'Галактическая карта STARFALL'},document.body);
const top=node('div',{class:'top'},root);node('div',{class:'title',text:'GALACTIC NAVIGATION'},top);node('div',{class:'spacer'},top);
const search=node('input',{type:'search',placeholder:'Найти систему…','aria-label':'Поиск системы'},top);
const closeTop=node('button',{class:'close',text:'ЗАКРЫТЬ ✕'},top);
const side=node('aside',{class:'side'},root);
const panel=node('section',{class:'panel'},side);node('h3',{text:'СИСТЕМА'},panel);
const info=node('div',{class:'meta',text:'Выберите звёздную систему на карте или через поиск.'},panel);
const actions=node('div',{class:'actions'},panel);
const jumpBtn=node('button',{text:'ПЕРЕЙТИ В СИСТЕМУ',disabled:'true'},actions);
const routeBtn=node('button',{text:'НАЧАТЬ МАРШРУТ'},actions);
const exploreBtn=node('button',{text:'ИССЛЕДОВАТЬ СИСТЕМУ',disabled:'true'},actions);
const returnBtn=node('button',{text:'← К КАРТЕ'},actions);returnBtn.style.display='none';
const flightBtn=node('button',{text:'НАЧАТЬ ПОЛЁТ'},actions);flightBtn.style.display='none';
let flightMode=false,flightShip=null,flightVelocity=null,flightInput={thrust:false,boost:false,brake:false,left:false,right:false,up:false,down:false,rollL:false,rollR:false},flightCameraDistance=18,flightNearLabel='';
let externalRoot=null,externalRecord=null,externalCameraState=null;
const resultsPanel=node('section',{class:'panel'},side);const resultsHeading=node('h3',{text:'ПОИСК'},resultsPanel);
const results=node('div',{class:'results'},resultsPanel);
const statusPanel=node('section',{class:'panel'},side);node('h3',{text:'КАТАЛОГ'},statusPanel);
const status=node('div',{class:'status',text:'Ожидание каталога Spansh…'},statusPanel);
node('div',{class:'hint',text:'Мышь / палец — вращение · колесо / ± — масштаб\nКлик по звезде — сведения · поиск — переход · +/− масштаб'},root);
const flightControls=node('div',{class:'flight-controls','aria-label':'Управление полётом'},root);
const flightButtons=[['up','▲'],['thrust','УСК'],['boost','ФОРС'],['left','◀'],['brake','ТОРМ'],['right','▶'],['down','▼'],['rollL','↺'],['rollR','↻']];
flightButtons.forEach(([key,label])=>{const b=node('button',{text:label,'aria-label':key},flightControls);const set=v=>{flightInput[key]=v};b.addEventListener('pointerdown',e=>{e.preventDefault();set(true);try{b.setPointerCapture(e.pointerId)}catch(_){}});['pointerup','pointercancel','lostpointercapture','pointerleave'].forEach(t=>b.addEventListener(t,()=>set(false)));});
const bottom=node('div',{class:'bottom'},root);
const allBtn=node('button',{text:'ВСЕ СИСТЕМЫ'},bottom),inhBtn=node('button',{text:'ОБЖИТЫЕ · НЕТ ДАННЫХ'},bottom),zoomInBtn=node('button',{text:'+'},bottom),zoomOutBtn=node('button',{text:'−'},bottom),resetBtn=node('button',{text:'СБРОС ВИДА'},bottom),closeBtn=node('button',{class:'close',text:'В ИГРУ'},bottom);
inhBtn.disabled=true;
const menuBtn=node('button',{id:'sf-galaxy-menu',text:'КАРТА ГАЛАКТИКИ · NAV'});
$('mnmain')?.appendChild(menuBtn);
const hudBtn=node('button',{id:'sf-galaxy-hud',text:'КАРТА [N]'},$('hud'));

const scene=new T.Scene();scene.background=new T.Color(0x020711);
const camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.1,14000);
scene.add(new T.AmbientLight(0x8ebfff,1.1));
const galaxy=new T.Group();scene.add(galaxy);
const localGroup=new T.Group();scene.add(localGroup);
let seed=0x51a7fa11;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
const nbg=matchMedia('(pointer:coarse)').matches?900:1800,bgpos=new Float32Array(nbg*3);
for(let i=0;i<nbg;i++){const r=4200+rnd()*4200,a=rnd()*Math.PI*2,z=rnd()*2-1,q=Math.sqrt(1-z*z);bgpos.set([r*q*Math.cos(a),r*z*.24,r*q*Math.sin(a)],i*3);}
const bggeo=new T.BufferGeometry();bggeo.setAttribute('position',new T.BufferAttribute(bgpos,3));
scene.add(new T.Points(bggeo,new T.PointsMaterial({color:0x789dbb,size:1.3,sizeAttenuation:false,transparent:true,opacity:.55})));
const local=[
{name:SYS[0].n,title:SYS[0].p,index:0,x:-260,y:30,z:-80},
{name:SYS[1].n,title:SYS[1].p,index:1,x:150,y:-110,z:130},
{name:SYS[2].n,title:SYS[2].p,index:2,x:70,y:190,z:-210},
{name:SYS[3].n,title:SYS[3].p,index:3,x:320,y:80,z:220},
{name:SYS[4].n,title:SYS[4].p,index:4,x:-180,y:-170,z:300}
];
const localColors=[0x63dfff,0xffb36a,0xc99aff,0x80e7b1,0xff8294];
const lp=[],lc=[];
local.forEach((r,i)=>{lp.push(r.x,r.y,r.z);const c=new T.Color(localColors[i]);lc.push(c.r,c.g,c.b);const m=new T.Mesh(new T.SphereGeometry(5.5,10,8),new T.MeshBasicMaterial({color:localColors[i]}));m.position.set(r.x,r.y,r.z);localGroup.add(m);});
const lg=new T.BufferGeometry();lg.setAttribute('position',new T.Float32BufferAttribute(lp,3));lg.setAttribute('color',new T.Float32BufferAttribute(lc,3));
const localPoints=new T.Points(lg,new T.PointsMaterial({size:9,sizeAttenuation:false,vertexColors:true}));localGroup.add(localPoints);
const ring=new T.Mesh(new T.TorusGeometry(13,.8,6,48),new T.MeshBasicMaterial({color:0x7ceaff,transparent:true,opacity:.95}));ring.visible=false;scene.add(ring);
const routeMat=new T.LineBasicMaterial({color:0xffc46b,transparent:true,opacity:.9});
let routeLine=null,records=[],filtered=[],selected=null,routeStart=null,routeEnd=null,points=null;let populationAvailable=false;
let previousState='menu',previousHud='',opened=false,yaw=.18,pitch=.12,distance=3300,drag=null,target=new T.Vector3();
const externalRaycaster=new T.Raycaster(),externalPointer=new T.Vector2();
const originalTouchAction=R.domElement.style.touchAction;
const posOf=r=>new T.Vector3(r.x*.035,r.y*.035,r.z*.035);
function disposePoints(){if(points){galaxy.remove(points);points.geometry.dispose();points.material.dispose();points=null;}}
function buildPoints(list){
 disposePoints();const p=new Float32Array(list.length*3),c=new Float32Array(list.length*3);
 list.forEach((r,i)=>{p[i*3]=r.x*.035;p[i*3+1]=r.y*.035;p[i*3+2]=r.z*.035;const pop=+r.p||0,col=new T.Color(pop>1e8?0xffc56f:pop>0?0x68d9e9:0x8a9eb8);c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b;});
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('color',new T.BufferAttribute(c,3));
 points=new T.Points(g,new T.PointsMaterial({size:2.5,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.9}));points.frustumCulled=false;galaxy.add(points);
 const inhabitedCount=records.reduce((n,r)=>n+(r.p>0?1:0),0);
 allBtn.disabled=list.length===records.length;
 inhBtn.disabled=!(populationAvailable&&inhabitedCount>0)||list.length===inhabitedCount;
 inhBtn.textContent=populationAvailable?(inhabitedCount?'ОБЖИТЫЕ':'ОБЖИТЫЕ · НЕТ В ВЫБОРКЕ'):'ОБЖИТЫЕ · НЕТ ДАННЫХ';
 inhBtn.title=inhBtn.disabled?'В источнике Spansh нет пригодных данных о населении для фильтрации.':'Показать системы с населением больше нуля.';
 status.textContent=list.length.toLocaleString('ru-RU')+' систем Spansh · выборка, не полная галактика'+(populationAvailable?' · обитаемых в выборке: '+inhabitedCount:' · population отсутствует, фильтр отключён');
}
async function loadCatalog(){
 if(records.length)return;
 try{
  const manifestUrl=new URL('./data/elite-dangerous-lite/systems.jsonl.gz.manifest.json',document.baseURI);
  const manifestResponse=await fetch(manifestUrl,{cache:'no-cache'});
  if(!manifestResponse.ok)throw Error('manifest HTTP '+manifestResponse.status);
  const manifest=await manifestResponse.json();
  if(manifest.format!=='starfall-systems-jsonl-v1'||!Number.isInteger(manifest.records)||manifest.records<1||!/^[a-f0-9]{64}$/i.test(manifest.sha256)||!Number.isInteger(manifest.compressed_bytes)||manifest.compressed_bytes<1)throw Error('неверный manifest');
  const url=new URL('./data/elite-dangerous-lite/systems.jsonl.gz',document.baseURI);
  url.searchParams.set('sha256',manifest.sha256);
  const res=await fetch(url,{cache:'force-cache'});if(!res.ok)throw Error('HTTP '+res.status);
  if(!res.body||!window.DecompressionStream)throw Error('нет DecompressionStream для gzip');
  if(!window.crypto||!crypto.subtle)throw Error('Web Crypto SHA-256 недоступен; откройте игру по HTTPS');
  const compressed=await res.clone().arrayBuffer();
  if(Number.isInteger(manifest.compressed_bytes)&&compressed.byteLength!==manifest.compressed_bytes)throw Error('размер архива не совпадает с manifest');
  const digest=await crypto.subtle.digest('SHA-256',compressed);
  const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==manifest.sha256)throw Error('SHA-256 архива не совпадает с manifest');
  const reader=res.body.pipeThrough(new DecompressionStream('gzip')).getReader(),decoder=new TextDecoder();
  let pending='';const list=[];
  const appendLine=line=>{
   if(!line)return;
   const v=JSON.parse(line);
   if(!v||typeof v.id!=='string'||typeof v.n!=='string'||!Number.isFinite(v.x)||!Number.isFinite(v.y)||!Number.isFinite(v.z))throw Error('некорректная запись каталога');
   list.push({id:v.id,name:v.n,searchName:v.n.toLocaleLowerCase(),x:v.x,y:v.y,z:v.z,p:+v.p||0,a:v.a||'',g:v.g||'',s:v.s||'',e:v.e||'',e2:v.e2||'',f:v.f||'',bc:+v.bc||0});
  };
  while(true){const part=await reader.read();if(part.done)break;pending+=decoder.decode(part.value,{stream:true});let cut;
   while((cut=pending.indexOf('\n'))>=0){appendLine(pending.slice(0,cut));pending=pending.slice(cut+1);}
  }
  pending+=decoder.decode();if(pending.trim())appendLine(pending);
  if(list.length!==manifest.records)throw Error('число систем не совпадает с manifest: '+list.length+' / '+manifest.records);
  records=list;filtered=list;
  populationAvailable=Number(manifest.population_field_records)>0;
  buildPoints(filtered);
  status.textContent+=' · SHA-256 подтверждён';
 }catch(e){status.textContent='Каталог Spansh недоступен ('+e.message+'). Доступны 5 локальных систем STARFALL.';console.warn('[STARFALL Galaxy Map]',e);}
}
function cameraUpdate(){const cp=Math.cos(pitch);camera.position.set(target.x+distance*Math.sin(yaw)*cp,target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(yaw)*cp);camera.lookAt(target);}
function setSelected(r,isLocal){
 selected=r?{record:r,local:isLocal}:null;jumpBtn.disabled=!(selected&&isLocal&&previousState==='play'&&r.index!==sy);exploreBtn.disabled=!(selected&&!isLocal&&!!window.SF_EXTERNAL_SYSTEMS);ring.visible=!!selected;
 if(!selected){info.textContent='Выберите звёздную систему на карте или через поиск.';return;}
 const p=isLocal?new T.Vector3(r.x,r.y,r.z):posOf(r);ring.position.copy(p);ring.scale.setScalar(isLocal?1:.02);ring.rotation.x=Math.PI/2;
 info.textContent=isLocal?r.name+' / '+r.title+' · сектор STARFALL\nТип: игровая система · гиперпрыжок поддерживается':
 r.name+'\nКоординаты: '+[r.x,r.y,r.z].map(v=>v.toFixed(2)).join(' / ')+' ly\nНаселение: '+(r.p?r.p.toLocaleString('ru-RU'):'нет данных')+'\nAllegiance: '+(r.a||'—')+' · Government: '+(r.g||'—')+'\nSecurity: '+(r.s||'—')+'\nEconomy: '+[r.e,r.e2].filter(Boolean).join(' / ')+'\nФракция: '+(r.f||'—')+' · Bodies: '+(r.bc||'—')+'\nSpansh reference · не подключено к симуляции STARFALL';
}
function focus(r,isLocal){const p=isLocal?new T.Vector3(r.x,r.y,r.z):posOf(r);target.copy(p);yaw=.18;pitch=.12;distance=Math.max(240,Math.min(3300,p.length()*.2+260));cameraUpdate();setSelected(r,isLocal);}
function renderSearch(q){
 results.replaceChildren();q=q.trim().toLocaleLowerCase();if(!q)return;
 const found=[];local.forEach(r=>{if((r.name+' '+r.title).toLocaleLowerCase().includes(q))found.push({r,local:true});});
 for(const r of filtered){if((r.searchName||r.name.toLocaleLowerCase()).includes(q))found.push({r,local:false});if(found.length>=14)break;}
 found.slice(0,14).forEach(v=>{const b=node('button',{},results);node('span',{text:v.r.name},b);node('small',{text:v.local?'STARFALL':'SPANSH'},b);b.addEventListener('click',()=>focus(v.r,v.local));});
 if(!found.length)node('div',{class:'meta',text:'Совпадений нет.'},results);
}
function leaveExternal(){if(!externalRoot)return;if(flightMode)setFlightMode(false);scene.remove(externalRoot);window.SF_EXTERNAL_SYSTEMS.dispose(externalRoot);externalRoot=null;externalRecord=null;galaxy.visible=true;localGroup.visible=true;if(points)points.visible=true;if(externalCameraState){yaw=externalCameraState.yaw;pitch=externalCameraState.pitch;distance=externalCameraState.distance;target.copy(externalCameraState.target);externalCameraState=null;cameraUpdate()}ring.visible=!!selected;if(routeLine)routeLine.visible=true;exploreBtn.style.display='';returnBtn.style.display='none';flightBtn.style.display='none';jumpBtn.style.display='';routeBtn.style.display='';search.disabled=false;resultsHeading.textContent='ПОИСК';renderSearch(search.value);if(selected)setSelected(selected.record,selected.local);}
function buildFlightShip(){
 const g=new T.Group(),bodyMat=new T.MeshStandardMaterial({color:0xb7cbd7,metalness:.72,roughness:.3}),wingMat=new T.MeshStandardMaterial({color:0x253e53,metalness:.62,roughness:.38}),glowMat=new T.MeshBasicMaterial({color:0x55dfff});
 const body=new T.Mesh(new T.ConeGeometry(1.45,7.5,8),bodyMat);body.rotation.x=-Math.PI/2;body.position.z=-2.2;g.add(body);
 const cockpit=new T.Mesh(new T.SphereGeometry(.82,12,8),new T.MeshStandardMaterial({color:0x3ca5ca,metalness:.4,roughness:.18,emissive:0x103c55}));cockpit.scale.set(.72,.55,1.25);cockpit.position.set(0,.72,-1.1);g.add(cockpit);
 const wings=new T.Mesh(new T.BoxGeometry(8,.22,2.2),wingMat);wings.position.set(0,-.12,.7);g.add(wings);
 for(const x of [-2.8,2.8]){const engine=new T.Mesh(new T.CylinderGeometry(.25,.42,1.6,8),glowMat);engine.rotation.x=Math.PI/2;engine.position.set(x,-.1,1.6);g.add(engine)}
 g.userData.flightShip=true;return g;
}
function updateFlightCamera(){if(!flightShip)return;const q=flightShip.quaternion,offset=new T.Vector3(0,5.5,flightCameraDistance).applyQuaternion(q),forward=new T.Vector3(0,0,-1).applyQuaternion(q);camera.position.copy(flightShip.position).add(offset);camera.up.set(0,1,0).applyQuaternion(q);camera.lookAt(flightShip.position.clone().addScaledVector(forward,32));camera.updateMatrixWorld();}
function setFlightMode(on){
 if(!externalRoot)return;
 if(on&&!flightMode){flightShip=buildFlightShip();flightVelocity=new T.Vector3();const d=externalRoot.userData.externalSystem.data;flightShip.position.set(0,0,d.star.radius+105);externalRoot.add(flightShip);flightMode=true;flightNearLabel='';flightCameraDistance=18;flightControls.style.display='grid';bottom.style.display='none';flightBtn.textContent='ОРБИТАЛЬНЫЙ ОБЗОР';resultsPanel.style.display='none';info.textContent=externalRecord.name+'\nПОЛЁТ ВНЕШНЕЙ СИСТЕМЫ · WASD / стрелки · Shift / ФОРС — форсаж · Space — тормоз';status.textContent='ПОЛЁТ · W/УСК тяга · Shift/ФОРС форсаж · S/Space тормоз · стрелки тангаж · A/D поворот · Q/E крен. Исследование не меняет экономику STARFALL.';updateFlightCamera();}
 else if(!on&&flightMode){flightMode=false;flightControls.style.display='none';bottom.style.display='';resultsPanel.style.display='';if(flightShip){externalRoot.remove(flightShip);flightShip.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});flightShip=null;}flightVelocity=null;for(const k in flightInput)flightInput[k]=false;camera.up.set(0,1,0);target.set(0,0,0);yaw=.5;pitch=.22;distance=330;cameraUpdate();flightBtn.textContent='НАЧАТЬ ПОЛЁТ';status.textContent='ОРБИТАЛЬНЫЙ ОБЗОР · выберите объект для фокусировки или снова начните полёт.';}
}
function updateFlight(dt){
 if(!flightMode||!flightShip||!flightVelocity)return;dt=Math.min(.05,Math.max(0,dt));
 const key=(...codes)=>codes.some(c=>flightKeys.has(c));
 const left=flightInput.left||key('KeyA','ArrowLeft'),right=flightInput.right||key('KeyD','ArrowRight'),up=flightInput.up||key('ArrowUp'),down=flightInput.down||key('ArrowDown'),thrust=flightInput.thrust||key('KeyW'),brake=flightInput.brake||key('KeyS','Space'),rollL=flightInput.rollL||key('KeyQ'),rollR=flightInput.rollR||key('KeyE');
 const boost=flightInput.boost||key('ShiftLeft','ShiftRight'),turn=1.25*dt;
 if(left)flightShip.rotateY(turn);if(right)flightShip.rotateY(-turn);if(up)flightShip.rotateX(turn);if(down)flightShip.rotateX(-turn);if(rollL)flightShip.rotateZ(turn);if(rollR)flightShip.rotateZ(-turn);
 const forward=new T.Vector3(0,0,-1).applyQuaternion(flightShip.quaternion).normalize();
 if(thrust)flightVelocity.addScaledVector(forward,(boost?82:38)*dt);
 if(brake)flightVelocity.multiplyScalar(Math.exp(-2.8*dt));else if(!thrust)flightVelocity.multiplyScalar(Math.exp(-.075*dt));
 const maxSpeed=boost?190:105;if(flightVelocity.length()>maxSpeed)flightVelocity.setLength(maxSpeed);
 flightShip.position.addScaledVector(flightVelocity,dt);externalRoot.updateMatrixWorld(true);
 const sys=externalRoot.userData.externalSystem,d=sys.data;let collision=null;
 const resolve=(object,radius,label)=>{if(!object||collision)return;const p=object.getWorldPosition(new T.Vector3()),delta=flightShip.position.clone().sub(p),min=radius+3,dist=delta.length();if(dist<min){const normal=dist>1e-5?delta.multiplyScalar(1/dist):new T.Vector3(0,1,0);flightShip.position.copy(p).addScaledVector(normal,min);const inward=flightVelocity.dot(normal);if(inward<0)flightVelocity.addScaledVector(normal,-1.45*inward);flightVelocity.multiplyScalar(.48);collision=label;}};
 resolve(d.star.mesh,d.star.radius,'ЗВЕЗДА');for(const p of d.planets)resolve(p.mesh,p.radius,'ПЛАНЕТА '+p.index);if(d.station)resolve(d.station.mesh,7,'СТАНЦИЯ');
 let nearest='',nearestDist=Infinity;for(const p of d.planets){const wp=p.mesh.getWorldPosition(new T.Vector3()),dist=wp.distanceTo(flightShip.position);if(dist<nearestDist){nearestDist=dist;nearest='ПЛАНЕТА '+p.index+' · '+p.type;}}if(d.station){const wp=d.station.mesh.getWorldPosition(new T.Vector3()),dist=wp.distanceTo(flightShip.position);if(dist<nearestDist){nearestDist=dist;nearest='СТАНЦИЯ';}}if(d.belt){const dist=Math.abs(Math.hypot(flightShip.position.x,flightShip.position.z)-d.belt.orbit);if(dist<nearestDist){nearestDist=dist;nearest='ПОЯС АСТЕРОИДОВ';}}
 if(collision){status.textContent='АВАРИЙНОЕ СБЛИЖЕНИЕ · '+collision+' · скорость снижена';flightNearLabel='';}else if(nearestDist<24){if(flightNearLabel!==nearest){flightNearLabel=nearest;status.textContent='СКАНИРОВАНИЕ · '+nearest+' · '+nearestDist.toFixed(1)+' усл. ед.';}}else flightNearLabel='';
 info.textContent=externalRecord.name+'\nПОЛЁТ · скорость '+flightVelocity.length().toFixed(1)+' усл. ед./с'+(boost?' · ФОРСАЖ':'');updateFlightCamera();
}
const flightKeys=new Set();
function focusExternalObject(object,radius,label){
 if(flightMode){setFlightMode(false);}

 if(!externalRoot||!object)return;externalRoot.updateMatrixWorld(true);
 const p=object.getWorldPosition(new T.Vector3());target.copy(p);
 distance=Math.max(24,Math.min(1200,radius*7));cameraUpdate();
 status.textContent='ОБЗОР ОБЪЕКТА · '+label+' · масштаб '+Math.round(distance)+' усл. ед.';
}
function pickExternal(clientX,clientY){
 if(!externalRoot)return false;const rect=R.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return false;
 externalPointer.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1));
 externalRaycaster.setFromCamera(externalPointer,camera);
 const hits=externalRaycaster.intersectObject(externalRoot,true);
 for(const hit of hits){let object=hit.object;while(object&&object!==externalRoot&&!object.userData.externalFocus)object=object.parent;if(object&&object.userData.externalFocus){const f=object.userData.externalFocus;focusExternalObject(object,f.radius,f.label);return true}}
 return false;
}
function showExternalObjects(){
 resultsHeading.textContent='ОБЪЕКТЫ СИСТЕМЫ';results.replaceChildren();
 const d=externalRoot.userData.externalSystem.data;
 const add=(label,object,radius)=>{const b=node('button',{},results);node('span',{text:label},b);node('small',{text:'ОБЗОР'},b);b.addEventListener('click',()=>focusExternalObject(object,radius,label))};
 add('ЗВЕЗДА · '+d.star.class,d.star.mesh,d.star.radius);
 d.planets.forEach(p=>add('ПЛАНЕТА '+p.index+' · '+p.type,p.mesh,p.radius));
 if(d.station)add('СТАНЦИЯ · '+d.station.type,d.station.mesh,12);
 if(d.belt)add('ПОЯС АСТЕРОИДОВ',externalRoot.userData.externalSystem.beltFocus,d.belt.width);
}
function exploreExternal(){
 if(!selected||selected.local||!window.SF_EXTERNAL_SYSTEMS)return;
 if(externalRoot)leaveExternal();
 externalRecord=selected.record;externalCameraState={yaw,pitch,distance,target:target.clone()};if(routeLine)routeLine.visible=false;galaxy.visible=false;localGroup.visible=false;if(points)points.visible=false;ring.visible=false;
 externalRoot=window.SF_EXTERNAL_SYSTEMS.build(externalRecord,T,matchMedia('(pointer:coarse)').matches);scene.add(externalRoot);showExternalObjects();
 target.set(0,0,0);yaw=.5;pitch=.22;distance=330;cameraUpdate();
 const d=externalRoot.userData.externalSystem.data;
 info.textContent=externalRecord.name+'\nПРОЦЕДУРНАЯ СИСТЕМА · ID '+d.id+'\nЗвезда: '+d.star.class+' · '+d.star.name+'\nТемпература: '+d.star.temp+'\nПланеты: '+d.planets.length+' · Пояс астероидов: '+(d.belt?'есть':'нет')+'\nСтанция: '+(d.station?d.station.type:'не обнаружена')+'\nОрбитальный обзор · экономика STARFALL не затрагивается';
 exploreBtn.style.display='none';returnBtn.style.display='';flightBtn.style.display='';jumpBtn.style.display='none';routeBtn.style.display='none';search.disabled=true;
 status.textContent='ОРБИТАЛЬНЫЙ ОБЗОР · вращайте систему, выбирайте объекты или начните полёт. Генерация по ID воспроизводима.';
}
function close(){
 if(!opened)return;if(externalRoot)leaveExternal();opened=false;root.style.display='none';R.domElement.style.touchAction=originalTouchAction;state=previousState;
 if($('hud'))$('hud').style.display=previousHud;
 if(previousState==='menu')$('menu')?.classList.remove('hide');
 if(previousState==='jumpmenu')$('jmp')?.classList.remove('hide');
 if(previousState==='dock')$('mkt')?.classList.remove('hide');
 hudBtn.style.display=state==='play'?'block':'none';
}
async function open(){
 if(opened)return;previousState=state;previousHud=$('hud')?.style.display||'';
 if(previousState==='menu')$('menu')?.classList.add('hide');
 if(previousState==='jumpmenu')$('jmp')?.classList.add('hide');
 if(previousState==='dock')$('mkt')?.classList.add('hide');
 state='galaxy';if($('hud'))$('hud').style.display='none';hudBtn.style.display='none';
 root.style.display='block';opened=true;R.domElement.style.touchAction='none';cameraUpdate();await loadCatalog();if(selected)setSelected(selected.record,selected.local);
}
function jumpLocal(){
 if(!selected||!selected.local||previousState!=='play'||selected.record.index===sy)return;
 const target=selected.record.index;close();if($('hud'))$('hud').style.display='block';$('jmp')?.classList.add('hide');jd=target;jt=2.2;state='jump';
}
function routeAction(){
 if(routeEnd){routeStart=routeEnd=null;routeBtn.textContent='НАЧАТЬ МАРШРУТ';if(routeLine){scene.remove(routeLine);routeLine.geometry.dispose();routeLine=null;}return;}
 if(!selected){status.textContent='Сначала выберите систему.';return;}
 if(!routeStart){routeStart=selected;routeBtn.textContent='ВЫБРАТЬ ФИНИШ';status.textContent='Старт: '+selected.record.name+'. Выберите систему назначения.';return;}
 routeEnd=selected;routeBtn.textContent='СБРОСИТЬ МАРШРУТ';
 if(routeStart.local!==routeEnd.local){status.textContent='Маршрут между STARFALL и Spansh не строится: координаты локального сектора условные, координаты каталога заданы в ly. Выберите две системы одного слоя.';routeStart=routeEnd=null;routeBtn.textContent='НАЧАТЬ МАРШРУТ';return;}
 const a=routeStart.local?new T.Vector3(routeStart.record.x,routeStart.record.y,routeStart.record.z):posOf(routeStart.record);
 const b=routeEnd.local?new T.Vector3(routeEnd.record.x,routeEnd.record.y,routeEnd.record.z):posOf(routeEnd.record);
 if(routeLine){scene.remove(routeLine);routeLine.geometry.dispose();}
 routeLine=new T.Line(new T.BufferGeometry().setFromPoints([a,b]),routeMat);scene.add(routeLine);
 const d=routeStart.local||routeEnd.local?a.distanceTo(b):Math.hypot(routeStart.record.x-routeEnd.record.x,routeStart.record.y-routeEnd.record.y,routeStart.record.z-routeEnd.record.z);
 status.textContent='Маршрут: '+routeStart.record.name+' → '+routeEnd.record.name+' · '+d.toFixed(2)+(routeStart.local||routeEnd.local?' усл. ед.':' ly')+'. Внешний маршрут справочный.';
}
const projectedPoint=new T.Vector3();
function nearest(x,y){
 const rect=R.domElement.getBoundingClientRect(),nx=(x-rect.left)/rect.width*2-1,ny=-((y-rect.top)/rect.height*2-1);let best=null,bd=324;
 const test=(arr,isLocal)=>{for(const r of arr){const p=projectedPoint.set(isLocal?r.x:r.x*.035,isLocal?r.y:r.y*.035,isLocal?r.z:r.z*.035);p.project(camera);if(p.z< -1||p.z>1)continue;const dx=(p.x-nx)*rect.width*.5,dy=(p.y-ny)*rect.height*.5,d=dx*dx+dy*dy;if(d<bd){bd=d;best={record:r,local:isLocal};}}};
 test(local,true);test(filtered,false);return best;
}
function down(e){if(!opened||e.target.closest('#sf-galaxy .top,#sf-galaxy .side,#sf-galaxy .bottom,#sf-galaxy .flight-controls'))return;drag={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};try{R.domElement.setPointerCapture(e.pointerId);}catch(_){}}
function move(e){if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;if(flightMode&&flightShip){flightShip.rotateY(-dx*.004);flightShip.rotateX(-dy*.004);updateFlightCamera();return;}yaw-=dx*.005;pitch=Math.max(-1.35,Math.min(1.35,pitch+dy*.004));cameraUpdate();}
function up(e){if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(!moved&&externalRoot&&!flightMode){pickExternal(e.clientX,e.clientY);}else if(!moved){const h=nearest(e.clientX,e.clientY);if(h){setSelected(h.record,h.local);status.textContent=h.local?'Локальная система STARFALL.':'Запись Spansh: справочные данные.';}}}
function wheel(e){if(!opened)return;e.preventDefault();if(flightMode){flightCameraDistance=Math.max(9,Math.min(42,flightCameraDistance*Math.exp(e.deltaY*.001)));updateFlightCamera();return;}distance=Math.max(180,Math.min(9000,distance*Math.exp(e.deltaY*.001)));cameraUpdate();}
R.domElement.addEventListener('pointerdown',down);R.domElement.addEventListener('pointermove',move);R.domElement.addEventListener('pointerup',up);R.domElement.addEventListener('pointercancel',()=>drag=null);R.domElement.addEventListener('wheel',wheel,{passive:false});
search.addEventListener('input',()=>renderSearch(search.value));jumpBtn.addEventListener('click',jumpLocal);routeBtn.addEventListener('click',routeAction);exploreBtn.addEventListener('click',exploreExternal);returnBtn.addEventListener('click',leaveExternal);flightBtn.addEventListener('click',()=>setFlightMode(!flightMode));
[closeTop,closeBtn].forEach(b=>b.addEventListener('click',close));menuBtn.addEventListener('click',open);hudBtn.addEventListener('click',open);
allBtn.addEventListener('click',()=>{filtered=records;buildPoints(filtered);});
inhBtn.addEventListener('click',()=>{if(inhBtn.disabled)return;filtered=records.filter(r=>r.p>0);buildPoints(filtered);});
zoomInBtn.addEventListener('click',()=>{distance=Math.max(180,distance*.78);cameraUpdate();});zoomOutBtn.addEventListener('click',()=>{distance=Math.min(9000,distance/ .78);cameraUpdate();});
resetBtn.addEventListener('click',()=>{yaw=.18;pitch=.12;distance=3300;target.set(0,0,0);cameraUpdate();if(routeLine){scene.remove(routeLine);routeLine.geometry.dispose();routeLine=null;}routeStart=routeEnd=null;routeBtn.textContent='НАЧАТЬ МАРШРУТ';});
addEventListener('keydown',e=>{const target=e.target;if(target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))return;flightKeys.add(e.code);if(e.code==='KeyN'&&!e.repeat&&(opened||state==='menu'||state==='play'||state==='jumpmenu')){e.preventDefault();opened?close():open();}if(e.code==='Escape'&&opened){e.preventDefault();close();}});
addEventListener('keyup',e=>flightKeys.delete(e.code));addEventListener('blur',()=>{flightKeys.clear();for(const k in flightInput)flightInput[k]=false;});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
function render(dt){if(!opened)return;if(externalRoot){window.SF_EXTERNAL_SYSTEMS.update(externalRoot,Math.min(.05,Math.max(0,dt||0)));if(flightMode)updateFlight(dt||0);}R.render(scene,camera);}
window.SF_GALAXY_MAP={open,close,render,get stats(){let external=null;if(externalRoot){const data=externalRoot.userData.externalSystem.data,p=data.star.mesh.getWorldPosition(new T.Vector3()).project(camera),rect=R.domElement.getBoundingClientRect();external={name:externalRecord?.name,planets:data.planets.length,star:data.star.class,flight:flightMode,speed:flightVelocity?.length()||0,starScreen:{x:rect.left+(p.x+1)*rect.width*.5,y:rect.top+(1-p.y)*rect.height*.5,visible:p.z>=-1&&p.z<=1}};}return{catalog:records.length,visible:filtered.length,selected:selected?.record?.name||null,external};}};
try{const oldLift=lift;lift=function(){oldLift();hudBtn.style.display='block';};const oldArrive=arrive;arrive=function(){oldArrive();hudBtn.style.display='block';};}catch(e){console.warn('[STARFALL Galaxy Map] HUD hook',e);}
if(typeof state!=='undefined'&&state==='play')hudBtn.style.display='block';
})();