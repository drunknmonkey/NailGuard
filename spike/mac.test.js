// Executable Mac shell contract: native state, controls, settings and camera choice.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() { this.hidden=false; this.disabled=false; this.value=''; this.textContent=''; this.dataset={}; this.listeners={}; this.attributes={}; }
  addEventListener(name, fn) { this.listeners[name]=fn; }
  setAttribute(name,value) { this.attributes[name]=value; }
  replaceChildren(...children) { this.children=children; }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() {}
}
const elements = new Map();
const html = fs.readFileSync(__dirname+'/mac.html','utf8');
for(const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1],new Element());
let snapshot = {enabled:false,status:0,camera:'',hintActive:false,snoozeUntil:null};
let fail=false, pendingPreview=null;
const calls=[], intervals=[], listeners={};
const images=[];
const storage=new Map([['tawel.alpha.hint-style.v1','soft-focus'],['tawel.alpha.hint-intensity.v1','3']]);
const context = {
  document:{ getElementById:id=>{assert(elements.has(id),id);return elements.get(id)}, querySelectorAll:()=>[], createElement:()=>new Element(), documentElement:{}, body:{dataset:{}}, addEventListener(){},visibilityState:'visible',hasFocus:()=>true },
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
  setInterval:fn=>intervals.push(fn), console,
  setTimeout, clearTimeout,
  Image: class { constructor() { images.push(this); } },
  window:{addEventListener(){},__TAURI__:{ core:{invoke:async(command,args)=>{
    calls.push({command,args});
    if(fail) throw new Error('simulated IPC failure');
    if(command==='native_preview') { if(args.enabled && pendingPreview) return new Promise(resolve=>pendingPreview.resolve=resolve); return '{}'; }
    if(command==='native_snapshot') return {...snapshot};
    if(command==='native_sound_settings') return JSON.stringify({enabled:true,preset:2,volume:0.4});
    if(command==='native_review') return JSON.stringify({today:'2026-10-02',yesterday:'2026-10-01',days:{'2026-10-02':{moments:2,observedSeconds:1200,longestQuietSeconds:500,hourly:Array(24).fill(0)}}});
  }},event:{listen:async(name,fn)=>{listeners[name]=fn}}}},
};
const flush=async()=>{for(let i=0;i<20;i++) await Promise.resolve();};
const click=async(id,event='click')=>{elements.get(id).listeners[event]({});await flush();};
(async()=>{
 for(const file of ['mac-i18n.js','mac.js']) vm.runInNewContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context);
 await flush();
 assert.equal(elements.get('primaryAction').textContent,'Kamera starten');
 assert.equal(elements.get('hintStyle').value,'soft-focus');
 assert.equal(elements.get('hintIntensity').value,3);
 await click('settingsTab'); assert.equal(elements.get('settingsView').hidden,false,'Settings accessible before starting');
 await click('primaryAction'); assert.equal(calls.some(c=>c.command==='native_start'),true);
 snapshot={...snapshot,enabled:true,status:2,camera:'Microsoft LifeCam HD-3000'};
 await intervals[0]();await flush();
 assert.equal(elements.get('primaryAction').textContent,'Pausieren');
 assert.equal(elements.get('settingsCamera').textContent,snapshot.camera);
 await click('primaryAction');assert.equal(calls.at(-2).args.action,'pause');
 snapshot.status=3; await intervals[0]();await flush();
 assert.equal(elements.get('primaryAction').textContent,'Fortsetzen');
 snapshot.status=11; await intervals[0]();await flush();
 assert.equal(elements.get('primaryAction').disabled,true,'Cannot double start a camera dialog');
 snapshot={...snapshot,enabled:false,status:0};await intervals[0]();await flush();
 assert.equal(elements.get('primaryAction').disabled,false,'Cancel allows next choice');
 elements.get('hintStyle').value='ambient-glow';await click('hintStyle','change');
 assert.equal(storage.get('tawel.alpha.hint-style.v1'),'ambient-glow');
 assert.equal(calls.some(c=>c.command==='show_visual_hint'&&c.args.style==='ambient-glow'),true);
 await click('heldPreview');
 assert.equal(calls.filter(c=>c.command==='show_visual_hint').at(-1).args.holdMs,3000,'Camera-free test uses the same display with a three-second hold');
 assert.equal(calls.filter(c=>c.command==='show_visual_hint').at(-1).args.finishMode,'keep_transparent');
 await click('delayedPreview');
 assert.equal(calls.filter(c=>c.command==='show_visual_hint').at(-1).args.finishMode,'delayed');
 await click('parkedPreview');
 assert.equal(calls.filter(c=>c.command==='show_visual_hint').at(-1).args.finishMode,'parked');
 assert.equal(calls.filter(c=>c.command==='show_visual_hint').at(-1).args.holdMs,3000);
 assert.equal(calls.filter(c=>c.command==='show_visual_hint').filter(c=>!c.args.finishMode).length>0,true,'Preview and real cues leave the finish to the native default');
 const beforeTest=calls.filter(c=>c.command==='show_visual_hint').length;
 snapshot={...snapshot,enabled:true,status:2};await intervals[0]();await flush();
 await click('heldPreview');await click('delayedPreview');await click('parkedPreview');
 assert.equal(calls.filter(c=>c.command==='show_visual_hint').length,beforeTest,'A/B/C tests require a paused or stopped camera');
 assert.equal(elements.get('error').textContent,context.window.TAWEL_MAC_COPY.de.pauseForHintTest);
 snapshot.status=3;await intervals[0]();await flush();await click('delayedPreview');
 assert.equal(calls.filter(c=>c.command==='show_visual_hint').length,beforeTest+1);
 await click('endHintTest');assert(calls.some(c=>c.command==='hide_visual_hint'));
 snapshot.enabled=false;
 snapshot.status=5;await intervals[0]();await flush();
 assert.equal(elements.get('focusTitle').textContent,'Kamera nicht verfügbar.');
 await click('settingsChooseCamera');assert.equal(calls.filter(c=>c.command==='native_start').length,2);
 await click('reviewTab'); assert.equal(elements.get('reviewView').hidden,false);
 assert.equal(elements.get('reviewSummary').textContent.includes('2 erkannte Momente'),true);
 assert.equal(elements.get('soundToggle').checked,true);
 assert.equal(elements.get('soundPreset').value,'2');
 elements.get('soundVolume').value='0.6';await click('soundVolume','change');
 assert(calls.some(c=>c.command==='native_sound'&&c.args.volume===0.6&&!c.args.preview));
 await click('testSound');assert(calls.some(c=>c.command==='native_sound'&&c.args.preview));
 assert(!html.includes('id="background"'));
 assert(!html.includes('id="chooseCamera"') && !html.includes('id="hintSettings"'));
 await click('settingsTab'); await click('cameraSection');
 assert.equal(elements.get('cameraPanel').hidden,false);
 elements.get('cameraPreviewToggle').checked=true; await click('cameraPreviewToggle','change');
 await intervals[1](); await flush(); assert(calls.some(c=>c.command==='native_preview'&&c.args.enabled));
 await click('focusTab'); const before=calls.filter(c=>c.command==='native_preview'&&c.args.enabled).length;
 await intervals[1](); await flush(); assert.equal(calls.filter(c=>c.command==='native_preview'&&c.args.enabled).length,before);
 assert(calls.some(c=>c.command==='native_preview'&&!c.args.enabled));
 await click('settingsTab'); pendingPreview={};
 const pendingPoll=intervals[1](); await flush();
 await click('focusTab'); pendingPreview.resolve(JSON.stringify({image:'late frame'})); await pendingPoll; await flush();
 assert.equal(elements.get('cameraFrame').hidden,true,'Late frames cannot reappear after leaving settings');
 pendingPreview=null;
 await click('settingsTab'); pendingPreview={};
 const decodingPoll=intervals[1](); await flush();
 pendingPreview.resolve(JSON.stringify({image:'decoding frame',timestamp:1})); await flush();
 const previewRequests=calls.filter(c=>c.command==='native_preview'&&c.args.enabled).length;
 await intervals[1](); await flush();
 assert.equal(calls.filter(c=>c.command==='native_preview'&&c.args.enabled).length,previewRequests,'Only one image decode in flight');
 const controls=calls.filter(c=>c.command==='native_control'||c.command==='native_start').length;
 await click('focusTab'); images.at(-1).onload(); await decodingPoll; await flush();
 assert.equal(elements.get('cameraFrame').hidden,true,'Decoded image from camera page cannot appear in focus');
 assert.equal(calls.filter(c=>c.command==='native_control'||c.command==='native_start').length,controls,'Returning to focus never pauses or restarts camera');
 pendingPreview=null;
 await click('settingsTab'); await click('animationSection');
 assert.equal(elements.get('animationPanel').hidden,false);
 elements.get('blur').value='6'; await click('blur','input'); await click('blur','change');
 elements.get('fadeIn').value='2000'; await click('fadeIn','input'); await click('fadeIn','change');
 assert.equal(JSON.parse(storage.get('tawel.alpha.blur-animation.v1')).blur,6);
 assert.equal(calls.filter(c=>c.command==='show_visual_hint').at(-1).args.animation.fadeIn,2000);
 assert.equal(calls.filter(c=>c.command==='alpha_hint_style').at(-1).args.animation.blur,6);
 await click('animationReset');
 assert.equal(JSON.parse(storage.get('tawel.alpha.blur-animation.v1')).fadeIn,650);
 assert.equal(elements.get('blur').value,2.7);
 await click('performanceSection'); assert.equal(elements.get('performancePanel').hidden,false);
 snapshot.performance={profile:3,width:1280,height:720,frames:100,inferenceMs:85,cpuPercent:123.4,thermal:0};
 snapshot.status=2; await intervals[0]();await flush();
 assert.equal(elements.get('actualResolution').textContent,'1280 × 720');
 assert.equal(elements.get('analysisTime').textContent,'85 ms');
 assert.equal(elements.get('cameraQuality').value,'1');
 elements.get('cameraQuality').value='0'; await click('cameraQuality','change');
 assert(calls.some(c=>c.command==='native_quality'&&!c.args.detail&&c.args.fallback));
 assert.equal(elements.get('cameraQuality').value,'0','Pending quality remains visible until engine confirms it');
 snapshot.performance.profile=2; await intervals[0]();await flush();
 elements.get('fingerFallback').checked=false; await click('fingerFallback','change');
 assert(calls.some(c=>c.command==='native_quality'&&!c.args.detail&&!c.args.fallback));
 snapshot.status=12; await intervals[0]();await flush(); assert.equal(elements.get('focusTitle').textContent,'Gesicht ausrichten.');
 snapshot.status=13; await intervals[0]();await flush(); assert.equal(elements.get('focusTitle').textContent,'Handpunkte unsicher.');
 snapshot.status=14; await intervals[0]();await flush(); assert.equal(elements.get('focusTitle').textContent,'Auswertung wartet.');
 await click('primaryAction'); assert(calls.some(c=>c.command==='native_control'&&c.args.action==='pause'));
 snapshot.status=2; await intervals[0]();await flush(); assert.equal(elements.get('focusTitle').textContent,'Du kannst einfach weitermachen.');
 fail=true; await click('preview'); assert.equal(elements.get('error').hidden,false);
 assert(!html.includes('app.js'),'Public Web app does not run in native shell');
 console.log('mac.test.js: ok');
})().catch(e=>{console.error(e);process.exitCode=1});
