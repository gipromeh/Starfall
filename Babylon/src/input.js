export class InputAdapter {
  constructor(canvas) {
    this.canvas=canvas;
    this.keys=new Set();
    this.pointer={x:0,y:0,dx:0,dy:0,locked:false};
    this.touch={strafe:0,lift:0};
    this.actions={fire:false,missile:false,boost:false};
    this.down=e=>{this.keys.add(e.code);if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();};
    this.up=e=>this.keys.delete(e.code);
    this.move=e=>{
      if(document.pointerLockElement===canvas){
        this.pointer.locked=true;
        this.pointer.dx+=e.movementX;
        this.pointer.dy+=e.movementY;
      } else if(e.pointerType!=="touch") {
        this.pointer.x=(e.clientX/innerWidth-.5)*2;
        this.pointer.y=(e.clientY/innerHeight-.5)*2;
      }
    };
    this.lock=()=>{this.pointer.locked=document.pointerLockElement===canvas;};
    addEventListener("keydown",this.down);
    addEventListener("keyup",this.up);
    addEventListener("mousemove",this.move);
    document.addEventListener("pointerlockchange",this.lock);
    canvas.addEventListener("pointerdown",e=>{
      if(e.pointerType==="mouse"&&e.button===0)this.actions.fire=true;
      if(e.pointerType==="mouse"&&e.button===2)this.actions.missile=true;
      if(e.pointerType==="touch"){this.pointer.x=(e.clientX/innerWidth-.5)*2;this.pointer.y=(e.clientY/innerHeight-.5)*2;}
    });
    canvas.addEventListener("pointerup",e=>{if(e.button===0)this.actions.fire=false;if(e.button===2)this.actions.missile=false;});
    canvas.addEventListener("pointercancel",()=>{this.actions.fire=false;this.actions.missile=false;});
    canvas.addEventListener("pointermove",e=>{if(e.pointerType==="touch"){this.pointer.x=(e.clientX/innerWidth-.5)*2;this.pointer.y=(e.clientY/innerHeight-.5)*2;}});
    canvas.addEventListener("contextmenu",e=>e.preventDefault());
    canvas.addEventListener("click",()=>{if(matchMedia("(pointer:fine)").matches&&!this.pointer.locked)canvas.requestPointerLock?.();});
    document.querySelectorAll("[data-action]").forEach(button=>{
      const action=button.dataset.action;
      button.addEventListener("pointerdown",e=>{e.preventDefault();this.actions[action]=true;});
      ["pointerup","pointercancel","pointerleave"].forEach(type=>button.addEventListener(type,()=>this.actions[action]=false));
    });
    const pad=document.getElementById("touch-pad");
    let pointerId=null;
    pad.addEventListener("pointerdown",e=>{pointerId=e.pointerId;pad.setPointerCapture(pointerId);this.updateTouch(e);});
    pad.addEventListener("pointermove",e=>{if(pointerId===e.pointerId)this.updateTouch(e);});
    ["pointerup","pointercancel"].forEach(type=>pad.addEventListener(type,e=>{
      if(pointerId===e.pointerId){pointerId=null;this.touch.strafe=0;this.touch.lift=0;pad.querySelector("i").style.transform="translate(0,0)";}
    }));
  }
  updateTouch(event){
    const rect=document.getElementById("touch-pad").getBoundingClientRect();
    const x=Math.max(-1,Math.min(1,(event.clientX-rect.left-rect.width/2)/(rect.width*.42)));
    const y=Math.max(-1,Math.min(1,-(event.clientY-rect.top-rect.height/2)/(rect.height*.42)));
    this.touch.strafe=x;this.touch.lift=y;
    document.querySelector(".touch-pad i").style.transform="translate("+x*32+"px,"+(-y*32)+"px)";
  }
  read(){
    const k=this.keys;
    const result={
      throttle:(k.has("KeyW")||k.has("ArrowUp")?1:0)-(k.has("KeyS")||k.has("ArrowDown")?1:0),
      strafe:(k.has("KeyD")?1:0)-(k.has("KeyA")?1:0)+this.touch.strafe,
      lift:(k.has("KeyR")?1:0)-(k.has("KeyC")?1:0)+this.touch.lift,
      roll:(k.has("KeyQ")?1:0)-(k.has("KeyZ")?1:0),
      aimX:this.pointer.locked?this.pointer.dx*.0025:this.pointer.x,
      aimY:this.pointer.locked?this.pointer.dy*.0025:this.pointer.y,
      boost:k.has("ShiftLeft")||k.has("ShiftRight")||this.actions.boost,
      fire:this.actions.fire,
      missile:k.has("KeyF")||k.has("Space")||this.actions.missile,
      brake:k.has("KeyX"),
      pause:k.has("Escape")||k.has("KeyP"),
      diagnostics:k.has("F3")||k.has("Backquote")
    };
    this.pointer.dx=0;this.pointer.dy=0;
    return result;
  }
  dispose(){
    removeEventListener("keydown",this.down);removeEventListener("keyup",this.up);
    removeEventListener("mousemove",this.move);document.removeEventListener("pointerlockchange",this.lock);
  }
}