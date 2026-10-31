const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const html = fs.readFileSync(path.join(__dirname, '..', 'AI_LAB.html'));
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/AI_LAB.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/AI_LAB.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.__AI_LAB_READY === true, { timeout: 45000 });
    await page.waitForTimeout(1200);
    const beforeMove = await page.evaluate(() => window.__AI_LAB_DEBUG.player.position.z);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');
    const afterMove = await page.evaluate(() => window.__AI_LAB_DEBUG.player.position.z);
    if (afterMove <= beforeMove) throw new Error('W key did not move the player forward');
    await page.keyboard.down('Space');
    await page.waitForTimeout(220);
    await page.keyboard.up('Space');
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(120);
    const combat = await page.evaluate(() => ({
      projectiles: window.__AI_LAB_DEBUG.projectiles.length,
      ammo: document.querySelector('#ammo')?.textContent
    }));
    if (combat.projectiles < 2) throw new Error('Player laser/missile did not spawn projectiles: ' + JSON.stringify(combat));
    if (combat.ammo !== '5') throw new Error('Missile ammo did not decrement: ' + JSON.stringify(combat));
    const state = await page.evaluate(() => ({
      canvas: !!document.querySelector('#view canvas'),
      width: document.querySelector('#view canvas')?.width || 0,
      height: document.querySelector('#view canvas')?.height || 0,
      agents: window.__AI_LAB_DEBUG?.agents?.length || 0,
      renderCalls: window.__AI_LAB_DEBUG?.renderer?.info?.render?.calls || 0,
      fatal: document.querySelector('#fatal')?.textContent || ''
    }));
    if (!state.canvas || state.width < 100 || state.height < 100) throw new Error('WebGL canvas missing or has invalid dimensions: ' + JSON.stringify(state));
    if (state.agents !== 4) throw new Error('Expected four pirate agents: ' + JSON.stringify(state));
    if (!state.renderCalls) throw new Error('Three.js rendered no draw calls: ' + JSON.stringify(state));
    if (state.fatal) throw new Error('AI Lab fatal overlay: ' + state.fatal);
    if (pageErrors.length) throw new Error('Browser JavaScript errors: ' + pageErrors.join(' | '));
    console.log('PASS AI Lab browser combat test: movement, laser, missile, canvas ' + state.width + 'x' + state.height + ', agents=' + state.agents + ', drawCalls=' + state.renderCalls);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
