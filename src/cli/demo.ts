import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { RawJobRow } from "../domain/observations";
import {
  assessCollectorRows,
  buildHealDiagnosis,
  compareDistributionalHealth,
  type CollectorHealthContract,
  type CollectorHealthReport,
  type HealDiagnosis,
  type DistributionalHealthComparison,
} from "../collectors/health";
import { loadControlledFixture } from "../collectors/controlled-fixture";

export interface HealthDemoEvidence {
  demo: "fault_injection";
  simulated: true;
  collectorId: string;
  sourceId: string;
  baseline: { rowCount: number; health: CollectorHealthReport };
  current: { rowCount: number; health: CollectorHealthReport };
  comparison: DistributionalHealthComparison;
  diagnosis: HealDiagnosis;
  lastKnownGoodRetained: true;
  brokenRunCommitted: false;
  approvalRequired: true;
  brightDataCalls: 0;
}

const snapshot = (health: CollectorHealthReport) => ({
  recordCount: health.recordCount,
  fieldCoverage: health.fieldCoverage,
  distributions: health.distributions,
});

export function buildHealthDemoEvidence(input: {
  baselineRows: RawJobRow[];
  currentRows: RawJobRow[];
  collectorId: string;
  sourceId: string;
  contract: CollectorHealthContract;
}): HealthDemoEvidence {
  const baselineHealth = assessCollectorRows(input.baselineRows, input.contract);
  const currentHealth = assessCollectorRows(input.currentRows, input.contract);
  const comparison = compareDistributionalHealth(snapshot(currentHealth), snapshot(baselineHealth));
  const diagnosis = buildHealDiagnosis({
    collectorId: input.collectorId,
    sourceId: input.sourceId,
    baseline: snapshot(baselineHealth),
    current: snapshot(currentHealth),
  });

  return {
    demo: "fault_injection",
    simulated: true,
    collectorId: input.collectorId,
    sourceId: input.sourceId,
    baseline: { rowCount: input.baselineRows.length, health: baselineHealth },
    current: { rowCount: input.currentRows.length, health: currentHealth },
    comparison,
    diagnosis,
    lastKnownGoodRetained: true,
    brokenRunCommitted: false,
    approvalRequired: true,
    brightDataCalls: 0,
  };
}

export async function writeHealthDemoEvidence(outputPath = process.env.APPLYSIGNAL_DEMO_OUTPUT ?? "artifacts/applysignal-health-demo.json"): Promise<HealthDemoEvidence> {
  const fixture = await loadControlledFixture("layout-a");
  const currentRows = fixture.rows.slice(0, 4).map((row, index) => index === 0 ? { ...row, location: undefined } : row);
  const evidence = buildHealthDemoEvidence({
    baselineRows: fixture.rows,
    currentRows,
    collectorId: "fixture-controlled-career-site",
    sourceId: "demo-controlled",
    contract: {
      minimumRows: 6,
      requiredFields: ["source_job_id", "title", "location", "url"],
      identityField: "source_job_id",
      expectedHost: "fixture.applysignal.test",
    },
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, JSON.stringify(evidence, null, 2) + "\n");
  return evidence;
}

if (import.meta.main) {
  const evidence = await writeHealthDemoEvidence();
  console.log(JSON.stringify({ output: process.env.APPLYSIGNAL_DEMO_OUTPUT ?? "artifacts/applysignal-health-demo.json", ...evidence }, null, 2));
}
