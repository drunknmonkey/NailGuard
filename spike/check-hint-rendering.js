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
        await tick(); const floor = sample();
        const ramp=[];
        for(const level of [0.2,0.5,0.8,1]){ window.hintEvents['tawel:hint-level']({payload:{revision,level}}); await tick(); ramp.push(sample()); }
        window.hintEvents['tawel:hint-clear']({payload:revision+1});
        await tick(); const released = {...sample(), phase:root.dataset.phase, animations:root.getAnimations({subtree:true}).length};
        for(const level of [0.5,0]){ window.hintEvents['tawel:hint-level']({payload:{revision:revision+1,level}}); await tick(); }
        const exhaled = sample();
        window.hintEvents['tawel:hint-reset']({payload:revision+1});
        await tick();
        const veil = root.querySelector('.hint-focus-veil'); const veilOpacity = Number(getComputedStyle(veil).opacity);
        return {floor, ramp, released, exhaled, veilOpacity, veilDisplay:getComputedStyle(veil).display, reset:{...sample(), phase:root.dataset.phase}};
      }, {revision:index*3+1,style});
      assert.equal(result.floor.display,'block',`${style}: layer is on`);
      const backdrop = style==='soft-focus'||style==='wash-focus';
      if(style==='soft-focus'){assert.equal(result.veilDisplay,'block');assert.equal(result.veilOpacity,0,`${style}: veil follows the level and rests at 0 after reset`);}
      if(backdrop){
        assert.equal(result.floor.filter,'blur(1px)',`${style}: idle filter is the floor, never blur(0)`);
        for(const s of [result.floor,...result.ramp,result.released,result.exhaled])assert.equal(s.opacity,1,`${style}: backdrop layer opacity never moves`);
        const radii=result.ramp.map(s=>parseFloat(s.filter.replace('blur(','')));
        for(let i=1;i<radii.length;i++)assert(radii[i]>=radii[i-1],`${style}: radius grows with the level`);
        assert.equal(result.ramp.at(-1).filter,'blur(6px)',`${style}: full level reaches the configured blur`);
        assert.equal(result.exhaled.filter,'blur(1px)',`${style}: exhale ends at the floor`);
      } else if(style==='desaturate'){
        assert.equal(result.floor.filter,'saturate(1)');assert.match(result.ramp.at(-1).filter,/^saturate\(0\.56\)$/);
        for(const s of [result.floor,...result.ramp])assert.equal(s.opacity,1,`${style}: opacity never moves`);
      } else {
        assert.equal(result.floor.filter,'none');assert.equal(result.floor.opacity,0);assert.equal(result.ramp.at(-1).opacity,1,`${style}: plain wash uses opacity`);
      }
      assert.equal(result.released.phase,'releasing',`${style}: phase`);assert.equal(result.released.animations,0,`${style}: no CSS animation`);
      assert.equal(result.reset.phase,'idle');
    }
    console.log('Browser rendering: native level drives the filter radius with a 1 px floor; backdrop layers never change opacity; soft focus breathes through a separate veil');
  } finally { await browser.close(); }
})().catch(error=>{
  console.error(error);
  // GitHub Actions annotation: readable without the raw job log.
  console.log('::error title=check-hint-rendering::'+String(error && error.message || error).replace(/\r?\n/g,' ').slice(0,800));
  process.exitCode=1;
});
