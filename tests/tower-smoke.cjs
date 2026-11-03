const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[],assets=new Map(),worldAssets=new Map();let loaded=null,worldLoaded=null;
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{const t=m.text(),x=t.match(/rigged minions loaded:\s*(\d+)/i);if(x)loaded=+x[1];if(m.type()==='error')errors.push(t);const w=t.match(/world assets loaded:\s*(\d+)\s*trees; dragon:\s*(true|false); horse:\s*(true|false); bull:\s*(true|false); rider:\s*(true|false)/i);if(w)worldLoaded={trees:+w[1],dragon:w[2]==='true',horse:w[3]==='true',bull:w[4]==='true',rider:w[5]==='true'}});
 page.on('response',r=>{if(r.url().includes('/assets/orcs/'))assets.set(r.url().split('/').pop(),r.status());if(/\/assets\/(nature|creatures|raiders)\//.test(r.url()))worldAssets.set(r.url().split('/').pop(),r.status())});
 try{
  const res=await page.goto('https://gipromeh.github.io/Starfall/Tower/',{waitUntil:'networkidle',timeout:90000});
  assert(res&&res.ok(),'Tower HTTP error');const canvas=page.locator('#game canvas');await canvas.waitFor({state:'visible',timeout:60000});await page.waitForTimeout(16000);
  const names=['OrcIronGuard.glb','OrcLegionArcher.glb','OrcLegionCommander.glb','OrcLegionary.glb','OrcShieldBearer.glb','OrcWarDrummer.glb','OrcWarShaman.glb','OrcWarbandChampion.glb'];
  for(const n of names)assert.equal(assets.get(n),200,n+' HTTP failure');assert.equal(loaded,8,'Expected 8 parsed enemy models');
  const worldNames=['TreeHigh001.glb','TreeHigh002.glb','TreeHigh003.glb','TreeLow001.glb','TreeLow002.glb','TreeLow003.glb','TreeLow004.glb','TreeMed001.glb','TreeMed002.glb','TreeMed003.glb','Pterodactylus.glb','PalominoHorse.glb','Bull.glb','KnightCaptain.glb'];
  for(const n of worldNames)assert.equal(worldAssets.get(n),200,n+' HTTP failure');
  assert.deepEqual(worldLoaded,{trees:10,dragon:true,horse:true,bull:true,rider:true},'World model catalogue did not load');
  await page.locator('#start').click();await page.waitForTimeout(3200);const wave=await page.locator('#wave').innerText();assert.match(wave,/1\s*\/\s*12/);
  const a=await canvas.screenshot();await page.waitForTimeout(1200);const b=await canvas.screenshot();assert(!a.equals(b),'Scene did not animate');
  const c=await canvas.screenshot();await page.mouse.move(640,400);await page.mouse.down();await page.mouse.move(820,500,{steps:8});await page.mouse.up();const d=await canvas.screenshot();assert(!c.equals(d),'Camera drag did not change view');
  await page.mouse.wheel(0,900);await page.waitForTimeout(300);const e=await canvas.screenshot();assert(!d.equals(e),'Zoom did not change view');assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',status:res.status(),modelsLoaded:loaded,assets:Object.fromEntries(assets),wave,worldLoaded,worldModels:Object.fromEntries(worldAssets),checks:['WebGL','8 orc GLB parsed','10 tree GLBs parsed','dragon/horse/bull/rider GLBs parsed','wave start','animation','camera drag','zoom','no browser errors']},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
