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

tauriListeners.get("tawel:visual-hint")({ payload: "wash" });
assert.equal(overlay.dataset.style, "wash");
assert.equal(overlay.classList.contains("is-active"), true);
assert.equal(timeouts.at(-1).delay, 3200);

listeners.get("animationend")({
  target: { classList: new ClassList(["hint-layer"]) },
});
assert.equal(overlay.classList.contains("is-active"), false);
assert.equal(invocations.at(-1), "hide_visual_hint");

context.window.__tawelHintOverlay.show("vignette");
assert.equal(overlay.dataset.style, "vignette");
assert.equal(overlay.classList.contains("is-active"), true);

context.window.__tawelHintOverlay.show("unbekannt");
assert.equal(overlay.dataset.style, "vignette", "Unbekannte Werte fallen sicher auf Vignette zurück");

console.log("hint-overlay.test.js: ok");
