const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'STARFALL_CURRENT.html'), 'utf8');
const checks = [
 ['laser projectiles explicitly tagged', html.includes('arr.push({m,v,dmg,life,kind:"laser"})')],
 ['ballistic projectiles explicitly tagged', html.includes('arr.push({m,v,dmg,life,kind:"projectile"})')],
 ['hostile homing missiles explicitly tagged', html.includes('q.hm=1;q.kind="hostile-missile"')],
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
 ['collision solver runs every frame', html.includes('pirateFleetUpdate(dt);resolvePirateShipCollisions();')]
];
for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); assert.ok(ok, name); }
console.log(checks.length + ' STARFALL radar/collision regression checks passed.');
