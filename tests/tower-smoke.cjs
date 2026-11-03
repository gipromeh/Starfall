const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[],assets=new Map();let loaded=null;
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{const t=m.text(),x=t.match(/rigged minions loaded:\s*(\d+)/i);if(x)loaded=+x[1];if(m.type()==='error')errors.push(t)});
 page.on('response',r=>{if(r.url().includes('/assets/orcs/'))assets.set(r.url().split('/').pop(),r.status())});
 try{
  const res=await page.goto('https://gipromeh.github.io/Starfall/Tower/',{waitUntil:'networkidle',timeout:90000});
  assert(res&&res.ok(),'Tower HTTP error');const canvas=page.locator('#game canvas');await canvas.waitFor({state:'visible',timeout:60000});await page.waitForTimeout(12000);
  const names=['OrcIronGuard.glb','OrcLegionArcher.glb','OrcLegionCommander.glb','OrcLegionary.glb','OrcShieldBearer.glb','OrcWarDrummer.glb','OrcWarShaman.glb','OrcWarbandChampion.glb'];
  for(const n of names)assert.equal(assets.get(n),200,n+' HTTP failure');assert.equal(loaded,8,'Expected 8 parsed enemy models');
  await page.locator('#start').click();await page.waitForTimeout(3200);const wave=await page.locator('#wave').innerText();assert.match(wave,/1\s*\/\s*12/);
  const a=await canvas.screenshot();await page.waitForTimeout(1200);const b=await canvas.screenshot();assert(!a.equals(b),'Scene did not animate');
  const c=await canvas.screenshot();await page.mouse.move(640,400);await page.mouse.down();await page.mouse.move(820,500,{steps:8});await page.mouse.up();const d=await canvas.screenshot();assert(!c.equals(d),'Camera drag did not change view');
  await page.mouse.wheel(0,900);await page.waitForTimeout(300);const e=await canvas.screenshot();assert(!d.equals(e),'Zoom did not change view');assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',status:res.status(),modelsLoaded:loaded,assets:Object.fromEntries(assets),wave,checks:['WebGL','8 GLB parsed','wave start','animation','camera drag','zoom','no browser errors']},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
