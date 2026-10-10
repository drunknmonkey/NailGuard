// Real browser style checks complement the deterministic animation-clock tests.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {chromium} = require(process.argv[2]);
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent(fs.readFileSync(path.join(__dirname,'hint-overlay.html'),'utf8'));
    await page.addStyleTag({path:path.join(__dirname,'hint-overlay.css')});
    await page.evaluate(() => {
      window.hintEvents = {}; window.hintCalls = [];
      window.__TAURI__ = {event:{listen:(name,fn)=>{window.hintEvents[name]=fn}},core:{invoke:async(command,args)=>{window.hintCalls.push({command,args})}}};
    });
    await page.addScriptTag({path:path.join(__dirname,'hint-overlay.js')});
    for (const [index, style] of ['soft-focus','wash-focus','desaturate','ambient-glow','lavender-vignette'].entries()) {
      const result = await page.evaluate(async ({revision,style}) => {
        const root = document.getElementById('hintOverlay');
        const selectors = {'soft-focus':'.hint-focus','wash-focus':'.hint-combo-focus',desaturate:'.hint-desaturate','ambient-glow':'.hint-ambient','lavender-vignette':'.hint-vignette'};
        const layer = root.querySelector(selectors[style]);
        const tick = () => new Promise(requestAnimationFrame);
        const sample = () => { const css=getComputedStyle(layer); return {filter:css.backdropFilter, opacity:Number(css.opacity), level:Number(root.style.getPropertyValue('--cue-level'))}; };
        // Let the frame clock settle first: a cold runner may deliver its first frame late.
        await tick(); await tick();
        window.hintEvents['tawel:visual-hint']({payload:{revision,style,intensity:2,held:true,animation:{blur:6,fadeIn:600,fadeOut:200}}});
        const entrance=[sample()]; const start = performance.now();
        while(root.dataset.phase!=='held') { await tick(); entrance.push(sample()); if(performance.now()-start>5000) throw Error('Entrance did not finish'); }
        const held = sample();
        window.hintEvents['tawel:hint-clear']({payload:revision+1});
        const since = performance.now(); while(performance.now()-since < 300) await tick();
        const released = {...sample(), phase:root.dataset.phase, animations:root.getAnimations({subtree:true}).length};
        window.hintEvents['tawel:hint-reset']({payload:revision+1});
        await tick();
        return {entrance, held, released, reset:{...sample(), phase:root.dataset.phase}};
      }, {revision:index*3+1,style});
      assert(result.entrance.length>=2,`${style}: ${result.entrance.length} entrance samples`);
      for(let i=1;i<result.entrance.length;i++)assert(result.entrance[i].level>=result.entrance[i-1].level,`${style}: entrance only strengthens`);
      assert.equal(result.entrance.at(-1).level,1,`${style}: entrance ends at full strength`);
      for(const s of result.entrance)assert.equal(s.filter,result.held.filter,`${style}: backdrop filter never changes while the cue is on screen`);
      if(style==='soft-focus'||style==='wash-focus')assert.equal(result.held.filter,'blur(6px)');
      else if(style==='desaturate')assert.match(result.held.filter,/^saturate\(0\.56\)$/);
      else assert.equal(result.held.filter,'none');
      assert.equal(result.held.opacity,1,`${style}: held at full opacity`);
      assert.equal(result.released.opacity,1,`${style}: release leaves the layer untouched; the window fades natively`);
      assert.equal(result.released.filter,result.held.filter,`${style}: filter unchanged on release`);assert.equal(result.released.phase,'releasing',`${style}: phase`);assert.equal(result.released.animations,0,`${style}: no competing CSS animation`);
      assert.equal(result.reset.opacity,0,`${style}: reset after the off-screen hide neutralizes the layer`);assert.equal(result.reset.phase,'idle',`${style}: idle after reset`);
    }
    console.log('Browser rendering: five styles fade in by opacity on a fixed backdrop filter; release leaves the layer untouched');
  } finally { await browser.close(); }
})().catch(error=>{
  console.error(error);
  // GitHub Actions annotation: readable without the raw job log.
  console.log('::error title=check-hint-rendering::'+String(error && error.message || error).replace(/\r?\n/g,' ').slice(0,800));
  process.exitCode=1;
});
