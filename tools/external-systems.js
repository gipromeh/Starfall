/* Deterministic, economy-isolated external star-system generator. */
(() => {
'use strict';
if (window.SF_EXTERNAL_SYSTEMS) return;
const STAR=[
 {class:'M',name:'КРАСНЫЙ КАРЛИК',color:0xff8057,temp:'2 400–3 700 K',radius:13},
 {class:'K',name:'ОРАНЖЕВЫЙ КАРЛИК',color:0xffbd79,temp:'3 700–5 200 K',radius:17},
 {class:'G',name:'ЖЁЛТАЯ ЗВЕЗДА',color:0xfff0b0,temp:'5 200–6 000 K',radius:20},
 {class:'F',name:'ЖЁЛТО-БЕЛАЯ ЗВЕЗДА',color:0xfff5d9,temp:'6 000–7 500 K',radius:23},
 {class:'A',name:'БЕЛАЯ ЗВЕЗДА',color:0xdceaff,temp:'7 500–10 000 K',radius:27},
 {class:'B',name:'ГОЛУБОЙ ГИГАНТ',color:0x83baff,temp:'10 000–30 000 K',radius:34}
];
const TYPES=[
 {name:'КАМЕНИСТАЯ',color:0x9a7969,radius:[4,7]},
 {name:'ОКЕАНИЧЕСКАЯ',color:0x287cb8,radius:[6,10]},
 {name:'ПУСТЫННАЯ',color:0xc49a62,radius:[5,9]},
 {name:'ЛЕДЯНАЯ',color:0x9bc8dc,radius:[4,8]},
 {name:'ГАЗОВЫЙ ГИГАНТ',color:0xc49a7d,radius:[10,16]},
 {name:'СУПЕРЗЕМЛЯ',color:0x658d72,radius:[7,12]}
];
function hash(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function generate(record){
 const id=String(record.id||record.name||'unknown'),r=rng(hash(id)),star=STAR[Math.min(5,Math.floor(r()*6))],count=2+Math.floor(r()*7),planets=[];
 for(let i=0;i<count;i++){const type=TYPES[Math.floor(r()*TYPES.length)],radius=type.radius[0]+r()*(type.radius[1]-type.radius[0]),orbit=72+i*43+r()*18;planets.push({index:i+1,type:type.name,color:type.color,radius:+radius.toFixed(2),orbit:+orbit.toFixed(2),phase:+(r()*Math.PI*2).toFixed(4),inclination:+((r()-.5)*.16).toFixed(4),period:+(Math.pow(orbit/72,1.5)*18).toFixed(2),moons:type.name==='ГАЗОВЫЙ ГИГАНТ'?Math.floor(r()*4):Math.floor(r()*2)})}
 const belt=r()<.68?{orbit:+(planets[Math.max(0,Math.floor(count*.45)-1)].orbit+25+r()*12).toFixed(2),width:+(7+r()*9).toFixed(2),count:matchMedia('(pointer:coarse)').matches?260:520}:null;
 const station=r()<.62?{orbit:+(planets[Math.min(count-1,Math.floor(r()*count))].orbit+18+r()*18).toFixed(2),phase:+(r()*Math.PI*2).toFixed(4),type:r()<.35?'АВАНПОСТ':'ОРБИТАЛЬНАЯ СТАНЦИЯ'}:null;
 return{id,name:record.name||record.n||id,star:{class:star.class,name:star.name,color:star.color,temp:star.temp,radius:star.radius},planets,belt,station,seed:hash(id)};
}
function build(record,T,mobile){
 const data=generate(record),root=new T.Group(),star=new T.Group();root.add(star);
 const starMat=new T.MeshStandardMaterial({color:data.star.color,emissive:data.star.color,emissiveIntensity:2.1,roughness:.35});
 star.add(new T.Mesh(new T.SphereGeometry(data.star.radius,24,16),starMat));
 star.add(new T.Mesh(new T.SphereGeometry(data.star.radius*1.8,20,14),new T.MeshBasicMaterial({color:data.star.color,transparent:true,opacity:.12,side:T.BackSide,depthWrite:false})));
 root.add(new T.PointLight(data.star.color,2.2,1250,2));
 const orbitGroups=[],moonGroups=[];
 data.planets.forEach(p=>{const orbit=new T.Group();orbit.rotation.x=p.inclination;orbit.rotation.y=p.phase;root.add(orbit);orbitGroups.push({group:orbit,speed:1/p.period});const line=new T.Mesh(new T.RingGeometry(p.orbit-.22,p.orbit+.22,96),new T.MeshBasicMaterial({color:0x4f87a6,transparent:true,opacity:.2,side:T.DoubleSide,depthWrite:false}));line.rotation.x=-Math.PI/2;root.add(line);const mesh=new T.Mesh(new T.SphereGeometry(p.radius,20,14),new T.MeshStandardMaterial({color:p.color,roughness:.92}));mesh.position.set(p.orbit,0,0);orbit.add(mesh);if(p.type==='ГАЗОВЫЙ ГИГАНТ'){const ring=new T.Mesh(new T.RingGeometry(p.radius*1.35,p.radius*1.9,48),new T.MeshBasicMaterial({color:0xc9ad91,transparent:true,opacity:.34,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;mesh.add(ring)}if(p.moons){const moonOrbit=new T.Group();mesh.add(moonOrbit);moonGroups.push({group:moonOrbit,speed:.18/(p.index+1)});for(let mi=0;mi<p.moons;mi++){const mr=Math.max(.8,p.radius*(.11+mi*.025)),mo=p.radius*1.8+mi*mr*2.8,moon=new T.Mesh(new T.SphereGeometry(mr,10,8),new T.MeshStandardMaterial({color:mi%2?0x8b9098:0xb5aaa0,roughness:1}));moon.position.set(mo,0,0);moonOrbit.add(moon)}}});
 let beltGroup=null;
 if(data.belt){beltGroup=new T.Group();root.add(beltGroup);const n=data.belt.count,geo=new T.IcosahedronGeometry(1,0),mat=new T.MeshStandardMaterial({color:0x9c9588,roughness:1,flatShading:true}),inst=new T.InstancedMesh(geo,mat,n),dummy=new T.Object3D(),r=rng(data.seed^0xA57E01);for(let i=0;i<n;i++){const a=r()*Math.PI*2,rad=data.belt.orbit+(r()-.5)*data.belt.width,y=(r()-.5)*data.belt.width*.12,s=.45+r()*1.6;dummy.position.set(Math.cos(a)*rad,y,Math.sin(a)*rad);dummy.rotation.set(r()*6,r()*6,r()*6);dummy.scale.setScalar(s);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix)}inst.instanceMatrix.needsUpdate=true;beltGroup.add(inst)}
 let stationGroup=null,stationOrbitGroup=null;
 if(data.station){const stationPath=new T.Mesh(new T.RingGeometry(data.station.orbit-.28,data.station.orbit+.28,96),new T.MeshBasicMaterial({color:0x8ac6dc,transparent:true,opacity:.26,side:T.DoubleSide,depthWrite:false}));stationPath.rotation.x=-Math.PI/2;root.add(stationPath);stationOrbitGroup=new T.Group();stationOrbitGroup.rotation.y=data.station.phase;root.add(stationOrbitGroup);stationGroup=new T.Group();stationOrbitGroup.add(stationGroup);stationGroup.position.set(data.station.orbit,0,0);stationGroup.add(new T.Mesh(new T.CylinderGeometry(2.2,2.2,13,8),new T.MeshStandardMaterial({color:0x9fb8c5,metalness:.82,roughness:.3})));stationGroup.add(new T.Mesh(new T.SphereGeometry(3.4,12,8),new T.MeshStandardMaterial({color:0x6ddcff,emissive:0x164c66,emissiveIntensity:1.4})));for(let i=0;i<4;i++){const arm=new T.Mesh(new T.BoxGeometry(15,1.2,2.2),new T.MeshStandardMaterial({color:0x738995,metalness:.7,roughness:.45}));arm.rotation.y=i*Math.PI/2;stationGroup.add(arm)}}
 root.userData.externalSystem={data,orbitGroups,moonGroups,beltGroup,stationGroup,stationOrbitGroup};return root;
}
function update(root,dt){const x=root&&root.userData.externalSystem;if(!x)return;for(const o of x.orbitGroups)o.group.rotation.y+=dt*o.speed*.08;for(const o of x.moonGroups)o.group.rotation.y+=dt*o.speed;if(x.stationOrbitGroup)x.stationOrbitGroup.rotation.y+=dt*.008;if(x.beltGroup)x.beltGroup.rotation.y+=dt*.012;}
function dispose(root){if(!root)return;root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}})}
window.SF_EXTERNAL_SYSTEMS={generate,build,update,dispose};
})();