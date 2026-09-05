"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function main() {
  const calls = [], intervals = [];
  let reject = false, hold = false, release;
  const track = { readyState: "live", muted: false };
  const video = { currentTime: 1, readyState: 2, paused: false,
    srcObject: { getVideoTracks: () => [track] },
    getVideoPlaybackQuality: () => ({ totalVideoFrames: 20 }) };
  const context = {
    document: { querySelector: () => video },
    window: { __TAURI__: { core: { invoke(command, args) {
      assert.equal(command, "alpha_diagnostic");
      calls.push(args.sample);
      if (hold) return new Promise(resolve => { release = resolve; });
      return reject ? Promise.reject(new Error("transport")) : Promise.resolve();
    } } } },
    setInterval(fn) { intervals.push(fn); }, Date,
  };
  vm.runInNewContext(fs.readFileSync(`${__dirname}/diagnostics.js`, "utf8"), context);
  await flush();
  const diag = context.window.__tawelDiagnostic;
  diag.loop(true, false, true); await flush();
  assert.equal(calls.at(-1).timerTotal, 1);
  assert.equal(calls.at(-1).attemptsTotal, 1);
  // Timer läuft, Video steht: genau der bislang nicht unterscheidbare Fall.
  diag.loop(true, false, false); await flush();
  assert.equal(calls.at(-1).timerTotal, 2);
  assert.equal(calls.at(-1).videoChangesTotal, 0);
  assert.equal(calls.at(-1).attemptsTotal, 1);
  video.currentTime = 2;
  diag.loop(true, false, true); await flush();
  assert.equal(calls.at(-1).videoChangesTotal, 1);
  diag.stage("hand"); diag.error(new TypeError("secret/path,user-data\n")); await flush();
  assert.equal(calls.at(-1).errorsTotal, 1);
  assert.equal(calls.at(-1).lastErrorStage, "hand");
  assert.equal(calls.at(-1).lastErrorKind, "TypeError");
  assert.ok(!JSON.stringify(calls).includes("secret"), "Keine Fehlertexte/Stacks exportieren");
  intervals[0](); await flush();
  assert.equal(calls.at(-1).heartbeatTotal, 1);
  assert.equal(calls.at(-1).timerTotal, 3, "Heartbeat ist vom Erkennungsloop unabhängig");
  track.muted = true; video.paused = true;
  diag.loop(true, true, false); await flush();
  assert.equal(calls.at(-1).trackMuted, true);
  assert.equal(calls.at(-1).paused, true);
  assert.equal(calls.at(-1).videoPaused, true);
  video.srcObject = null;
  intervals[0](); await flush();
  assert.equal(calls.at(-1).trackLive, false);
  diag.watchdog(); diag.restart();
  reject = true; intervals[0](); await flush();
  reject = false; intervals[0](); await flush();
  assert.equal(calls.at(-1).ipcFailures, 1);
  assert.equal(calls.at(-1).watchdogTotal, 1);
  assert.equal(calls.at(-1).restartsTotal, 1);
  hold = true; intervals[0]();
  const before = calls.length;
  for (let i = 0; i < 100; i++) diag.loop(true, false, false);
  assert.equal(calls.length, before, "Höchstens ein ausstehender Diagnoseaufruf");
  release(); await flush(); hold = false;
  intervals[0](); await flush();
  assert.equal(calls.at(-1).timerTotal, 104, "Kumulative Zähler verlieren bei IPC-Rückstau nichts");
  const native = fs.readFileSync(`${__dirname}/../src-tauri/src/main.rs`, "utf8");
  const fields = [...native.match(/struct DiagnosticSample \{([\s\S]*?)\n\}/)[1].matchAll(/\s+(\w+):/g)].map(m => m[1]).sort();
  const keys = Object.keys(calls.at(-1)).map(k => k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)).sort();
  assert.deepEqual(keys, fields, "JS-Snapshot entspricht exakt dem nativen IPC-Vertrag");
  const html = fs.readFileSync(`${__dirname}/../spike-dist/index.html`, "utf8");
  assert.ok(html.includes('./diagnostics.js'), "Diagnose wird tatsächlich gebündelt und geladen");
  console.log("diagnostics.test.js: ok");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
