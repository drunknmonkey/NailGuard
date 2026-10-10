/* Ausschließlich Mac-Diagnose: Zustände/Zähler, keine Bilder oder Fehlermeldungstexte. */
(function () {
  "use strict";
  var video = document.querySelector("#video");
  var previousVideoTime = null;
  var phase = "idle";
  var pending = false;
  var data = {
    sequence: 0, timerTotal: 0, heartbeatTotal: 0, videoChangesTotal: 0,
    attemptsTotal: 0, errorsTotal: 0, ipcFailures: 0, watchdogTotal: 0, restartsTotal: 0,
    running: false, paused: false, videoTime: -1, readyState: 0,
    videoPaused: true, trackLive: false, trackMuted: false,
    decodedFrames: -1, lastErrorKind: "none", lastErrorStage: "none",
    lastErrorAtMs: -1,
  };

  function sample() {
    if (!video) return;
    var time = Number(video.currentTime);
    if (Number.isFinite(time)) {
      if (previousVideoTime !== null && time !== previousVideoTime) data.videoChangesTotal++;
      previousVideoTime = time;
      data.videoTime = time;
    }
    data.readyState = Number(video.readyState) || 0;
    data.videoPaused = Boolean(video.paused);
    var stream = video.srcObject;
    var tracks = stream && stream.getVideoTracks ? stream.getVideoTracks() : [];
    var track = tracks[0];
    data.trackLive = Boolean(track && track.readyState === "live");
    data.trackMuted = Boolean(track && track.muted);
    var quality = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null;
    data.decodedFrames = quality && Number.isFinite(quality.totalVideoFrames)
      ? quality.totalVideoFrames : -1;
  }

  function send() {
    // Keine Await-Abhängigkeit im Erkennungsloop. Jeder Snapshot ist kumulativ;
    // native Sequenzprüfung verhindert Rücksprünge bei verspätetem IPC.
    try {
      sample();
      var core = window.__TAURI__ && window.__TAURI__.core;
      if (!core || !core.invoke || pending) return;
      pending = true;
      data.sequence++;
      core.invoke("alpha_diagnostic", { sample: Object.assign({}, data) })
        .catch(function () { data.ipcFailures++; })
        .finally(function () { pending = false; });
    } catch (_) { pending = false; data.ipcFailures++; }
  }

  window.__tawelDiagnostic = {
    loop: function (running, paused, eligible) {
      data.timerTotal++;
      data.running = running;
      data.paused = paused;
      if (eligible) data.attemptsTotal++;
      phase = "frame";
      send(); // Vor der synchronen Auswertung, auch bei unverändertem Video.
    },
    watchdog: function () { data.watchdogTotal++; },
    restart: function () { data.restartsTotal++; },
    stage: function (value) { phase = value; },
    error: function (error) {
      data.errorsTotal++;
      var name = error && error.name;
      data.lastErrorKind = ["Error", "TypeError", "RangeError", "InvalidStateError", "NotAllowedError", "AbortError"].indexOf(name) >= 0 ? name : "OtherError";
      data.lastErrorStage = phase;
      data.lastErrorAtMs = Date.now();
      send();
    },
  };
  setInterval(function () { data.heartbeatTotal++; send(); }, 1000);
  send();
})();
