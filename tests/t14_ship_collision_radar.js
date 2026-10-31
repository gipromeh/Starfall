const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('STARFALL_CURRENT.html', 'utf8');

const checks = [
  ['v87 version marker', /starfall-version" content="v87"/.test(html)],
  ['Golovoroz baseline speed restored', /\*\[1,\.75,\.85,\.9\]\[e\.ty\]/.test(html)],
  ['Golovoroz turn coefficient restored', /tr=\[\.8,1\.1,\.65,\.75\]\[e\.ty\]/.test(html)],
  ['Golovoroz steering acceleration restored', /a=\(\[42,64,27,34\]\[e\.ty\]\|\|40\)/.test(html)],
  ['Jackal is slowest at 0.75 speed', /\*\[1,\.75,\.85,\.9\]\[e\.ty\]/.test(html)],
  ['Jackal initial speed reduced', /multiplyScalar\(\[18,10,12,16\]\[ty\]\|\|18\)/.test(html)],
  ['Ordinary projectiles are typed', /life,kind:"projectile"/.test(html)],
  ['Laser shots are typed separately', /life,kind:"laser"/.test(html)],
  ['Hostile missiles have explicit type', /q\.kind="hostile-missile"/.test(html)],
  ['Radar includes only explicit hostile missile contacts', /b\.kind==="hostile-missile"&&b\.m&&b\.life>0/.test(html)],
  ['Radar does not classify all hm objects', !/if\(b\.hm&&b\.m&&b\.life>0\)put\(b\.m\.position,"missile"/.test(html)],
  ['Collision solver exists', /function resolveShipCollisions\(\)/.test(html)],
  ['Player participates in collision solver', /add\(P,vel,8,1\.35\)/.test(html)],
  ['E/E2 participate in collision solver', /for\(const e of \[E,E2\]\).*add\(e\.g\.position,e\.vel/.test(html)],
  ['Pirate fleet participates in collision solver', /for\(const e of pirateFleet\).*add\(e\.g\.position,e\.vel/.test(html)],
  ['Collision correction prevents persistent overlap', /penetration=minDist-dist/.test(html) && /a\.position\.addScaledVector/.test(html) && /b\.position\.addScaledVector/.test(html)],
  ['Collision response changes closing velocities', /relativeNormal<0/.test(html) && /a\.velocity\.addScaledVector/.test(html) && /b\.velocity\.addScaledVector/.test(html)],
  ['Collision solver runs after both AI updates', /upd=function\(dt\)\{_updWithPirateFleet\(dt\);pirateFleetUpdate\(dt\);pirateEnemyFxUpdate\(dt\);for\(const pe of pirateFleet\)if\(pe\.g&&pe\.hp>0\)pirateDamageFxUpdate\(pe,dt\);resolveShipCollisions\(\)\}/.test(html)]
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log('STARFALL v87 regression checks: ' + checks.length + ' passed');
