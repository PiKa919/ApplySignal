import { readFile } from "node:fs/promises";
import { createDatabase } from "../storage/database";
import { ingestCollectorResult } from "../collectors/ingest";

const rows = JSON.parse(await readFile(new URL("../collectors/fixtures/zfh-jobs.json", import.meta.url), "utf8"));
const dbPath = process.env.APPLYSIGNAL_DB ?? "data/applysignal.db";
const db = createDatabase(dbPath);
const result = ingestCollectorResult(db, {
  runId: `fixture-${Date.now()}`,
  collectorId: "fixture-zfh",
  sourceId: "zfh",
  sourceUrl: "https://careers.zerodhafundhouse.com/jobs",
  observedAt: new Date().toISOString(),
  status: "success",
  rawOutput: JSON.stringify(rows),
  stderr: "",
  rows,
  expectedMinimumRows: 2,
}, "fixture");
console.log(JSON.stringify(result));
db.close();
