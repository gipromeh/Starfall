const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'AI_LAB.html'), 'utf8');
const checks = [
  ['Yuka ESM runtime', html.includes('yuka@0.7.8/build/yuka.module.js')],
  ['Yuka Vehicle steering', html.includes('new YUKA.Vehicle()') && html.includes('v.steering.add(seek)')],
  ['Obstacle avoidance', html.includes('new YUKA.ObstacleAvoidanceBehavior(')],
  ['Separation behavior', html.includes('new YUKA.SeparationBehavior(')],
  ['Target memory and loss state', html.includes('lastSeen') && html.includes("transition(a,'SEARCH')")],
  ['Tactical FSM', html.includes('ATTACK_RUN') && html.includes('REPOSITION') && html.includes('EVADE')],
  ['Fuzzy tactical scoring', html.includes('function fuzzy(')],
  ['Single and four-agent scenarios', html.includes('spawn(1)') && html.includes('spawn(4)')],
  ['Obstacle toggle and steering diagnostics', html.includes('id="obstacles"') && html.includes('id="debug"')],
  ['No production game import or mutation', !html.includes('STARFALL_CURRENT.html')],
  ['SeekBehavior receives a Vector3 target', html.includes('new YUKA.SeekBehavior(seekTarget.position)')],
  ['EntityManager integrates all vehicles once per frame', html.includes('entityManager.update(dt)') && !html.includes('v.update(dt)')],
  ['Separation neighborhood is limited to managed vehicles', html.includes('v.updateNeighborhood=true') && !html.includes('entityManager.add(seekTarget)') && !html.includes('entityManager.add(e)')],
  ['Planetary sphere visuals', html.includes('function planet(') && html.includes('new THREE.SphereGeometry(r,64,48)')],
  ['Detailed fighter silhouette', html.includes('function shipMesh(color)') && html.includes('new THREE.BoxGeometry(18,1.5,10)')],
  ['Fighters start with visible forward momentum', html.includes('v.velocity.set(0,0,v.maxSpeed*.72)')],
  ['Planets and stars animate every frame', html.includes('for(const body of celestialBodies)') && html.includes('starField.rotation.y+=dt')]
];;
let failed = 0;
for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failed++; }
console.log(checks.length - failed + '/' + checks.length + ' AI Lab static checks passed');
process.exitCode = failed ? 1 : 0;
