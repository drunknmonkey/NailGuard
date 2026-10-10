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
      core:{invoke:(command,args)=>{calls.push({command,args,blur:blur()});return Promise.resolve()}},
      event:{listen:(name,fn)=>events.set(name,fn)}
    }}
  };
  const blur=()=>parseFloat(overlay.style.values['--cue-blur-max']);
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
  return {show,advance,blur,level,overlay,calls,named,timers,
    setLevel:(revision,value)=>events.get('tawel:hint-level')({payload:{revision,level:value}}),
    clear:revision=>events.get('tawel:hint-clear')({payload:revision}),reset:revision=>events.get('tawel:hint-reset')({payload:revision})};
}
(async()=>{
  for(const style of ['soft-focus','wash-focus','lavender-vignette','desaturate','ambient-glow']) {
    const h=harness();
    assert.equal(h.blur(),1,'Idle filter sits at the floor, never blur(0)');
    await h.show(1,{style});
    const ready=h.named('ready_visual_hint').at(-1);
    assert.equal(ready.args.revision,1);assert.equal(ready.args.reducedMotion,false);
    assert.equal(h.blur(),1,'Cue starts at the floor; the native level stream brings it up');
    assert.equal(h.overlay.dataset.style,style);assert.equal(h.overlay.dataset.phase,'held');
    // Native level stream: monotonic radius, saturation and wash opacity.
    let previous=h.blur();
    for(const value of [0.1,0.25,0.5,0.75,1]){
      h.setLevel(1,value);
      assert(h.blur()>=previous,'Radius only grows while breathing in');previous=h.blur();
      assert.equal(h.level(),value);
    }
    assert.equal(h.blur(),4,'Full level reaches the configured blur');
    assert.equal(Number(h.overlay.style.values['--cue-saturation-min']),0.56);
    if(style==='wash-focus'){h.setLevel(1,0.5);assert.equal(h.blur(),1,'Colour wash first, focus only in the second half');assert.equal(Number(h.overlay.style.values['--cue-color']),1);h.setLevel(1,1);}
    h.setLevel(2,0.1);assert.equal(h.blur(),4,'Level for another revision is ignored');
    assert.equal(h.timers.size,0,'Held cue schedules nothing');
    h.clear(2);
    assert.equal(h.calls.at(-1).command,'complete_visual_hint','Release acknowledges at once');
    assert.equal(h.calls.at(-1).args.revision,2);assert.equal(h.calls.at(-1).args.reducedMotion,false);
    assert.equal(h.blur(),4,'Release itself changes nothing; the native exhale drives the level');
    assert.equal(h.overlay.dataset.phase,'releasing');
    for(const value of [0.8,0.4,0.1,0])h.setLevel(2,value);
    assert.equal(h.blur(),1,'Exhale ends at the floor, not at zero');
    assert(!('--cue-focus' in h.overlay.style.values),'No opacity variable for backdrop layers');
    h.reset(2);assert.equal(h.overlay.dataset.phase,'idle');assert.equal(h.blur(),1);
    assert.deepEqual(h.named('trace_visual_hint').map(c=>c.args.stage),['held','release']);
  }
  // A cue arriving mid-exhale keeps the current level instead of snapping down.
  const m=harness();await m.show(1);m.setLevel(1,1);m.clear(2);m.setLevel(2,0.4);
  await m.show(3);assert.equal(m.level(),0.4,'New cue starts from the current level');
  m.setLevel(3,1);assert.equal(m.blur(),4);
  m.clear(2);m.reset(2);assert.equal(m.blur(),4,'Stale clear and reset cannot touch the new cue');
  await m.show(1);assert.equal(m.named('ready_visual_hint').length,2,'Stale show cannot replay');
  m.clear(4);m.clear(4);assert.equal(m.named('complete_visual_hint').length,2,'Duplicate clear acknowledges once');
  // Preview: fade-in plus hold, then release through the same native path.
  const p=harness();await p.show(1,{held:false,preview_hold_ms:3000});
  p.advance(4999);assert.equal(p.named('complete_visual_hint').length,0,'Hold starts after the native fade-in');
  p.advance(1);assert.equal(p.named('complete_visual_hint').length,1);assert.equal(p.calls.at(-1).args.revision,1);
  // Reduce Motion: flag handed to both native fades, shorter hold offset.
  const r=harness(true);await r.show(1,{style:'wash-focus',held:false,preview_hold_ms:1200});
  assert.equal(r.named('ready_visual_hint').at(-1).args.reducedMotion,true);
  r.advance(1349);assert.equal(r.named('complete_visual_hint').length,0);r.advance(1);assert.equal(r.named('complete_visual_hint').length,1);
  assert.equal(r.calls.at(-1).args.reducedMotion,true,'Reduce Motion flag reaches the native fade-out');
  const stale=harness();stale.clear(4);await stale.show(3);assert.equal(stale.blur(),1,'Clear ahead of show keeps the newer revision');
  const css=fs.readFileSync(__dirname+'/hint-overlay.css','utf8');
  assert(!css.includes('@keyframes')&&!css.includes('transition'),'No CSS animation anywhere in the overlay');
  assert(css.includes('blur(var(--cue-blur-max))')&&!css.includes('--cue-focus'),'Backdrop layers animate radius only');
  assert(css.includes('saturate(var(--cue-saturation-min))'));
  for(const rule of ['.hint-focus {\n  display: block;\n  opacity: 1;','.hint-desaturate {\n  display: block;\n  opacity: 1;'])assert(css.includes(rule),'Backdrop layers keep opacity 1: '+rule);
  const js=fs.readFileSync(__dirname+'/hint-overlay.js','utf8');
  assert(!js.includes('requestAnimationFrame'),'Renderer never drives an animation');
  assert(js.includes("'tawel:hint-level'"),'Renderer follows the native level stream');
  const native=fs.readFileSync(__dirname+'/../src-tauri/src/main.rs','utf8');
  assert(native.includes('fn complete_visual_hint(revision: u64, reduced_motion: Option<bool>'));
  assert(native.includes('fn ready_visual_hint(revision: u64, reduced_motion: Option<bool>'));
  assert(native.includes('fn trace_visual_hint(revision: u64'));
  assert(native.includes('== revision'),'Native completion is revision guarded');
  assert(native.includes('.focusable(false)'),'Hint window can never become key window');
  assert(native.includes('BackgroundThrottlingPolicy::Disabled'));
  assert(native.includes('"tawel:hint-level"'),'Native stepper streams the level');
  assert(native.includes('fade_overlay_level(&app, revision, "in", 1.0, fade, Curve::Inhale)')&&native.includes('fade_overlay_level(&app, revision, "out", 0.0, fade, Curve::Exhale)'),'Native clock breathes the filter strength in and out');
  assert(native.includes('put_overlay_alpha(&app, revision, 1.0, "before show")')&&native.includes('put_overlay_alpha(&ui_app, revision, ALPHA_FLOOR, "gate before hide")'),'Window alpha is only a gate around the hide');
  assert(native.includes('if !visible { fade_overlay_level(&app, revision, "in", 0.0, 0, Curve::Inhale); }'),'A cue arriving mid-exhale breathes on from where it is');
  assert(!native.includes('animator'),'No AppKit animator: duration and curve are explicit');
  assert(native.includes('"tawel:hint-reset"'),'Renderer is neutralized after the hide');
  const policy=fs.readFileSync(__dirname+'/../src-tauri/src/hint_finish.rs','utf8');
  assert(policy.includes('enum Curve { Inhale, Exhale }')&&policy.includes('pub const STEP_MS')&&policy.includes('pub const RADIUS_FLOOR_PX: f64 = 1.0'));
  assert(js.includes('RADIUS_FLOOR = 1.0, RADIUS_EXPONENT = 0.7')&&policy.includes('pub const RADIUS_FLOOR_PX: f64 = 1.0')&&policy.includes('pub const RADIUS_EXPONENT: f64 = 0.7'),'Renderer and policy agree on floor and exponent');
  const q=harness();await q.show(1);q.setLevel(1,0.5);assert(q.blur()>1+0.5*(4-1),'Half level is already past half the radius');
  assert(css.includes('.hint-focus-veil {\n  display: block;\n  background: rgba(var(--paper-rgb), var(--focus-veil));\n  opacity: var(--cue-level);'),'Soft focus breathes through a separate veil layer without backdrop');
  assert(fs.readFileSync(__dirname+'/hint-overlay.html','utf8').includes('hint-layer hint-focus-veil'),'Veil layer exists in the markup');
  console.log('hint-overlay.test.js: level-driven filter with floor, native hand-off, hold, preview, stale events and reset passed');
})().catch(error=>{console.error(error);process.exitCode=1});
