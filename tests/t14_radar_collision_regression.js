const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'starfall.html'), 'utf8');
const checks = [
 ['HTML build version metadata is present and valid', /<meta name="starfall-version" content="v\d+(?:\.\d+)?">/.test(html)],
 ['laser projectiles explicitly tagged', html.includes('arr.push({m,v,dmg,life,kind:"laser"})')],
 ['ballistic projectiles explicitly tagged', html.includes('arr.push({m,v,dmg,life,kind:"projectile"})')],
 ['hostile homing missiles explicitly tagged', html.includes('q.hm=1;q.kind="hostile-missile"')],
 ['radar uses 3D elliptical projection', html.includes('function radarProjectContact(x,y,z,range,rx=74,ry=49)')],
 ['radar keeps Elite amber scanner palette', html.includes('#ffc07877')&&html.includes('#ffad6388')],
 ['radar encodes altitude with up/down chevrons', html.includes('Up/down chevrons encode altitude')],
 ['radar clips contacts to an elliptical scanner surface', html.includes('rc.ellipse(c,c,78,53,0,0,Math.PI*2);rc.clip()')],
 ['old rotating sweep is removed', !html.includes('radarSweepAngle')],
 ['old vertical altitude stalk is removed', !html.includes('verticalOffset')&&!html.includes('markerY=py')],
 ['radar filters eb by hostile missile type', html.includes('b.kind==="hostile-missile"&&b.hm===1')],
 ['Jackal has the slowest E/E2 speed multiplier', html.includes('*[1,.75,.85,.9][e.ty]')],
 ['Jackal has the slowest E/E2 initial speed', html.includes('multiplyScalar([18,10,12,16][ty]||18)')],
 ['Golovoroz original turn coefficient restored', html.includes('tr=[.8,1.1,.65,.75][e.ty]')],
 ['Jackal has reduced pirate-fleet spawn speed', html.includes('multiplyScalar([46,34.5,46,46][e.ty]||46)')],
 ['Jackal uses its current flanking cruise-speed profile', html.includes('targetSpeed=dist>330?61:48;turnRate=2.5;')],
 ['player collision includes pirate fleet', html.includes('fleet:true')&&html.includes('if(h.fleet)pirateFleetDamage')],
 ['NPC collision solver exists', html.includes('function resolvePirateShipCollisions()')],
 ['NPC collision solver separates overlapping ships', html.includes('penetration=minimum-distance+.05')],
 ['NPC collision solver includes neutral transports', html.includes('n.g&&!n.tur&&n.g.visible!==false&&n.v')],
 ['collision solver runs every frame', html.includes('pirateFleetUpdate(dt);resolvePirateShipCollisions();')],
 ['pirate fleet initializes two seeded attackers', html.includes('for(let slot=0;slot<2;slot++){const e={slot,ty:pirateFleetNextType,g:null,hp:0,mx:0,respawn:Infinity,dead:false,flames:[]};pirateFleet.push(e);pirateFleetSpawn(e,slot*.22)}')],
 ['pirate fleet spawns ahead of the player', html.includes('addScaledVector(fw,(1100+e.slot*90))')],
 ['pirate fleet does not respawn after destruction', html.includes('e.respawn=Infinity;e.hits=0;')],
 ['pirate fleet uses per-archetype firing envelopes', html.includes('const fireRange=[390,330,520,430][e.ty],fireCone=[.82,.72,.62,.95][e.ty];')&&html.includes('const canFire=e.state==="ATTACK"&&dist<fireRange&&(fireAngle<fireCone||(dist<260&&fireAngle<1.3));')],
 ['regular pirates use 380/420-unit firing ranges', html.includes('d<(e.ty===3?420:380)')],
 ['wave attacks wait until the opening fleet is cleared', html.includes('if(!E&&!pirateFleet.some(pe=>pe.g&&pe.hp>0&&!pe.dead)){if(enc>0){spawnT-=dt;')],
 ['additional E/E2 wave spawns also wait until the opening fleet is cleared', html.includes('if(!pirateFleet.some(pe=>pe.g&&pe.hp>0&&!pe.dead)&&E&&!E2&&!E.boss&&enc>0&&wave%5!==4){')],

 ['radar uses an elliptical dish boundary', html.includes('rc.ellipse(c,c,82,57,0,0,Math.PI*2)')],
 ['radar projects all three local axes', html.includes('const nx=x/range,ny=y/range,nz=z/range;')&&html.includes('sy=(-nz*.34-ny*.66)*ry')],
 ['radar range uses 3D distance', html.includes('outside:Math.hypot(nx,ny,nz)>1')],
 ['radar keeps live game contact collection', html.includes('function collectRadarContacts()')&&html.includes('window.SF_DS.radar(put)')],
 ['radar keeps 500/1000/2000 range controls', html.includes('function setRadarRange(value)')&&html.includes('Math.max(500,Math.min(2000')],
 ['radar has no rotating sweep beam', !html.includes('radarSweepAngle')],
];
for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); assert.ok(ok, name); }
console.log(checks.length + ' STARFALL radar/collision regression checks passed.');
