let playwright; try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium, webkit } = playwright;
const fs = require('fs'), path = require('path');
const NM = process.env.SF_NM || path.join(__dirname, 'node_modules');
const GAME = path.join(__dirname, '..', 'STARFALL_CURRENT.html');
const ORIGIN = 'http://game.local';
const MAP = [
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js/, NM + '/three/build/three.min.js'],
  [/three@0\.128\.0\/examples\/js\/(.*)$/, m => NM + '/three/examples/js/' + m[1]],
  [/tsparticles@2\.12\.0\/tsparticles\.bundle\.min\.js/, NM + '/tsparticles/tsparticles.bundle.min.js'],
];
async function launch(opts = {}) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  return browser;
}
async function launchWebKit() {
  return webkit.launch({ headless: true });
}
async function newCtx(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 800, height: 450 }, deviceScaleFactor: o.dpr || 1, hasTouch: !!o.touch, isMobile: !!o.touch, userAgent: o.ua });
  await ctx.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) {
      const u = new URL(url);
      if (u.pathname === '/' || u.pathname.endsWith('STARFALL_CURRENT.html')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(o.game || GAME, 'utf8') });
      if (u.pathname.startsWith('/assets/')) { const f = path.join(__dirname, '..', decodeURIComponent(u.pathname)); if (f.startsWith(path.join(__dirname, '..', 'assets')) && fs.existsSync(f)) return route.fulfill({ status: 200, contentType: f.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream', body: fs.readFileSync(f, 'utf8') }); }
      return route.fulfill({ status: 404, body: '' });
    }
    // WebKit can leave DOMContentLoaded pending when a stylesheet is aborted by Web Inspector.
    // Fulfil the optional Google Fonts stylesheet with empty CSS; gameplay uses local fallbacks.
    if (/^https:\/\/fonts\\.googleapis\\.com\//.test(url)) return route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
    for (const [re, target] of MAP) {
      const m = url.match(re);
      if (m) { const f = typeof target === 'function' ? target(m) : target; if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); }
    }
    return route.abort();   // babylon, fonts: unavailable -> game falls back (SDF hall)
  });
  return ctx;
}
async function openGame(ctx, o = {}) {
  const page = await ctx.newPage();
  page.errors = []; page.logs = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|net::ERR|ERR_FAILED/.test(t)) page.errors.push('console.error: ' + t.slice(0, 300)); else page.logs.push(m.type() + ': ' + t.slice(0, 200)); });
  page.on('dialog', d => { page.lastDialog = d.message(); (page.dialogHandler || (x => x.accept()))(d); });
  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => { try { return typeof SV !== 'undefined' && typeof state !== 'undefined'; } catch (e) { return false; } }, null, { timeout: 120000 });
  return page;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const lines = [];
function check(name, cond, extra) { if (cond) { pass++; lines.push('  PASS ' + name); } else { fail++; lines.push('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); } console.log(lines[lines.length - 1]); }
function summary() { console.log(`\n${pass} passed, ${fail} failed`); return fail; }
module.exports = { launch, launchWebKit, newCtx, openGame, sleep, check, summary, ORIGIN };
