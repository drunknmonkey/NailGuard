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
        window.hintEvents['tawel:visual-hint']({payload:{revision,style,intensity:2,held:true,finish:'opacity',animation:{blur:6,fadeIn:300,fadeOut:200}}});
        const start = performance.now();
        while(performance.now()-start < (style === 'wash-focus' ? 400 : 120)) await tick();
        window.hintEvents['tawel:hint-clear']({payload:revision+1});
        const samples=[];
        while(root.dataset.phase!=='idle') {
          await tick();
          const css=getComputedStyle(layer);
          samples.push({filter:css.backdropFilter,opacity:Number(css.opacity),level:Number(root.style.getPropertyValue('--cue-level'))});
          if(samples.length>240)throw Error('Release did not finish');
        }
        return {samples,animations:root.getAnimations({subtree:true}).length};
      }, {revision:index*3+1,style});
      assert(result.samples.length>1);
      for(let i=1;i<result.samples.length;i++)assert(result.samples[i].level<=result.samples[i-1].level);
      assert.equal(result.animations,0,'No competing CSS animation');
      const first=result.samples[0], last=result.samples.at(-1);
      for(const sample of result.samples)assert.equal(sample.filter,first.filter,'Backdrop filter never changes while the cue is on screen');
      if(style==='soft-focus'||style==='wash-focus')assert.equal(first.filter,'blur(6px)');
      else if(style==='desaturate')assert.match(first.filter,/^saturate\(0\.56\)$/);
      else assert.equal(first.filter,'none');
      assert.equal(last.opacity,0,'Release ends at opacity zero');
      assert(first.opacity>0,'Release starts from a visible layer');
    }
    // Product path: on a native release the renderer must not touch the layer at all.
    const native = await page.evaluate(async () => {
      const root = document.getElementById('hintOverlay'), layer = root.querySelector('.hint-focus');
      const tick = () => new Promise(requestAnimationFrame);
      window.hintEvents['tawel:visual-hint']({payload:{revision:100,style:'soft-focus',intensity:2,held:true,finish:'native',animation:{blur:6,fadeIn:150,fadeOut:200}}});
      const start = performance.now(); while(performance.now()-start < 400) await tick();
      const before = {filter:getComputedStyle(layer).backdropFilter, opacity:getComputedStyle(layer).opacity};
      window.hintEvents['tawel:hint-clear']({payload:{revision:101,finish:'native'}});
      const since = performance.now(); while(performance.now()-since < 300) await tick();
      const after = {filter:getComputedStyle(layer).backdropFilter, opacity:getComputedStyle(layer).opacity, phase:root.dataset.phase, animations:root.getAnimations({subtree:true}).length};
      window.hintEvents['tawel:hint-reset']({payload:101});
      await tick();
      return {before, after, reset:{opacity:getComputedStyle(layer).opacity, phase:root.dataset.phase}};
    });
    assert.equal(native.before.opacity,'1');
    assert.deepEqual({filter:native.after.filter,opacity:native.after.opacity},native.before,'Native release leaves filter and opacity untouched');
    assert.equal(native.after.phase,'releasing');assert.equal(native.after.animations,0);
    assert.equal(native.reset.opacity,'0');assert.equal(native.reset.phase,'idle');
    console.log('Browser rendering: all five styles fade by opacity only with a fixed backdrop filter; native release leaves the layer untouched');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
