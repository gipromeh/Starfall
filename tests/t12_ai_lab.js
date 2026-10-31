const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'AI_LAB.html'), 'utf8');
const checks = [
  ['Yuka ESM runtime', /yuka@0\.7\.8\/build\/yuka\.module\.js/.test(html)],
  ['Yuka Vehicle steering', /new YUKA\.Vehicle\(\)/.test(html) && /v\.steering\.add\(seek\)/.test(html)],
  ['Obstacle avoidance', /new YUKA\.ObstacleAvoidanceBehavior\(/.test(html)],
  ['Separation behavior', /new YUKA\.SeparationBehavior\(/.test(html)],
  ['Target memory and loss state', /lastSeen/.test(html) && /transition\(a,'SEARCH'\)/.test(html)],
  ['Tactical FSM', /ATTACK_RUN/.test(html) && /REPOSITION/.test(html) && /EVADE/.test(html)],
  ['Fuzzy tactical scoring', /function fuzzy\(/.test(html)],
  ['Single and four-agent scenarios', /spawn\(1\)/.test(html) && /spawn\(4\)/.test(html)],
  ['Obstacle toggle and steering diagnostics', /id="obstacles"/.test(html) && /id="debug"/.test(html)],
  ['No production game import or mutation', !/STARFALL_CURRENT\.html/.test(html)]
  ['SeekBehavior receives a Vector3 target', /new YUKA\\.SeekBehavior\\(seekTarget\\.position\\)/.test(html)],
  ['EntityManager integrates all vehicles once per frame', /entityManager\\.update\\(dt\\)/.test(html) && !/v\\.update\\(dt\\)/.test(html)],
  ['Separation neighborhood is limited to managed vehicles', /v\\.updateNeighborhood=true/.test(html) && !/entityManager\\.add\\(seekTarget\\)/.test(html) && !/entityManager\\.add\\(e\\)/.test(html)],
  ['Planetary sphere visuals', /function planet\\(/.test(html) && /new THREE\\.SphereGeometry\\(r,64,48\\)/.test(html)],
  ['Detailed fighter silhouette', /function shipMesh\\(color\\)/.test(html) && /new THREE\\.BoxGeometry\\(18,1\\.5,10\\)/.test(html)],
];
let failed = 0;
for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failed++; }
console.log(checks.length - failed + '/' + checks.length + ' AI Lab static checks passed');
process.exitCode = failed ? 1 : 0;
