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
        const sample = () => { const css=getComputedStyle(layer); return {filter:css.backdropFilter, opacity:Number(css.opacity), display:css.display}; };
        window.hintEvents['tawel:visual-hint']({payload:{revision,style,intensity:2,held:true,animation:{blur:6,fadeIn:300,fadeOut:200}}});
        const immediate = sample();
        const samples=[]; const start = performance.now();
        while(performance.now()-start < 400) { await tick(); samples.push(sample()); }
        window.hintEvents['tawel:hint-clear']({payload:revision+1});
        const since = performance.now(); while(performance.now()-since < 300) { await tick(); samples.push(sample()); }
        const released = {phase:root.dataset.phase, animations:root.getAnimations({subtree:true}).length};
        window.hintEvents['tawel:hint-reset']({payload:revision+1});
        await tick();
        return {immediate, samples, released, reset:{...sample(), phase:root.dataset.phase}};
      }, {revision:index*3+1,style});
      assert.equal(result.immediate.display,'block',`${style}: layer is on`);
      assert.equal(result.immediate.opacity,1,`${style}: full opacity before the window is shown`);
      for(const s of result.samples){assert.equal(s.opacity,1,`${style}: opacity never moves`);assert.equal(s.filter,result.immediate.filter,`${style}: backdrop filter never changes`);}
      if(style==='soft-focus'||style==='wash-focus')assert.equal(result.immediate.filter,'blur(6px)');
      else if(style==='desaturate')assert.match(result.immediate.filter,/^saturate\(0\.56\)$/);
      else assert.equal(result.immediate.filter,'none');
      assert.equal(result.released.phase,'releasing',`${style}: phase`);assert.equal(result.released.animations,0,`${style}: no CSS animation`);
      assert.equal(result.reset.opacity,0,`${style}: reset after the hide neutralizes the layer`);assert.equal(result.reset.phase,'idle');
    }
    console.log('Browser rendering: five styles are static at full opacity with a fixed backdrop filter; the window does the breathing');
  } finally { await browser.close(); }
})().catch(error=>{
  console.error(error);
  // GitHub Actions annotation: readable without the raw job log.
  console.log('::error title=check-hint-rendering::'+String(error && error.message || error).replace(/\r?\n/g,' ').slice(0,800));
  process.exitCode=1;
});
