import { describe, expect, it } from "vitest";

// Imported lazily so a module that throws while building its schemas fails a test
// instead of only failing to load the test files that import it statically.
const modules = {
  frame: () => import("./frame"),
  instance: () => import("./instance"),
  manifest: () => import("./manifest"),
  session: () => import("./session"),
  token: () => import("./token"),
  index: () => import("./index"),
};

describe("protocol package", () => {
  it.each(Object.entries(modules))("the %s module loads", async (_name, load) => {
    await expect(load()).resolves.toBeDefined();
  });
});
