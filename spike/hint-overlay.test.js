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
  const named=command=>calls.filter(c=>c.command===command);
  return {show,advance,level,overlay,calls,named,frames,timers,clear:revision=>events.get('tawel:hint-clear')({payload:revision}),reset:revision=>events.get('tawel:hint-reset')({payload:revision})};
}
(async()=>{
  for(const style of ['soft-focus','wash-focus','lavender-vignette','desaturate','ambient-glow']) {
    // Release never animates the layer: it stops the entrance and hands over to the window.
    const h=harness();await h.show(1,{style});
    h.advance(500);const partial=h.level();assert(partial>0&&partial<1);
    const fixedBlur=h.overlay.style.values['--cue-blur-max'];
    assert.equal(fixedBlur,'4px','Filter strength is set once per cue');
    h.clear(2);
    assert.equal(h.calls.at(-1).command,'complete_visual_hint','Release acknowledges at once');
    assert.equal(h.calls.at(-1).args.revision,2);assert.equal(h.calls.at(-1).args.reducedMotion,false);
    assert.equal(h.calls.at(-1).level,partial,'Layer stays where the entrance was stopped');
    assert.equal(h.overlay.dataset.phase,'releasing');
    h.advance(5000);assert.equal(h.level(),partial,'No renderer animation while the window fades');
    assert.equal(h.overlay.style.values['--cue-blur-max'],fixedBlur,'Filter structure never changes');
    assert.equal(h.frames.size,0);assert.equal(h.timers.size,0,'Nothing scheduled while the window fades');
    assert(!('--cue-blur' in h.overlay.style.values),'No per-frame filter radius');
    h.reset(2);assert.equal(h.level(),0,'Reset after the off-screen hide neutralizes the layer');assert.equal(h.overlay.dataset.phase,'idle');
    const stages=h.named('trace_visual_hint').map(c=>c.args.stage);
    assert.deepEqual(stages,['shown','release'],'Renderer reports first frame and release for the native log');
  }
  const h=harness();await h.show(1);h.advance(2000);
  assert.equal(h.level(),1);h.advance(60000);assert.equal(h.level(),1,'Held cue has no expiry');
  assert.equal(h.frames.size,0,'No continuous rendering while held');assert.equal(h.timers.size,0);
  h.clear(2);await h.show(3);
  assert.equal(h.calls.at(-1).command,'ready_visual_hint');
  assert.equal(h.calls.at(-1).level,0,'Neutralize old content before showing native window');
  h.advance(2000);assert.equal(h.level(),1);
  h.clear(2);h.reset(2);assert.equal(h.level(),1,'Stale clear and reset cannot touch the new cue');
  await h.show(1);assert.equal(h.level(),1,'Stale show cannot replay');
  h.clear(4);h.clear(4);assert.equal(h.named('complete_visual_hint').length,2,'Duplicate clear acknowledges once');
  h.reset(4);assert.equal(h.level(),0);
  // Preview: holds, then releases itself through the same native path.
  const p=harness();await p.show(1,{held:false,preview_hold_ms:3000});
  p.advance(2000);p.advance(2999);assert.equal(p.level(),1);assert.equal(p.named('complete_visual_hint').length,0);
  p.advance(1);assert.equal(p.named('complete_visual_hint').length,1);assert.equal(p.calls.at(-1).args.revision,1);
  assert.equal(p.level(),1,'Preview release leaves the layer at full opacity for the window fade');
  p.reset(1);assert.equal(p.level(),0);
  // Reduce Motion: short entrance, flag handed to the native fade.
  const r=harness(true);await r.show(1,{style:'wash-focus'});r.advance(150);assert.equal(r.level(),1);
  r.clear(2);assert.equal(r.calls.at(-1).args.revision,2);assert.equal(r.calls.at(-1).args.reducedMotion,true,'Reduce Motion flag reaches the native fade');
  const stale=harness();stale.clear(4);await stale.show(3);assert.equal(stale.level(),0);
  // Clock keeps running on a timer when rAF stalls, and reports each stall.
  const s=harness();await s.show(1);s.frames.clear();
  s.advance(60);assert(s.level()>0,'Timer fallback advanced the entrance without rAF');
  assert(s.named('trace_visual_hint').some(c=>c.args.stage==='stall'),'Stall is reported to the native log');
  for(let i=0;i<40;i++){s.frames.clear();s.advance(60);}assert.equal(s.level(),1,'Entrance completes on the timer alone');
  assert.equal(s.named('trace_visual_hint').filter(c=>c.args.stage==='held').length,1);
  const t=harness();await t.show(1);for(let i=0;i<50;i++)t.advance(50);assert.equal(t.level(),1);
  assert(!t.named('trace_visual_hint').some(c=>c.args.stage==='stall'),'Healthy rAF never reports a stall');
  const css=fs.readFileSync(__dirname+'/hint-overlay.css','utf8');
  assert(!css.includes('@keyframes')&&!css.includes('transition'),'No independent animation can compete with the entrance');
  assert(css.includes('blur(var(--cue-blur-max))')&&!css.includes('--cue-blur)'),'Blur radius is fixed per cue; only opacity moves');
  assert(css.includes('saturate(var(--cue-saturation-min))'),'Saturation is fixed per cue');
  const native=fs.readFileSync(__dirname+'/../src-tauri/src/main.rs','utf8');
  assert(native.includes('fn complete_visual_hint(revision: u64, reduced_motion: Option<bool>'));
  assert(native.includes('fn ready_visual_hint(revision: u64'));
  assert(native.includes('fn trace_visual_hint(revision: u64'));
  assert(native.includes('== revision'),'Native completion is revision guarded');
  assert(native.includes('.focusable(false)'),'Hint window can never become key window');
  assert(native.includes('BackgroundThrottlingPolicy::Disabled'),'Overlay clock is never throttled by WebKit');
  assert(native.includes('animate_overlay_alpha(&overlay, ALPHA_FLOOR, fade)'),'Window server fades the window, never to zero');
  assert(native.includes('animate_overlay_alpha(&overlay, 1.0, 0)'),'Alpha returns to 1 before the window is shown');
  assert(native.includes('fn park_hint_overlay')&&native.includes('park_hint_overlay(app, &overlay);\n        let _ = overlay.hide();'),'Window leaves the screen before it is hidden');
  assert(native.includes('"tawel:hint-reset"'),'Renderer is neutralized after the off-screen hide');
  console.log('hint-overlay.test.js: entrance clock, native hand-off, hold, preview, stale events and reset passed');
})().catch(error=>{console.error(error);process.exitCode=1});
