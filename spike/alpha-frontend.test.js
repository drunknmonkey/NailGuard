/* Test des erzeugten Mac-Loops mit vollständig stillgelegtem Rendering. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(`${__dirname}/../spike-dist/app.js`, "utf8");
const methods = source.slice(source.indexOf("  timer: null,"), source.indexOf("  detectFrame(now)"));
assert.ok(methods.includes("scheduleNextFrame"));
assert.ok(!source.includes("requestAnimationFrame(detection.loop)"), "Auch Erststart hängt nicht am Rendering");
let now = 0, detections = 0, frameError = false;
const tasks = new Map();
let nextId = 0;
const context = {
  state: { running: true, paused: false, lastVideoTime: -1 },
  els: { video: { currentTime: 1, readyState: 2 } },
  live: true,
  hasLiveCameraTrack: () => context.live,
  performance: { now: () => now },
  document: { visibilityState: "hidden" },
  requestAnimationFrame() { throw new Error("Rendering darf nicht benötigt werden"); },
  setTimeout(fn, delay) { tasks.set(++nextId, { fn, delay }); return nextId; },
  detect() { detections++; if (frameError) throw new Error("frame-error"); },
};
vm.runInNewContext(`var detection = {${methods} detectFrame: detect};`, context);
const d = context.detection;
function tick() {
  assert.equal(tasks.size, 1, "Genau ein ausstehender Durchlauf");
  const [id, task] = tasks.entries().next().value;
  tasks.delete(id);
  now += task.delay;
  task.fn();
}
d.scheduleNextFrame();
d.scheduleNextFrame();
assert.equal(tasks.size, 1, "Doppelstart erzeugt keinen zweiten Loop");
tick();
assert.equal(detections, 1, "Verstecktes Fenster verarbeitet einen Frame");
tick();
assert.equal(detections, 1, "Derselbe Frame wird nicht zweimal verarbeitet");
context.state.paused = true;
context.els.video.currentTime++;
tick();
assert.equal(detections, 1, "Pause wertet keine Frames aus");
assert.equal([...tasks.values()][0].delay, 200, "Pause reduziert Timerlast");
context.state.paused = false;
context.live = false;
tick();
assert.equal(detections, 1, "Kein ungültiger Frame beim Kamerawechsel");
context.live = true;
tick();
assert.equal(detections, 2, "Fortsetzen im Hintergrund funktioniert");
frameError = true;
context.els.video.currentTime++;
assert.throws(tick, /frame-error/);
assert.equal(tasks.size, 1, "Framefehler beendet den Loop nicht");
frameError = false;
context.els.video.currentTime++;
tick();
assert.equal(detections, 4);
context.state.running = false;
tick();
assert.equal(tasks.size, 0, "Beendete Session plant nichts mehr");
console.log("alpha-frontend.test.js: ok");
