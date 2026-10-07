import assert from "node:assert/strict";
import { test } from "node:test";
import { EXTENSION_PAGE_PROBE, type ExtensionPage, ensureExtensionApis } from "./extension-page";

/** A streaming page whose probe answers from `states` in turn (the last one repeats). */
function fakePage(
  states: Array<{ initializePublisher: boolean; tabs: boolean; tabCapture: boolean }>,
) {
  let i = 0;
  const calls: string[] = [];
  const page: ExtensionPage = {
    evaluate: async (expression) => {
      calls.push(`evaluate:${expression === EXTENSION_PAGE_PROBE ? "probe" : expression}`);
      return states[Math.min(i, states.length - 1)];
    },
    reload: async () => {
      calls.push("reload");
      i++;
    },
  };
  return { page, calls };
}

const READY = { initializePublisher: true, tabs: true, tabCapture: true };
const NO_APIS = { initializePublisher: true, tabs: false, tabCapture: false };
const NOT_LOADED = { initializePublisher: false, tabs: true, tabCapture: true };
const noWait = async () => {};

test("a ready streaming page is used as is", async () => {
  const { page, calls } = fakePage([READY]);
  assert.equal(await ensureExtensionApis(page, { wait: noWait }), 0);
  assert.deepEqual(calls, ["evaluate:probe"]);
});

test("its script without its extension APIs (a relaunch race): reloaded until it has them", async () => {
  const { page, calls } = fakePage([NO_APIS, NO_APIS, READY]);
  assert.equal(await ensureExtensionApis(page, { wait: noWait }), 2);
  assert.deepEqual(calls, [
    "evaluate:probe",
    "reload",
    "evaluate:probe",
    "reload",
    "evaluate:probe",
  ]);
});

test("still loading its script: waits for it, no reload", async () => {
  let i = 0;
  const states = [NOT_LOADED, NOT_LOADED, READY];
  const calls: string[] = [];
  const page: ExtensionPage = {
    evaluate: async () => {
      calls.push("probe");
      return states[Math.min(i++, states.length - 1)];
    },
    reload: async () => {
      calls.push("reload");
    },
  };
  assert.equal(await ensureExtensionApis(page, { wait: noWait }), 0);
  assert.deepEqual(calls, ["probe", "probe", "probe"]);
});

test("never gets its APIs: fails saying so, after a bounded number of reloads", async () => {
  const { page, calls } = fakePage([NO_APIS]);
  await assert.rejects(ensureExtensionApis(page, { wait: noWait, maxReloads: 3 }), /chrome\.tabs/);
  assert.equal(calls.filter((c) => c === "reload").length, 3);
});

test("a probe that throws (page navigating) counts as not ready yet", async () => {
  let i = 0;
  const page: ExtensionPage = {
    evaluate: async () => {
      if (i++ === 0) throw new Error("Execution context was destroyed");
      return READY;
    },
    reload: async () => {},
  };
  assert.equal(await ensureExtensionApis(page, { wait: noWait }), 0);
});
