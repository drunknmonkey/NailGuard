"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
async function main() {
  const classes = new Set(), calls = [], nodes = [];
  let fail = false;
  function element() {
    const e = { listeners: {}, children: {}, addEventListener(k, fn) { this.listeners[k] = fn; },
      querySelector(k) { return this.children[k] ||= element(); } };
    nodes.push(e); return e;
  }
  const context = {
    window: { __TAURI__: { core: { invoke(cmd) {
      calls.push(cmd);
      if (cmd === "enter_pill" && fail) return Promise.reject(new Error("window-error"));
      return Promise.resolve([0, 0]);
    } } }, addEventListener() {} },
    document: { body: { classList: { contains: k => classes.has(k), add: k => classes.add(k), remove: k => classes.delete(k) }, appendChild() {} },
      documentElement: { lang: "de" }, createElement: element },
    localStorage: { getItem: () => null, setItem() {} },
    setInterval: () => 1, clearInterval() {},
  };
  vm.runInNewContext(fs.readFileSync(`${__dirname}/pill.js`, "utf8"), context);
  const pill = context.window.__tawelPill;
  const background = nodes.find(n => n.className === "pill-enter-btn");
  background.listeners.click();
  assert.equal(calls.at(-1), "background_app", "Button versteckt statt anzudocken");
  assert.equal(pill.isActive(), false);
  await pill.enter();
  assert.equal(pill.isActive(), true);
  await pill.enter();
  assert.equal(calls.filter(c => c === "enter_pill").length, 2, "Versteckte Pille lässt sich erneut zeigen");
  const stage = nodes.find(n => n.className === "pill-stage");
  stage.querySelector(".pill-close").listeners.click();
  assert.equal(calls.at(-1), "background_app", "Pillen-X beendet die App nicht");
  await pill.exit();
  assert.equal(pill.isActive(), false);
  fail = true;
  await assert.rejects(pill.enter(), /window-error/);
  assert.equal(pill.isActive(), false, "Fehlgeschlagener Wechsel stellt CSS zurück");
  console.log("pill.test.js: ok");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
