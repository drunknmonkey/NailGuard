/* Regressionstest für den ausschließlich erzeugten Mac-Frontend-Loop. */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const sourcePath = process.argv[2] || `${__dirname}/../spike-dist/app.js`;
const source = fs.readFileSync(sourcePath, "utf8");
const loopMatch = source.match(/\n  loop\(now\) \{([\s\S]*?)\n  \},\n\n  detectFrame\(now\)/);

assert.ok(loopMatch, "Erkennungsloop im erzeugten Mac-Frontend gefunden");

function runLoop({ paused, liveTrack, frameError = null }) {
  let scheduled = 0;
  let detections = 0;
  const context = {
    state: { running: true, paused, lastVideoTime: -1 },
    els: { video: { currentTime: 1, readyState: 2 } },
    hasLiveCameraTrack: () => liveTrack,
    requestAnimationFrame(callback) {
      scheduled += 1;
      assert.equal(typeof callback, "function");
    },
    detection: {
      detectFrame() {
        detections += 1;
        if (frameError) throw frameError;
      },
    },
  };

  vm.runInNewContext(
    `detection.loop = function (now) {${loopMatch[1]}\n};`,
    context,
    { filename: sourcePath },
  );

  let thrown = null;
  try {
    context.detection.loop(1000);
  } catch (error) {
    thrown = error;
  }

  return { detections, scheduled, thrown };
}

assert.deepEqual(
  runLoop({ paused: true, liveTrack: true }),
  { detections: 0, scheduled: 1, thrown: null },
  "Pause verarbeitet keinen Kameraframe, hält den Loop aber am Leben",
);
assert.deepEqual(
  runLoop({ paused: false, liveTrack: false }),
  { detections: 0, scheduled: 1, thrown: null },
  "Fortsetzen wartet auf einen neuen Live-Track",
);
assert.deepEqual(
  runLoop({ paused: false, liveTrack: true }),
  { detections: 1, scheduled: 1, thrown: null },
  "Ein neuer Live-Track wird wieder ausgewertet",
);

const frameError = new Error("ungueltiger-frame");
const failedFrame = runLoop({ paused: false, liveTrack: true, frameError });
assert.equal(failedFrame.detections, 1);
assert.equal(failedFrame.scheduled, 1, "Auch nach einem Framefehler ist der nächste Loop geplant");
assert.equal(failedFrame.thrown, frameError, "Der Fehler wird nicht still verschluckt");

console.log("alpha-frontend.test.js: ok");
