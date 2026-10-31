import {Vehicle,Vector3 as YukaVector3,SeekBehavior} from "https://esm.sh/yuka@0.7.8";
import {FlightModel} from "./flight-model.js";
const V=(x,y,z)=>new BABYLON.Vector3(x,y,z);
export class World {
  constructor(scene){
    this.scene=scene;this._makeSky();this._makePlanet();this._makeStation();
    this.player=this._makeShip("player-ship",[.42,.56,.66],[.08,.65,1]);
    this.player.position.set(0,0,0);this.player.rotation.y=Math.PI;
    this.pirate=this._makeShip("pirate-interceptor",[.42,.2,.1],[1,.34,.04]);
    this.pirate.position.set(0,45,-850);
    this.pirateHealth=100;this.pirateMaxHealth=100;this.pirateDestroyed=false;
    this.pirateFlight=new FlightModel({maxSpeed:52,acceleration:25,drag:.12,lateralAcceleration:18});
    this.ai=new Vehicle();this.ai.maxSpeed=52;this.ai.maxForce=18;
    this.aiTarget=new YukaVector3(0,0,0);this.seek=new SeekBehavior(this.aiTarget);
    this.ai.steering.add(this.seek);this.aiFireCooldown=1.2;this.pirateAsset="procedural fallback";
    this.loadPirateAsset();
  }
  _makeSky(){
    const pcs=new BABYLON.PointsCloudSystem("starfield",2,this.scene);
    pcs.addPoints(1500,p=>{
      p.position=V((Math.random()-.5)*10000,(Math.random()-.5)*7000,(Math.random()-.5)*10000);
      p.color=new BABYLON.Color4(.58+Math.random()*.42,.7+Math.random()*.3,1,.9);
    });
    pcs.buildMeshAsync().then(mesh=>{mesh.isPickable=false;mesh.alwaysSelectAsActiveMesh=true;}).catch(console.error);
  }
  _makePlanet(){
    const planet=BABYLON.MeshBuilder.CreateSphere("purple-planet",{diameter:420,segments:48},this.scene);
    planet.position=V(1250,260,-2300);
    const material=new BABYLON.StandardMaterial("planet-mat",this.scene);
    material.diffuseColor=new BABYLON.Color3(.24,.16,.42);
    material.emissiveColor=new BABYLON.Color3(.035,.015,.09);
    material.specularColor=new BABYLON.Color3(.3,.25,.5);planet.material=material;
    const atmosphere=BABYLON.MeshBuilder.CreateSphere("planet-atmosphere",{diameter:438,segments:48},this.scene);
    atmosphere.position.copyFrom(planet.position);
    const glow=new BABYLON.StandardMaterial("atmosphere-mat",this.scene);
    glow.emissiveColor=new BABYLON.Color3(.12,.2,.65);glow.alpha=.1;glow.backFaceCulling=false;atmosphere.material=glow;
  }
  _makeStation(){
    const g=new BABYLON.TransformNode("station",this.scene);g.position=V(-900,180,-1900);
    const material=new BABYLON.StandardMaterial("station-metal",this.scene);
    material.diffuseColor=new BABYLON.Color3(.13,.2,.28);material.metallic=.82;material.roughness=.38;
    const ring=BABYLON.MeshBuilder.CreateTorus("station-ring",{diameter:300,thickness:18,tessellation:64},this.scene);
    ring.parent=g;ring.rotation.x=Math.PI/2;ring.material=material;
    const core=BABYLON.MeshBuilder.CreateCylinder("station-core",{height:90,diameter:105,tessellation:32},this.scene);
    core.parent=g;core.material=material;
    for(let i=0;i<4;i++){
      const arm=BABYLON.MeshBuilder.CreateBox("station-arm",{width:24,height:24,depth:190},this.scene);
      arm.parent=g;arm.position.x=(i-1.5)*52;arm.material=material;
    }
    const dock=BABYLON.MeshBuilder.CreateTorus("station-dock",{diameter:95,thickness:4,tessellation:32},this.scene);
    dock.parent=g;dock.position.z=65;
    const emissive=new BABYLON.StandardMaterial("dock-glow",this.scene);
    emissive.emissiveColor=new BABYLON.Color3(.05,.65,1);dock.material=emissive;
  }
  _makeShip(name,color,accent){
    const scene=this.scene,g=new BABYLON.TransformNode(name,scene);
    const hull=new BABYLON.StandardMaterial(name+"-hull",scene);
    hull.diffuseColor=new BABYLON.Color3(...color);hull.specularColor=new BABYLON.Color3(.7,.75,.85);hull.metallic=.72;hull.roughness=.32;
    const dark=new BABYLON.StandardMaterial(name+"-dark",scene);
    dark.diffuseColor=new BABYLON.Color3(.025,.04,.06);dark.specularColor=new BABYLON.Color3(.5,.6,.7);dark.metallic=.8;dark.roughness=.42;
    const glow=new BABYLON.StandardMaterial(name+"-glow",scene);glow.emissiveColor=new BABYLON.Color3(...accent);
    const body=BABYLON.MeshBuilder.CreateCylinder(name+"-nose",{height:10,diameterTop:0,diameterBottom:8,tessellation:8},scene);
    body.parent=g;body.rotation.x=Math.PI/2;body.scaling.z=1.8;body.material=hull;
    const cockpit=BABYLON.MeshBuilder.CreateSphere(name+"-canopy",{diameter:5,segments:16},scene);
    cockpit.parent=g;cockpit.position.set(0,2,-4);cockpit.scaling.set(.8,.45,1.25);cockpit.material=glow;
    for(const side of [-1,1]){
      const wing=BABYLON.MeshBuilder.CreateBox(name+"-wing",{width:15,height:1.1,depth:7},scene);
      wing.parent=g;wing.position.set(side*8,0,1);wing.rotation.y=side*.12;wing.material=dark;
      const engine=BABYLON.MeshBuilder.CreateCylinder(name+"-engine",{height:4,diameter:2.2,tessellation:12},scene);
      engine.parent=g;engine.rotation.x=Math.PI/2;engine.position.set(side*4,0,6);engine.material=glow;
      const flame=BABYLON.MeshBuilder.CreateCylinder(name+"-flame",{height:12,diameterTop:.2,diameterBottom:2.6,tessellation:12},scene);
      flame.parent=g;flame.rotation.x=-Math.PI/2;flame.position.set(side*4,0,12);
      const fm=new BABYLON.StandardMaterial(name+"-flame-mat",scene);
      fm.emissiveColor=new BABYLON.Color3(...accent);fm.alpha=.5;flame.material=fm;
    }
    return g;
  }
  async loadPirateAsset(){
    try{
      const result=await BABYLON.SceneLoader.ImportMeshAsync("","../assets/ships/pirate/pirate_fighter_001/","pirate_droid_001.glb",this.scene);
      const root=new BABYLON.TransformNode("pirate-glb-root",this.scene);
      result.meshes.filter(mesh=>mesh.parent===null).forEach(mesh=>{mesh.parent=root;});
      root.position.copyFrom(this.pirate.position);root.scaling.setAll(.8);
      this.pirate.setEnabled(false);this.pirate=root;this.pirateAsset="v85 pirate_droid_001.glb";
    }catch(error){console.warn("[STARFALL] Pirate GLB unavailable; procedural fighter retained",error);}
  }
  updateAI(dt){
    if(this.pirateDestroyed)return;
    const p=this.pirate.position;
    this.ai.position.set(p.x,p.y,p.z);
    this.ai.velocity.set(this.pirateFlight.velocity.x,this.pirateFlight.velocity.y,this.pirateFlight.velocity.z);
    this.aiTarget.set(this.player.position.x,this.player.position.y,this.player.position.z);
    const force=new YukaVector3();this.seek.calculate(this.ai,force);
    this.pirateFlight.applySteering(force,dt,18);
    p.addInPlace(this.pirateFlight.velocity.scale(dt));
    this.pirate.lookAt(this.player.position);
    this.aiFireCooldown-=dt;
    if(this.aiFireCooldown<=0){this.aiFireCooldown=1.35;return true;}
    return false;
  }
  damagePirate(amount){
    if(this.pirateDestroyed)return false;
    this.pirateHealth=Math.max(0,this.pirateHealth-amount);
    if(this.pirateHealth===0){this.pirateDestroyed=true;this.pirate.setEnabled(false);return true;}
    return false;
  }
  respawnPirate(){
    this.pirateDestroyed=false;this.pirateHealth=this.pirateMaxHealth;
    this.pirate.position.copyFrom(this.player.position).addInPlace(V(0,55,-850));
    this.pirateFlight.reset();this.pirate.setEnabled(true);
  }
}