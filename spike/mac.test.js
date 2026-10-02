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
let fail=false;
const calls=[], intervals=[], listeners={};
const storage=new Map([['tawel.alpha.hint-style.v1','soft-focus'],['tawel.alpha.hint-intensity.v1','3']]);
const context = {
  document:{ getElementById:id=>{assert(elements.has(id),id);return elements.get(id)}, querySelectorAll:()=>[], createElement:()=>new Element(), documentElement:{}, body:{dataset:{}}, addEventListener(){},visibilityState:'visible',hasFocus:()=>true },
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
  setInterval:fn=>intervals.push(fn), console,
  window:{addEventListener(){},__TAURI__:{ core:{invoke:async(command,args)=>{
    calls.push({command,args});
    if(fail) throw new Error('simulated IPC failure');
    if(command==='native_preview') return '{}';
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
 fail=true; await click('preview'); assert.equal(elements.get('error').hidden,false);
 assert(!html.includes('app.js'),'Public Web app does not run in native shell');
 console.log('mac.test.js: ok');
})().catch(e=>{console.error(e);process.exitCode=1});
