export class HUD {
  constructor(){
    this.el={
      status:document.getElementById("status"),speed:document.getElementById("speed-value"),
      hull:document.getElementById("hull-value"),shield:document.getElementById("shield-value"),
      hullBar:document.getElementById("hull-bar"),shieldBar:document.getElementById("shield-bar"),
      target:document.getElementById("target-value"),enemy:document.getElementById("enemy-value"),
      enemyBar:document.getElementById("enemy-bar"),score:document.getElementById("score-value"),
      toast:document.getElementById("toast"),fps:document.getElementById("fps"),
      diagnostics:document.getElementById("diagnostics")
    };
    this.toastTimer=0;
  }
  update(data){
    this.el.status.textContent=data.engine?"SYSTEMS NOMINAL":"ENGINE LOST";
    this.el.speed.textContent=Math.round(data.speed).toString();
    this.el.hull.textContent=Math.round(data.hull)+"%";
    this.el.shield.textContent=Math.round(data.shield)+"%";
    this.el.hullBar.style.width=data.hull+"%";
    this.el.shieldBar.style.width=data.shield+"%";
    this.el.target.textContent=data.target;
    this.el.enemy.textContent=Math.round(data.enemyHealth)+"%";
    this.el.enemyBar.style.width=data.enemyHealth+"%";
    this.el.score.textContent=data.kills+" / "+data.credits;
    this.el.fps.textContent=Math.round(data.fps)+" FPS";
    this.el.diagnostics.textContent=[
      "Renderer: Babylon.js 7.0.0",
      "Collision: swept segment / sphere",
      "AI: Yuka Seek → FlightModel",
      "Frame: "+(data.frameMs||0).toFixed(2)+" ms",
      "FPS: "+data.fps.toFixed(1),
      "Projectiles: "+data.projectiles,
      "Target: "+data.target
    ].join("\n");
  }
  toast(message){
    this.el.toast.textContent=message;
    clearTimeout(this.toastTimer);
    this.toastTimer=setTimeout(()=>{this.el.toast.textContent="";},1900);
  }
}