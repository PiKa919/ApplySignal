import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("hosted container does not seed hardcoded fixture observations", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const dockerignore = await readFile(new URL("../.dockerignore", import.meta.url), "utf8");
  expect(dockerfile).not.toContain("seed:fixture");
  expect(dockerfile).toContain("data/applysignal.db");
  expect(dockerignore).toContain("!data/applysignal.db");
});
