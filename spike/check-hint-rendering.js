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
        window.hintEvents['tawel:visual-hint']({payload:{revision,style,intensity:2,held:true,animation:{blur:6,fadeIn:300,fadeOut:200}}});
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
      const last=result.samples.at(-1);
      if(style==='soft-focus'||style==='wash-focus')assert.equal(last.filter,'blur(0px)');
      else if(style==='desaturate')assert.equal(last.filter,'saturate(1)');
      else assert.equal(last.opacity,0);
    }
    console.log('Browser rendering: all five styles return to neutral without competing animations');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
