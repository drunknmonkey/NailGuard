// Execute the renderer contract with a deterministic clock, rather than checking CSS class names.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function harness(reduced = false) {
  let now = 0, id = 0;
  const timers = new Map(), events = new Map(), calls = [];
  const overlay = {dataset:{},style:{values:{},setProperty(k,v){this.values[k]=v}}};
  const context = {
    document:{getElementById:()=>overlay}, performance:{now:()=>now},
    requestAnimationFrame:()=>{throw Error('Renderer must not animate')},
    cancelAnimationFrame:()=>{},
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
    for(const [key,timer] of [...timers])if(timer.at<=now){timers.delete(key);timer.fn()}
  }
  const named=command=>calls.filter(c=>c.command===command);
  return {show,advance,level,overlay,calls,named,timers,clear:revision=>events.get('tawel:hint-clear')({payload:revision}),reset:revision=>events.get('tawel:hint-reset')({payload:revision})};
}
(async()=>{
  for(const style of ['soft-focus','wash-focus','lavender-vignette','desaturate','ambient-glow']) {
    const h=harness();
    assert.equal(h.level(),0,'Neutral before the first cue');
    await h.show(1,{style});
    const ready=h.named('ready_visual_hint').at(-1);
    assert.equal(ready.level,1,'Layer is at full opacity before the window is shown');
    assert.equal(ready.args.revision,1);assert.equal(ready.args.reducedMotion,false);
    assert.equal(h.overlay.style.values['--cue-blur-max'],'4px','Filter strength is set once per cue');
    assert.equal(h.overlay.dataset.style,style);assert.equal(h.overlay.dataset.phase,'held');
    assert.equal(h.timers.size,0,'Held cue schedules nothing');
    h.advance(60000);assert.equal(h.level(),1,'Held cue has no expiry and never moves');
    h.clear(2);
    assert.equal(h.calls.at(-1).command,'complete_visual_hint','Release acknowledges at once');
    assert.equal(h.calls.at(-1).args.revision,2);assert.equal(h.calls.at(-1).args.reducedMotion,false);
    assert.equal(h.calls.at(-1).level,1,'Layer untouched while the window breathes out');
    assert.equal(h.overlay.dataset.phase,'releasing');
    h.advance(5000);assert.equal(h.level(),1);assert.equal(h.overlay.style.values['--cue-blur-max'],'4px','Filter structure never changes');
    assert(!('--cue-blur' in h.overlay.style.values),'No per-frame filter radius');
    h.reset(2);assert.equal(h.level(),0,'Reset after the hide neutralizes the layer');assert.equal(h.overlay.dataset.phase,'idle');
    assert.deepEqual(h.named('trace_visual_hint').map(c=>c.args.stage),['held','release']);
  }
  const h=harness();await h.show(1);h.clear(2);await h.show(3);
  assert.equal(h.named('ready_visual_hint').at(-1).args.revision,3);assert.equal(h.named('ready_visual_hint').at(-1).level,1);
  h.clear(2);h.reset(2);assert.equal(h.level(),1,'Stale clear and reset cannot touch the new cue');
  await h.show(1);assert.equal(h.named('ready_visual_hint').length,2,'Stale show cannot replay');
  h.clear(4);h.clear(4);assert.equal(h.named('complete_visual_hint').length,2,'Duplicate clear acknowledges once');
  h.reset(4);assert.equal(h.level(),0);
  // Preview: fade-in plus hold, then release through the same native path.
  const p=harness();await p.show(1,{held:false,preview_hold_ms:3000});
  p.advance(4999);assert.equal(p.named('complete_visual_hint').length,0,'Hold starts after the native fade-in');
  p.advance(1);assert.equal(p.named('complete_visual_hint').length,1);assert.equal(p.calls.at(-1).args.revision,1);
  assert.equal(p.level(),1,'Preview release leaves the layer at full opacity for the window fade');
  p.reset(1);assert.equal(p.level(),0);
  // Reduce Motion: flag handed to both native fades, shorter hold offset.
  const r=harness(true);await r.show(1,{style:'wash-focus',held:false,preview_hold_ms:1200});
  assert.equal(r.named('ready_visual_hint').at(-1).args.reducedMotion,true);
  r.advance(1349);assert.equal(r.named('complete_visual_hint').length,0);r.advance(1);assert.equal(r.named('complete_visual_hint').length,1);
  assert.equal(r.calls.at(-1).args.reducedMotion,true,'Reduce Motion flag reaches the native fade-out');
  const stale=harness();stale.clear(4);await stale.show(3);assert.equal(stale.level(),0,'Clear ahead of show keeps the newer revision');
  const css=fs.readFileSync(__dirname+'/hint-overlay.css','utf8');
  assert(!css.includes('@keyframes')&&!css.includes('transition'),'No CSS animation anywhere in the overlay');
  assert(css.includes('blur(var(--cue-blur-max))')&&!css.includes('--cue-blur)'),'Blur radius is fixed per cue');
  assert(css.includes('saturate(var(--cue-saturation-min))'),'Saturation is fixed per cue');
  const js=fs.readFileSync(__dirname+'/hint-overlay.js','utf8');
  assert(!js.includes('requestAnimationFrame'),'Renderer never drives an animation');
  const native=fs.readFileSync(__dirname+'/../src-tauri/src/main.rs','utf8');
  assert(native.includes('fn complete_visual_hint(revision: u64, reduced_motion: Option<bool>'));
  assert(native.includes('fn ready_visual_hint(revision: u64, reduced_motion: Option<bool>'));
  assert(native.includes('fn trace_visual_hint(revision: u64'));
  assert(native.includes('== revision'),'Native completion is revision guarded');
  assert(native.includes('.focusable(false)'),'Hint window can never become key window');
  assert(native.includes('BackgroundThrottlingPolicy::Disabled'));
  assert(native.includes('fade_overlay_alpha(&app, revision, "in", 0.0, 0, Curve::Inhale)')&&native.includes('fade_overlay_alpha(&app, revision, "in", 1.0, fade, Curve::Inhale)'),'Window appears at alpha 0 and breathes in natively');
  assert(native.includes('fade_overlay_alpha(&app, revision, "out", ALPHA_FLOOR, fade, Curve::Exhale)'),'Window breathes out natively, never to zero');
  assert(!native.includes('animator'),'No AppKit animator: duration and curve are explicit');
  assert(native.includes('"tawel:hint-reset"'),'Renderer is neutralized after the hide');
  const policy=fs.readFileSync(__dirname+'/../src-tauri/src/hint_finish.rs','utf8');
  assert(policy.includes('enum Curve { Inhale, Exhale }')&&policy.includes('pub const STEP_MS'));
  console.log('hint-overlay.test.js: static layer, native breathing hand-off, hold, preview, stale events and reset passed');
})().catch(error=>{console.error(error);process.exitCode=1});
