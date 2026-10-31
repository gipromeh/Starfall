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
];
let failed = 0;
for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failed++; }
console.log(checks.length - failed + '/' + checks.length + ' AI Lab static checks passed');
process.exitCode = failed ? 1 : 0;
