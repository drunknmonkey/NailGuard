/* DOM-Vertragstest für die capture-ausgeschlossene Mac-Hinweisschicht. */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class ClassList {
  constructor(values = []) { this.values = new Set(values); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

const listeners = new Map();
const tauriListeners = new Map();
const timeouts = [];
const invocations = [];
const overlay = {
  dataset: {},
  classList: new ClassList(),
  offsetWidth: 100,
  addEventListener(type, listener) { listeners.set(type, listener); },
};

const context = {
  document: {
    getElementById(id) {
      assert.equal(id, "hintOverlay");
      return overlay;
    },
  },
  setTimeout(fn, delay) {
    timeouts.push({ fn, delay });
    return timeouts.length;
  },
  clearTimeout() {},
  window: {
    __TAURI__: {
      core: {
        invoke(command) {
          invocations.push(command);
          return Promise.resolve(null);
        },
      },
      event: {
        listen(name, listener) {
          tauriListeners.set(name, listener);
          return Promise.resolve(() => {});
        },
      },
    },
  },
};
context.window.window = context.window;

const source = fs.readFileSync(`${__dirname}/hint-overlay.js`, "utf8");
vm.runInNewContext(source, context, { filename: "hint-overlay.js" });

assert.ok(context.window.__tawelHintOverlay);
assert.ok(tauriListeners.has("tawel:visual-hint"));

tauriListeners.get("tawel:visual-hint")({
  payload: { style: "soft-focus", intensity: 3 },
});
assert.equal(overlay.dataset.style, "soft-focus");
assert.equal(overlay.dataset.intensity, "3");
assert.equal(overlay.classList.contains("is-active"), true);
assert.equal(timeouts.at(-1).delay, 3400);

listeners.get("animationend")({
  target: { classList: new ClassList(["hint-terminal"]) },
});
assert.equal(overlay.classList.contains("is-active"), false);
assert.equal(invocations.at(-1), "hide_visual_hint");

context.window.__tawelHintOverlay.show("ambient-glow", 1);
assert.equal(overlay.dataset.style, "ambient-glow");
assert.equal(overlay.dataset.intensity, "1");
assert.equal(overlay.classList.contains("is-active"), true);

context.window.__tawelHintOverlay.show("unbekannt");
assert.equal(
  overlay.dataset.style,
  "lavender-vignette",
  "Unbekannte Werte fallen sicher auf Lavendel-Vignette zurück",
);
assert.equal(overlay.dataset.intensity, "2", "Unbekannte Intensität fällt auf Mittel zurück");

assert.deepEqual(
  [...context.window.__tawelHintOverlay.styles],
  ["lavender-vignette", "soft-focus", "desaturate", "ambient-glow", "wash-focus"],
);

const html = fs.readFileSync(`${__dirname}/hint-overlay.html`, "utf8");
const css = fs.readFileSync(`${__dirname}/hint-overlay.css`, "utf8");
for (const style of context.window.__tawelHintOverlay.styles) {
  assert.ok(css.includes(`data-style="${style}"`), `${style} besitzt einen CSS-Modus`);
}
assert.ok(html.includes("hint-combo-focus"), "Die gestufte Kombination besitzt eine Fokusphase");
assert.ok(css.includes("backdrop-filter: blur("), "Fokusvarianten filtern den transparenten Hintergrund");
assert.ok(css.includes("backdrop-filter: saturate("), "Entsättigung filtert den transparenten Hintergrund");
assert.equal(css.includes("196, 106, 74"), false, "Das frühere Alarmrot ist aus dem Overlay entfernt");

console.log("hint-overlay.test.js: ok");
