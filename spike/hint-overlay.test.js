// Execute animation frames and race scenarios, rather than checking CSS class names.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function harness(reduced = false) {
  let now = 0, id = 0;
  const frames = new Map(), timers = new Map(), events = new Map(), calls = [];
  const overlay = {dataset:{},style:{values:{},setProperty(k,v){this.values[k]=v}}};
  const context = {
    document:{getElementById:()=>overlay}, performance:{now:()=>now},
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id},
    cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id},
    clearTimeout:key=>timers.delete(key),
    window:{matchMedia:()=>({matches:reduced}),__TAURI__:{
      core:{invoke:(command,args)=>{calls.push({command,args,level:level()});return Promise.resolve()}},
      event:{listen:(name,fn)=>events.set(name,fn)}
    }}
  };
  const level=()=>Number(overlay.style.values['--cue-level']);
  vm.runInNewContext(fs.readFileSync(__dirname+'/hint-overlay.js','utf8'),context);
  async function flush(){for(let i=0;i<6;i++)await Promise.resolve()}
  async function show(revision,extra={}) {
    events.get('tawel:visual-hint')({payload:{revision,style:'soft-focus',intensity:2,held:true,animation:{blur:4,fadeIn:2000,fadeOut:450},...extra}});
    await flush();
  }
  function advance(ms) {
    now+=ms;
    const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));
    for(const [key,timer] of [...timers])if(timer.at<=now){timers.delete(key);timer.fn()}
  }
  return {show,advance,level,overlay,calls,frames,timers,clear:revision=>events.get('tawel:hint-clear')({payload:revision})};
}
(async()=>{
  for(const style of ['soft-focus','wash-focus','lavender-vignette','desaturate','ambient-glow']) {
    // Withdrawal during entrance used to leave entrance/delayed blur running.
    const h=harness();await h.show(1,{style});
    h.advance(500);assert(h.level()>0&&h.level()<1);
    h.clear(2);let previous=h.level();
    let previousBlur=parseFloat(h.overlay.style.values['--cue-blur']);
    for(let i=0;i<10;i++){
      h.advance(50);assert(h.level()<=previous,'Release can only weaken');
      const blur=parseFloat(h.overlay.style.values['--cue-blur']);
      assert(blur<=previousBlur,'Delayed focus must not appear after withdrawal');
      previous=h.level();previousBlur=blur;
    }
    assert.equal(h.level(),0);assert.equal(h.overlay.dataset.phase,'idle');
    assert.equal(h.calls.at(-1).command,'complete_visual_hint');
    assert.equal(h.calls.at(-1).args.revision,2);
    assert.equal(h.calls.at(-1).level,0,'Hide only after filter reaches zero');
    h.advance(5000);assert.equal(h.level(),0,'No delayed reappearance');
  }
  const h=harness();await h.show(1);h.advance(2000);
  assert.equal(h.level(),1);h.advance(60000);assert.equal(h.level(),1,'Held cue has no expiry');
  assert.equal(h.frames.size,0,'No continuous rendering while held');
  h.clear(2);h.advance(100);await h.show(3);
  assert.equal(h.calls.at(-1).command,'ready_visual_hint');
  assert.equal(h.calls.at(-1).level,0,'Neutralize old content before showing native window');
  h.clear(2);h.advance(2000);assert.equal(h.level(),1,'Stale clear cannot dismiss new cue');
  await h.show(1);assert.equal(h.level(),1,'Stale show cannot replay');
  h.clear(4);h.clear(4);h.advance(450);assert.equal(h.level(),0);
  const p=harness();await p.show(1,{held:false,preview_hold_ms:3000});
  p.advance(2000);p.advance(2999);assert.equal(p.level(),1);
  p.advance(1);assert.equal(p.overlay.dataset.phase,'held'); // Paint changes on next frame.
  p.advance(225);assert(p.level()<1&&p.level()>0);
  p.advance(225);assert.equal(p.level(),0);
  const r=harness(true);await r.show(1,{style:'wash-focus'});r.advance(150);assert.equal(r.level(),1);
  r.clear(2);r.advance(150);assert.equal(r.level(),0,'Reduce Motion applies to both transitions');
  const stale=harness();stale.clear(4);await stale.show(3);assert.equal(stale.level(),0);
  const css=fs.readFileSync(__dirname+'/hint-overlay.css','utf8');
  assert(!css.includes('@keyframes'),'No independent animation can compete with release');
  assert(css.includes('blur(var(--cue-blur))'),'Blur itself returns to neutral');
  const native=fs.readFileSync(__dirname+'/../src-tauri/src/main.rs','utf8');
  assert(native.includes('fn complete_visual_hint(revision: u64'));
  assert(native.includes('fn ready_visual_hint(revision: u64'));
  assert(native.includes('== revision'),'Native completion is revision guarded');
  console.log('hint-overlay.test.js: monotonic release, hold, preview, stale events and neutral handoff passed');
})().catch(error=>{console.error(error);process.exitCode=1});
