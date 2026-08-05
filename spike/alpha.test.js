/* Minimaler DOM-Vertragstest für die ausschließlich injizierte Mac-Alpha-Brücke. */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class ClassList {
  constructor() {
    this.values = new Set();
  }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, enabled) {
    if (enabled === undefined) enabled = !this.contains(value);
    if (enabled) this.add(value);
    else this.remove(value);
  }
}

class Element {
  constructor(name) {
    this.name = name;
    this.hidden = false;
    this.classList = new ClassList();
    this.dataset = {};
    this.listeners = new Map();
    this.srcObject = null;
    this.currentTime = 0;
    this.readyState = 2;
    this.textContent = "";
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    if (event.type === "change" && this.onChange) this.onChange();
    return true;
  }
  click(trusted = false) {
    const event = { type: "click", isTrusted: trusted };
    for (const listener of this.listeners.get("click") || []) listener(event);
    if (this.onClick) this.onClick();
  }
  pause() { this.pausedByBridge = true; }
}

function liveStream(counter) {
  const track = {
    readyState: "live",
    stop() {
      this.readyState = "ended";
      counter.stops += 1;
    },
  };
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

async function main() {
  let now = 1_000_000;
  const camera = { stops: 0, restarts: 0 };
  const invocations = [];
  const intervals = [];
  const controlListeners = [];
  const storage = new Map();

  class FakeDate extends Date {
    static now() { return now; }
  }

  const body = new Element("body");
  const startPanel = new Element("startPanel");
  const workspace = new Element("workspace");
  const startButton = new Element("startButton");
  const pauseButton = new Element("pauseButton");
  const cameraSelect = new Element("cameraSelect");
  const video = new Element("video");
  const settingsTab = new Element("settingsTab");
  const focusTab = new Element("focusTab");
  workspace.hidden = true;

  startButton.onClick = () => {
    video.srcObject = liveStream(camera);
    startPanel.hidden = true;
    workspace.hidden = false;
  };
  pauseButton.onClick = () => pauseButton.classList.toggle("paused");
  cameraSelect.onChange = () => {
    camera.restarts += 1;
    video.srcObject = liveStream(camera);
    video.currentTime += 1;
  };
  settingsTab.onClick = () => { body.dataset.view = "calibration"; };
  focusTab.onClick = () => { body.dataset.view = "focus"; };

  const selectorMap = new Map([
    ["#startPanel", startPanel],
    ["#workspace", workspace],
    ["#startButton", startButton],
    ["#pauseButton", pauseButton],
    ["#cameraSelect", cameraSelect],
    ["#video", video],
    ['.mode-tab[data-mode="calibration"]', settingsTab],
    ['.mode-tab[data-mode="focus"]', focusTab],
  ]);

  const document = {
    body,
    visibilityState: "visible",
    documentElement: { lang: "de" },
    querySelector: (selector) => selectorMap.get(selector) || null,
    createElement: (name) => new Element(name),
    addEventListener() {},
    hasFocus: () => true,
  };
  body.appendChild = () => {};

  const context = {
    console,
    Date: FakeDate,
    Event: class Event {
      constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
    },
    MutationObserver: class MutationObserver { observe() {} },
    Promise,
    Number,
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    document,
    setTimeout: (fn) => { fn(); return 1; },
    setInterval: (fn) => { intervals.push(fn); return intervals.length; },
    clearInterval() {},
    window: {
      addEventListener() {},
      __TAURI__: {
        core: {
          invoke(command, args) {
            invocations.push({ command, args });
            return Promise.resolve(null);
          },
        },
        event: {
          listen(name, listener) {
            controlListeners.push({ name, listener });
            return Promise.resolve(() => {});
          },
        },
      },
      __tawelPill: {
        enter() {},
        exit() { return Promise.resolve(); },
      },
    },
  };
  context.window.window = context.window;
  context.window.document = document;

  const source = fs.readFileSync(`${__dirname}/alpha.js`, "utf8");
  vm.runInNewContext(source, context, { filename: "alpha.js" });
  await flush();

  const alpha = context.window.__tawelAlpha;
  assert.ok(alpha, "Diagnoseoberfläche wurde installiert");
  assert.equal(controlListeners[0].name, "tawel:control");

  alpha.handleControl("settings");
  await flush();
  assert.equal(body.classList.contains("alpha-settings-before-start"), true);
  assert.equal(alpha.isRunning(), false, "Einstellungen starten die Kamera nicht");

  alpha.handleControl("start");
  await flush();
  assert.equal(alpha.isRunning(), true);
  assert.equal(body.classList.contains("alpha-settings-before-start"), false);

  alpha.handleControl("snooze_15");
  await flush();
  assert.equal(alpha.isPaused(), true);
  assert.equal(camera.stops, 1, "Snooze stoppt den Kameratrack");
  assert.equal(Number(storage.get("tawel.alpha.snooze-until.v1")), now + 15 * 60_000);

  now += 15 * 60_000 + 1;
  intervals[0]();
  await flush();
  assert.equal(alpha.isPaused(), false, "abgelaufener Snooze setzt automatisch fort");
  assert.equal(camera.restarts, 1, "Fortsetzen öffnet den Kamerastream neu");
  assert.equal(storage.has("tawel.alpha.snooze-until.v1"), false);

  video.currentTime = 10;
  intervals[0]();
  now += 16_000;
  intervals[0]();
  assert.equal(camera.restarts, 2, "Watchdog repariert einen stehenden Stream");

  // Ein asynchroner WKWebView-Kameraneustart kann den alten Stream bereits
  // entfernt haben, bevor ein neuer Track bereitsteht. Die gestartete Session
  // darf dadurch nicht als beendet gelten; sonst könnte der Watchdog nie mehr
  // versuchen, die Kamera zu öffnen.
  now += 16_000;
  alpha.handleControl("toggle_pause");
  await flush();
  assert.equal(alpha.isPaused(), true);
  cameraSelect.onChange = () => {
    camera.restarts += 1;
    video.srcObject = null;
  };
  alpha.handleControl("toggle_pause");
  await flush();
  const failedRestartCount = camera.restarts;
  assert.equal(alpha.isPaused(), false);
  assert.equal(alpha.isRunning(), true, "Session bleibt während eines fehlenden Streams aktiv");

  now += 16_000;
  intervals[0]();
  assert.equal(camera.restarts, failedRestartCount + 1, "Watchdog versucht den Kamerastart erneut");

  const lastStatus = invocations.filter((call) => call.command === "alpha_status").at(-1);
  assert.equal(lastStatus.args.running, true);
  assert.equal(lastStatus.args.paused, false);
  console.log("alpha.test.js: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
