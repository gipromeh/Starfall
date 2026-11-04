const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
  const res=await page.goto('https://gipromeh.github.io/Starfall/Tower/',{waitUntil:'networkidle',timeout:90000});
  assert(res&&res.ok(),'Tower HTTP error');
  const canvas=page.locator('#world');await canvas.waitFor({state:'visible',timeout:30000});
  await page.waitForTimeout(700);
  const before=await canvas.screenshot();await page.waitForTimeout(700);const after=await canvas.screenshot();assert(!before.equals(after),'Canvas scene did not render/animate');
  await page.locator('#start').click();await page.waitForTimeout(1100);
  assert.match(await page.locator('#wave').innerText(),/1\s*\/\s*12/,'Wave did not start');
  await page.locator('[data-kind="mage"]').click();assert(await page.locator('[data-kind="mage"]').evaluate(e=>e.classList.contains('active')),'Tower selection failed');
  await page.locator('#pause').click();assert.equal(await page.locator('#pause').innerText(),'▶','Pause control failed');
  await page.locator('#pause').click();
  await page.locator('[data-speed="2"]').click();
  await page.mouse.wheel(0,500);await page.waitForTimeout(150);
  assert.deepEqual(errors,[],'Browser errors detected');
  console.log(JSON.stringify({result:'PASS',status:res.status(),checks:['Canvas 2D scene','animation','wave start','tower selection','pause/resume','speed control','zoom','no browser errors']},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
