const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'STARFALL_CURRENT.html'), 'utf8');
const checks = [
 ['HTML build version matches v90', html.includes('<meta name="starfall-version" content="v90">')],
 ['laser projectiles explicitly tagged', html.includes('arr.push({m,v,dmg,life,kind:"laser"})')],
 ['ballistic projectiles explicitly tagged', html.includes('arr.push({m,v,dmg,life,kind:"projectile"})')],
 ['hostile homing missiles explicitly tagged', html.includes('q.hm=1;q.kind="hostile-missile"')],
 ['radar has rotating sweep animation', html.includes('radarSweepAngle=(now*.00048)%(Math.PI*2)')],
 ['radar uses Elite amber scanner palette', html.includes('rc.strokeStyle="#ffc078cc"')&&html.includes('#ffad63bb')],
 ['radar places altitude marker at end of stalk', html.includes('markerY=py+(height>0?-verticalOffset:verticalOffset)')],
 ['radar clips contacts to the circular scanner plane', html.includes('rc.arc(c,c,78,0,Math.PI*2);rc.clip()')],
 ['game metadata is v90', html.includes('<meta name="starfall-version" content="v90">')],
 ['radar filters eb by hostile missile type', html.includes('b.kind==="hostile-missile"&&b.hm===1')],
 ['Jackal has the slowest E/E2 speed multiplier', html.includes('*[1,.75,.85,.9][e.ty]')],
 ['Jackal has the slowest E/E2 initial speed', html.includes('multiplyScalar([18,10,12,16][ty]||18)')],
 ['Golovoroz original turn coefficient restored', html.includes('tr=[.8,1.1,.65,.75][e.ty]')],
 ['Jackal has reduced pirate-fleet spawn speed', html.includes('multiplyScalar([46,34.5,46,46][e.ty]||46)')],
 ['Jackal has reduced pirate-fleet cruise speed', html.includes('const targetSpeed=46*[1,.75,1,1][e.ty]')],
 ['player collision includes pirate fleet', html.includes('fleet:true')&&html.includes('if(h.fleet)pirateFleetDamage')],
 ['NPC collision solver exists', html.includes('function resolvePirateShipCollisions()')],
 ['NPC collision solver separates overlapping ships', html.includes('penetration=minimum-distance+.05')],
 ['NPC collision solver includes neutral transports', html.includes('n.g&&!n.tur&&n.g.visible!==false&&n.v')],
 ['collision solver runs every frame', html.includes('pirateFleetUpdate(dt);resolvePirateShipCollisions();')],
 ['pirate fleet has only two initial attackers', html.includes('[0,1].forEach((ty,i)=>{const e={slot:i,ty,g:null,hp:0,mx:0,respawn:Infinity,dead:false,flames:[]};pirateFleet.push(e);pirateFleetSpawn(e,i*.18)});')],
 ['pirate fleet spawns ahead of the player', html.includes('addScaledVector(fw,(760+e.slot*90))')],
 ['pirate fleet does not respawn after destruction', html.includes('e.respawn=Infinity;e.hits=0;')],
 ['pirate fleet opens fire only inside 420 units', html.includes('const canFire=dist<420&&(fireAngle<.9||(dist<300&&fireAngle<1.35));')],
 ['regular pirates use 380/420-unit firing ranges', html.includes('d<(e.ty===3?420:380)')],
 ['wave attacks wait until the opening fleet is cleared', html.includes('if(!E&&!pirateFleet.some(pe=>pe.g&&pe.hp>0&&!pe.dead)){if(enc>0){spawnT-=dt;')],
 ['additional E/E2 wave spawns also wait until the opening fleet is cleared', html.includes('if(!pirateFleet.some(pe=>pe.g&&pe.hp>0&&!pe.dead)&&E&&!E2&&!E.boss&&enc>0&&wave%5!==4){')],
];
for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); assert.ok(ok, name); }
console.log(checks.length + ' STARFALL radar/collision regression checks passed.');
