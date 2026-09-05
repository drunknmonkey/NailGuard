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
    this.id = "";
    this.className = "";
    this.hidden = false;
    this.classList = new ClassList();
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parentElement = null;
    this.value = "";
    this.srcObject = null;
    this.currentTime = 0;
    this.readyState = 2;
    this.textContent = "";
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  insertAdjacentElement(position, child) {
    assert.equal(position, "afterend");
    assert.ok(this.parentElement, "afterend benötigt ein Elternelement");
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    child.parentElement = this.parentElement;
    siblings.splice(index + 1, 0, child);
    return child;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "id") this.id = String(value);
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
  const timeouts = [];
  const controlListeners = [];
  const windowListeners = new Map();
  const storage = new Map();
  const createdElements = [];
  storage.set("tawel.alpha.hint-style.v1", "ring");

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
  const settingsPage = new Element("settingsPage");
  const settingsCuesGroup = new Element("settingsCuesGroup");
  const settingsCuesTitle = new Element("settingsCuesTitle");
  settingsCuesTitle.id = "settings-cues-title";
  settingsPage.appendChild(settingsCuesGroup);
  settingsCuesGroup.appendChild(settingsCuesTitle);
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
    ["#settings-cues-title", settingsCuesTitle],
    ['.mode-tab[data-mode="calibration"]', settingsTab],
    ['.mode-tab[data-mode="focus"]', focusTab],
  ]);

  const document = {
    body,
    visibilityState: "visible",
    documentElement: { lang: "de" },
    querySelector: (selector) => selectorMap.get(selector) || null,
    querySelectorAll: () => [],
    createElement: (name) => {
      const element = new Element(name);
      createdElements.push(element);
      return element;
    },
    addEventListener() {},
    hasFocus: () => true,
  };
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
    setTimeout: (fn, delay = 0) => {
      if (delay === 0) fn();
      else timeouts.push({ fn, delay });
      return timeouts.length;
    },
    clearTimeout() {},
    setInterval: (fn) => { intervals.push(fn); return intervals.length; },
    clearInterval() {},
    window: {
      addEventListener(type, listener) {
        const listeners = windowListeners.get(type) || [];
        listeners.push(listener);
        windowListeners.set(type, listeners);
      },
      dispatchEvent(event) {
        for (const listener of windowListeners.get(event.type) || []) listener(event);
      },
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
  assert.equal(alpha.hintStyle(), "lavender-vignette");
  assert.equal(alpha.hintIntensity(), 2);
  assert.equal(
    storage.get("tawel.alpha.hint-style.v1"),
    "lavender-vignette",
    "Die alte Ring-Auswahl wird ruhig auf die Lavendel-Vignette migriert",
  );
  const initialHintSync = invocations.filter((call) => call.command === "alpha_hint_style").at(-1);
  assert.equal(initialHintSync.args.style, "lavender-vignette");
  assert.equal(initialHintSync.args.intensity, 2);

  const settingsSection = createdElements.find((element) => element.id === "alphaHintSettings");
  const styleSelect = createdElements.find((element) => element.id === "alphaHintStyle");
  const intensityInput = createdElements.find((element) => element.id === "alphaHintIntensity");
  const intensityOutput = createdElements.find((element) => element.name === "output");
  const previewButton = createdElements.find((element) => element.id === "alphaHintPreview");
  assert.ok(settingsSection, "Mac-Hinweise wurden in die Einstellungen eingefügt");
  assert.equal(settingsPage.children[1], settingsSection, "Hinweise stehen direkt nach der Ton-Gruppe");
  assert.deepEqual(
    styleSelect.children.map((option) => option.value),
    ["lavender-vignette", "soft-focus", "desaturate", "ambient-glow", "wash-focus"],
    "Alle fünf Varianten sind im Einstellungsmenü auswählbar",
  );
  assert.equal(styleSelect.value, "lavender-vignette");
  assert.equal(intensityInput.value, "2");
  assert.equal(intensityOutput.textContent, "Mittel");

  styleSelect.value = "soft-focus";
  styleSelect.dispatchEvent({ type: "change" });
  await flush();
  assert.equal(storage.get("tawel.alpha.hint-style.v1"), "soft-focus");
  assert.equal(alpha.hintStyle(), "soft-focus");
  assert.equal(
    invocations.filter((call) => call.command === "show_visual_hint").at(-1).args.style,
    "soft-focus",
    "Die Auswahl zeigt den sanften Fokusverlust sofort als Vorschau",
  );

  intensityInput.value = "3";
  intensityInput.dispatchEvent({ type: "input" });
  assert.equal(storage.get("tawel.alpha.hint-intensity.v1"), "3");
  assert.equal(alpha.hintIntensity(), 3);
  assert.equal(intensityOutput.textContent, "Deutlich");
  intensityInput.dispatchEvent({ type: "change" });
  await flush();
  const intensityPreview = invocations.filter((call) => call.command === "show_visual_hint").at(-1);
  assert.equal(intensityPreview.args.style, "soft-focus");
  assert.equal(intensityPreview.args.intensity, 3, "Die Vorschau übernimmt die grobe Intensität");

  const hintsBeforeDetection = invocations.filter((call) => call.command === "show_visual_hint").length;
  context.window.dispatchEvent({ type: "nailguard:intervention" });
  await flush();
  const detectionHints = invocations.filter((call) => call.command === "show_visual_hint");
  assert.equal(detectionHints.length, hintsBeforeDetection + 1);
  assert.equal(detectionHints.at(-1).args.style, "soft-focus");
  assert.equal(detectionHints.at(-1).args.intensity, 3);

  alpha.handleControl("hint_desaturate");
  await flush();
  assert.equal(storage.get("tawel.alpha.hint-style.v1"), "desaturate");
  assert.equal(
    invocations.filter((call) => call.command === "show_visual_hint").at(-1).args.style,
    "desaturate",
    "Die native Menüauswahl nutzt dieselbe Vorschau",
  );

  alpha.handleControl("hint_ambient_glow");
  assert.equal(storage.get("tawel.alpha.hint-style.v1"), "ambient-glow");
  alpha.handleControl("hint_wash_focus");
  assert.equal(storage.get("tawel.alpha.hint-style.v1"), "wash-focus");
  const previewsBeforeButton = invocations.filter((call) => call.command === "show_visual_hint").length;
  previewButton.click();
  assert.equal(
    invocations.filter((call) => call.command === "show_visual_hint").length,
    previewsBeforeButton + 1,
    "Probe-Hinweis ist direkt in den Einstellungen erreichbar",
  );

  const nativeSource = fs.readFileSync(`${__dirname}/../src-tauri/src/main.rs`, "utf8");
  for (const action of [
    "hint_lavender_vignette",
    "hint_soft_focus",
    "hint_desaturate",
    "hint_ambient_glow",
    "hint_wash_focus",
  ]) {
    assert.ok(nativeSource.includes(`"${action}"`), `${action} ist auch nativ verdrahtet`);
  }
  assert.ok(
    nativeSource.includes("fn show_visual_hint(style: String, intensity: u8"),
    "Native Vorschau erhält dieselbe Intensität wie die Einstellungsoberfläche",
  );

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

  document.visibilityState = "hidden";
  video.currentTime = 10;
  intervals[0]();
  for (let i = 0; i < 16; i++) { now += 1000; intervals[0](); }
  assert.equal(camera.restarts, 2, "Watchdog repariert einen stehenden Stream auch unsichtbar");

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
  now += 1000;
  intervals[0]();
  assert.equal(camera.restarts, failedRestartCount + 1, "Watchdog versucht den Kamerastart erneut");
  for (let i = 0; i < 14; i++) { now += 1000; intervals[0](); }
  assert.equal(camera.restarts, failedRestartCount + 1, "Cooldown verhindert Neustart-Schleife");
  now += 1000;
  intervals[0]();
  assert.equal(camera.restarts, failedRestartCount + 2, "Nächster Versuch nach 15 Sekunden");

  const lastStatus = invocations.filter((call) => call.command === "alpha_status").at(-1);
  assert.equal(lastStatus.args.running, true);
  assert.equal(lastStatus.args.paused, false);
  alpha.handleControl("background");
  assert.equal(invocations.at(-1).command, "background_app");
  assert.equal(alpha.isRunning(), true, "Hintergrundmodus beendet Session nicht");
  alpha.handleControl("toggle_pause");
  await flush();
  const restartsPaused = camera.restarts;
  now += 60_000;
  intervals[0]();
  assert.equal(camera.restarts, restartsPaused, "Schlaf/Unsichtbarkeit hebt Pause nicht auf");
  console.log("alpha.test.js: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
