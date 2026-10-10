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
    events.get('tawel:visual-hint')({payload:{revision,style:'soft-focus',intensity:2,held:true,finish:'opacity',animation:{blur:4,fadeIn:2000,fadeOut:450},...extra}});
    await flush();
  }
  function advance(ms) {
    now+=ms;
    const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));
    for(const [key,timer] of [...timers])if(timer.at<=now){timers.delete(key);timer.fn()}
  }
  return {show,advance,level,overlay,calls,frames,timers,clear:(revision,finish)=>events.get('tawel:hint-clear')({payload:finish?{revision,finish}:revision}),reset:revision=>events.get('tawel:hint-reset')({payload:revision})};
}
(async()=>{
  for(const style of ['soft-focus','wash-focus','lavender-vignette','desaturate','ambient-glow']) {
    // Withdrawal during entrance used to leave entrance/delayed blur running.
    const h=harness();await h.show(1,{style});
    h.advance(500);assert(h.level()>0&&h.level()<1);
    const fixedBlur=h.overlay.style.values['--cue-blur-max'];
    assert.equal(fixedBlur,'4px','Filter strength is set once per cue');
    h.clear(2);let previous=h.level();
    let previousFocus=Number(h.overlay.style.values['--cue-focus']);
    for(let i=0;i<10;i++){
      h.advance(50);assert(h.level()<=previous,'Release can only weaken');
      const focus=Number(h.overlay.style.values['--cue-focus']);
      assert(focus<=previousFocus,'Delayed focus must not appear after withdrawal');
      assert.equal(h.overlay.style.values['--cue-blur-max'],fixedBlur,'Filter structure never changes while visible');
      previous=h.level();previousFocus=focus;
    }
    assert.equal(h.level(),0);assert.equal(h.overlay.dataset.phase,'idle');
    assert.equal(h.calls.at(-1).command,'complete_visual_hint');
    assert.equal(h.calls.at(-1).args.revision,2);
    assert.equal(h.calls.at(-1).level,0,'Hide only after opacity reaches zero');
    assert(!('--cue-blur' in h.overlay.style.values),'No per-frame filter radius');
    const stages=h.calls.filter(c=>c.command==='trace_visual_hint').map(c=>c.args.stage);
    assert.deepEqual(stages,['shown','release'],'Renderer reports first frame and release for the native log');
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
  // Product path: the renderer only acknowledges; the window server fades the window.
  const n=harness();await n.show(1,{finish:'native'});n.advance(2000);assert.equal(n.level(),1);
  n.clear(2,'native');assert.equal(n.calls.at(-1).command,'complete_visual_hint','Native release acknowledges at once');
  assert.equal(n.calls.at(-1).args.revision,2);assert.equal(n.calls.at(-1).level,1,'Layer stays untouched while the window fades');
  n.advance(3000);assert.equal(n.level(),1,'No renderer animation in native mode');assert.equal(n.overlay.dataset.phase,'releasing');
  assert.equal(n.frames.size,0,'Nothing renders while the window fades natively');
  n.reset(2);assert.equal(n.level(),0,'Reset after the off-screen hide neutralizes the layer');assert.equal(n.overlay.dataset.phase,'idle');
  n.reset(1);n.clear(1,'native');assert.equal(n.level(),0,'Stale reset/clear are ignored');
  // A clear during the entrance stops the entrance; the window fades from there.
  const e=harness();await e.show(1,{finish:'native'});e.advance(500);const partial=e.level();assert(partial>0&&partial<1);
  e.clear(2,'native');e.advance(2000);assert.equal(e.level(),partial,'Entrance frozen for the native fade');
  await e.show(3,{finish:'native'});assert.equal(e.level(),0,'Next cue starts neutral even without reset');
  // Test C: renderer fades to a small floor, never to zero, before park + hide.
  const f=harness();await f.show(1,{finish:'floor',held:false,preview_hold_ms:3000});f.advance(2000);f.advance(3000);
  for(let i=0;i<12;i++)f.advance(50);
  assert.equal(f.level(),0.02,'Floor keeps the backdrop group alive');assert.equal(f.calls.at(-1).command,'complete_visual_hint');
  f.reset(1);assert.equal(f.level(),0);
  // Clock keeps running on a timer when rAF stalls, and reports it once per stall.
  const s=harness();await s.show(1);s.frames.clear();
  s.advance(130);assert(s.level()>0,'Timer fallback advanced the entrance without rAF');
  assert(s.calls.some(c=>c.command==='trace_visual_hint'&&c.args.stage==='stall'),'Stall is reported to the native log');
  for(let i=0;i<20;i++){s.frames.clear();s.advance(130);}assert.equal(s.level(),1,'Entrance completes on the timer alone');
  assert.equal(s.calls.filter(c=>c.command==='trace_visual_hint'&&c.args.stage==='held').length,1);
  const css=fs.readFileSync(__dirname+'/hint-overlay.css','utf8');
  assert(!css.includes('@keyframes')&&!css.includes('transition'),'No independent animation can compete with release');
  assert(css.includes('blur(var(--cue-blur-max))')&&!css.includes('--cue-blur)'),'Blur radius is fixed per cue; only opacity moves');
  assert(css.includes('saturate(var(--cue-saturation-min))'),'Saturation is fixed per cue');
  const native=fs.readFileSync(__dirname+'/../src-tauri/src/main.rs','utf8');
  assert(native.includes('fn complete_visual_hint(revision: u64'));
  assert(native.includes('fn ready_visual_hint(revision: u64'));
  assert(native.includes('fn trace_visual_hint(revision: u64'));
  assert(native.includes('== revision'),'Native completion is revision guarded');
  assert(native.includes('.focusable(false)'),'Hint window can never become key window');
  assert(native.includes('animate_overlay_alpha(&overlay, 1.0, 0)'),'Alpha returns to 1 before the window is shown');
  const policy=fs.readFileSync(__dirname+'/../src-tauri/src/hint_finish.rs','utf8');
  assert(policy.includes('renderer: "native", fade_window: true, park: true'),'Product path: window fades itself and is parked before hiding');
  assert(native.includes('fn park_hint_overlay')&&native.includes('park_hint_overlay(app, &overlay)'),'Window leaves the screen before it is hidden');
  assert(native.includes('animate_overlay_alpha(&overlay, ALPHA_FLOOR, fade_out)'),'Native fade ends above zero');
  assert(native.includes('BackgroundThrottlingPolicy::Disabled'),'Overlay clock is never throttled by WebKit');
  assert(native.includes('"tawel:hint-reset"'),'Renderer is neutralized after the off-screen hide');
  console.log('hint-overlay.test.js: monotonic release, hold, preview, stale events and neutral handoff passed');
})().catch(error=>{console.error(error);process.exitCode=1});
