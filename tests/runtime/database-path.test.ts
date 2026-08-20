import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDatabasePath } from "../../src/runtime/database-path";

test("live-only mode falls back from an empty configured database to the bundled live snapshot", () => {
  const root = mkdtempSync(join(tmpdir(), "applysignal-db-path-"));
  const configuredPath = join(root, "configured.db");
  const bundledPath = join(root, "bundled.db");
  writeFileSync(configuredPath, "");
  writeFileSync(bundledPath, "live snapshot");

  expect(resolveDatabasePath(configuredPath, { liveOnly: true, bundledPath })).toBe(bundledPath);
});

test("non-live mode preserves the explicitly configured database path", () => {
  const root = mkdtempSync(join(tmpdir(), "applysignal-db-path-"));
  const configuredPath = join(root, "configured.db");
  const bundledPath = join(root, "bundled.db");
  writeFileSync(configuredPath, "configured");
  writeFileSync(bundledPath, "live snapshot");

  expect(resolveDatabasePath(configuredPath, { liveOnly: false, bundledPath })).toBe(configuredPath);
});
