const L=require('./lib');
(async()=>{
 const browser=await L.launch(),ctx=await L.newCtx(browser,{viewport:{width:1280,height:800},dpr:1});
 try{
  const page=await L.openGame(ctx);
  const catalog=await page.evaluate(()=>{const c=SF_DS.catalog();return{signals:c.signals.length,chains:c.chains.length,npcTypes:c.npcTypes.length,button:!!document.querySelector('#ds-open')}});
  L.check('Deep Space: 15 signal types, five chains, ten NPC archetypes',catalog.signals>=15&&catalog.chains>=5&&catalog.npcTypes>=10,catalog);
  L.check('Deep Space: scanner entry point exists',catalog.button,catalog);
  const deterministic=await page.evaluate(()=>JSON.stringify(SF_DS.preview(123456))===JSON.stringify(SF_DS.preview(123456)));
  L.check('Deep Space: seeded sector generation is deterministic',deterministic);
  const sector=await page.evaluate(()=>{reset();state='play';SF_DS.enter(0);const s=SF_DS._active(),o=s.origin,ok=s.signals.every(x=>{const dx=x.pos[0]-o[0],dy=x.pos[1]-o[1],dz=x.pos[2]-o[2],d=Math.hypot(dx,dy,dz)||1;return d>=2800&&dz/d>-.5});return{signals:s.signals.length,npcs:s.npcs.length,outside:ok}});
  L.check('Deep Space: initial contacts exist outside the forward camera cone',sector.signals>=7&&sector.npcs>=6&&sector.outside,sector);
  const ai=await page.evaluate(()=>{const s=SF_DS._active(),n=s.npcs[0],p=n.pos.slice(),d=n.decisions,t=s.tick;for(let i=0;i<10;i++)SF_DS.update(.1);return{ticks:s.tick-t,decisions:n.decisions-d,moved:Math.hypot(n.pos[0]-p[0],n.pos[1]-p[1],n.pos[2]-p[2])}});
  L.check('Elite-derived scheduler: movement integrates each step; staggered AI decides once per four steps',ai.ticks===4&&ai.decisions===1&&ai.moved>0,ai);
  const chains=await page.evaluate(()=>{function run(choice){SF_DS.reset();SF_DS.enter(0);const s=SF_DS._active(),base=cr,id=SF_DS.debugSpawnChain('rescue',true);let x=s.signals.find(q=>q.id===id);x.falseChance=0;P.set(...x.pos);SF_DS.interact(id);let mid=s.signals.find(q=>q.chain==='rescue'&&q.stage===1&&q.state==='active');mid.falseChance=0;P.set(...mid.pos);SF_DS.interact(mid.id);SF_DS.choose('rescue',choice);let end=s.signals.find(q=>q.chain==='rescue'&&q.stage===2&&q.state==='active');end.falseChance=0;P.set(...end.pos);SF_DS.interact(end.id);return{status:s.chains.find(q=>q.id==='rescue').status,credits:cr-base}}const a=run('help'),b=run('salvage');return{help:a,salvage:b,distinct:a.credits!==b.credits}});
  L.check('Deep Space: three-stage chain has two distinct completed outcomes',chains.help.status==='done'&&chains.salvage.status==='done'&&chains.distinct,chains);
  const save=await page.evaluate(()=>{SF_DS.reset();SF_DS.enter(0);SF_DS.debugSpawnChain('science',true);const sv=window.__STARFALL_DIAG__.getSave();sv.save('deep-space-test');const i=sv.info(),r=JSON.parse(localStorage.getItem(i.slot));return{version:r.v,sector:!!(r.d.ds&&r.d.ds[0]),signals:r.d.ds[0].signals.length}});
  L.check('SAVE v3: deep-space state is serialized',save.version===3&&save.sector&&save.signals>=7,save);
  const ui=await page.evaluate(()=>{const b=document.querySelector('#ds-open'),r=b.getBoundingClientRect();b.click();return{width:r.width,height:r.height,right:innerWidth-r.right,top:r.top,open:document.querySelector('#ds-panel').style.display==='block'}});
  L.check('Deep Space: scanner opens from the upper-right control without covering the lower-left radar',ui.width>=44&&ui.height>=44&&ui.right>=0&&ui.top>=0&&ui.open,ui);
  L.check('Deep Space: no JavaScript errors',page.errors.length===0,page.errors);process.exitCode=L.summary();
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error('DEEP SPACE TEST CRASH',e);process.exit(2)});
