import {test,expect} from "@playwright/test";

async function bootGame(page){
  const consoleMessages=[],pageErrors=[],failedRequests=[];
  page.on("console",message=>consoleMessages.push(message.type()+": "+message.text()));
  page.on("pageerror",error=>pageErrors.push(error.stack||error.message));
  page.on("requestfailed",request=>failedRequests.push(request.url()+" :: "+request.failure()?.errorText));
  await page.goto("/Babylon/?test=1");
  await page.waitForTimeout(2500);
  const boot=await page.locator("#boot-message").textContent();
  const status=await page.locator("#status").textContent();
  const enabled=await page.locator("#start-button").isEnabled();
  if(!enabled){
    throw new Error("Babylon boot failed. status="+status+"; message="+boot+
      "\nPAGE ERRORS:\n"+pageErrors.join("\n")+
      "\nCONSOLE:\n"+consoleMessages.join("\n")+
      "\nFAILED REQUESTS:\n"+failedRequests.join("\n"));
  }
  await page.locator("#start-button").click();
  await expect(page.locator("#overlay")).toBeHidden();
  return {pageErrors,consoleMessages,failedRequests};
}

test("Chromium boots Babylon and renders a playable scene",async({page})=>{
  const diagnostics=await bootGame(page);
  await page.waitForTimeout(1000);
  const canvas=await page.locator("#renderCanvas").evaluate(node=>({
    width:node.width,height:node.height,
    context:!!(node.getContext("webgl2")||node.getContext("webgl"))
  }));
  expect(canvas.width).toBeGreaterThan(0);
  expect(canvas.height).toBeGreaterThan(0);
  expect(canvas.context).toBeTruthy();
  const state=await page.evaluate(()=>window.__STARFALL_TEST__.state());
  expect(state.playerForward[2]).toBeLessThan(-0.95);
  expect(state.pirateAsset).toContain("material batches");
  await page.screenshot({path:"test-results/starfall-chromium.png"});
  expect(diagnostics.pageErrors).toEqual([]);
});

test("flight controls accelerate the ship",async({page})=>{
  await bootGame(page);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(900);
  await page.keyboard.up("KeyW");
  const speed=await page.evaluate(()=>window.__STARFALL_TEST__.state().speed);
  expect(speed).toBeGreaterThan(5);
});

test("combat damages, destroys and respawns pirate target",async({page})=>{
  await bootGame(page);
  await page.evaluate(()=>window.__STARFALL_TEST__.damageTarget(35));
  expect(await page.evaluate(()=>window.__STARFALL_TEST__.state().enemyHealth)).toBe(65);
  await page.evaluate(()=>window.__STARFALL_TEST__.damageTarget(35));
  await page.evaluate(()=>window.__STARFALL_TEST__.damageTarget(35));
  const killed=await page.evaluate(()=>window.__STARFALL_TEST__.state());
  expect(killed.enemyDestroyed).toBeTruthy();
  expect(killed.kills).toBe(1);
  expect(killed.credits).toBe(250);
  await page.waitForTimeout(5600);
  const respawned=await page.evaluate(()=>window.__STARFALL_TEST__.state());
  expect(respawned.enemyDestroyed,JSON.stringify(respawned)).toBeFalsy();
  expect(respawned.enemyHealth).toBe(100);
});

test("mobile HUD and touch flight control are available",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/Babylon/");
  await expect(page.locator("#mobile-controls")).toBeVisible();
  await expect(page.locator("#touch-pad")).toBeVisible();
  await expect(page.locator('[data-action="fire"]')).toBeVisible();
  await expect(page.locator('[data-action="missile"]')).toBeVisible();
});

test("homing missile reaches target and applies weapon damage",async({page})=>{
  await bootGame(page);
  await page.evaluate(()=>window.__STARFALL_TEST__.fireMissile());
  await page.waitForFunction(()=>window.__STARFALL_TEST__.state().enemyHealth<100,undefined,{timeout:10000}).catch(async error=>{const state=await page.evaluate(()=>window.__STARFALL_TEST__.state());throw new Error(error.message+"\\nMissile diagnostics: "+JSON.stringify(state));});
  const state=await page.evaluate(()=>window.__STARFALL_TEST__.state());
  expect(state.enemyHealth).toBeLessThan(100);
  expect(state.projectileData.filter(p=>p.owner==="player"&&p.kind==="missile")).toHaveLength(0);
});

test("laser projectile hits pirate target through swept collision",async({page})=>{
  await bootGame(page);
  await page.evaluate(()=>window.__STARFALL_TEST__.fireLaser());
  await page.waitForFunction(()=>window.__STARFALL_TEST__.state().enemyHealth<100,undefined,{timeout:10000});
  const state=await page.evaluate(()=>window.__STARFALL_TEST__.state());
  expect(state.enemyHealth).toBeLessThan(100);
  expect(state.projectileData.filter(p=>p.owner==="player"&&p.kind==="laser")).toHaveLength(0);
});

test("enemy projectile damages player shield",async({page})=>{
  await bootGame(page);
  await page.evaluate(()=>window.__STARFALL_TEST__.fireEnemy());
  await page.waitForFunction(()=>window.__STARFALL_TEST__.state().shield<100,undefined,{timeout:5000});
  const state=await page.evaluate(()=>window.__STARFALL_TEST__.state());
  expect(state.shield).toBeLessThan(100);
  expect(state.hull).toBe(100);
});