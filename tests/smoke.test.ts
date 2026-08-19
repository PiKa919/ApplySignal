import { describe, expect, test } from "bun:test";

describe("project shell", () => {
  test("exposes a stable application name", async () => {
    const { APP_NAME } = await import("../src/index");
    expect(APP_NAME).toBe("ApplySignal");
  });
});
