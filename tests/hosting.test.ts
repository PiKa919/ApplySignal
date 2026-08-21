import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("hosted container does not seed hardcoded fixture observations", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const dockerignore = await readFile(new URL("../.dockerignore", import.meta.url), "utf8");
  expect(dockerfile).not.toContain("seed:fixture");
  expect(dockerfile).toContain("data/applysignal.db");
  expect(dockerfile).toContain("COPY data/applysignal.db /tmp/applysignal.db");
  expect(dockerignore).toContain("!data/applysignal.db");
});

test("Render points at the live database shipped in the image", async () => {
  const renderYaml = await readFile(new URL("../render.yaml", import.meta.url), "utf8");
  expect(renderYaml).toContain("value: /app/data/applysignal.db");
  expect(renderYaml).not.toContain("value: /tmp/applysignal.db");
});

test("scheduled research worker is bounded and authenticated separately", async () => {
  const workflow = await readFile(new URL("../.github/workflows/research-queue.yml", import.meta.url), "utf8");
  expect(workflow).toContain("schedule:");
  expect(workflow).toContain("APPLYSIGNAL_RESEARCH_MAX_ITEMS: \"1\"");
  expect(workflow).toContain("BRIGHTDATA_RESEARCH_COLLECTOR_ID");
  expect(workflow).toContain("brightdata login --api-key");
  expect(workflow).toContain("BRIGHTDATA_API_KEY is not configured");
  expect(workflow).toContain("SKIP_RESEARCH_QUEUE=true");
});
