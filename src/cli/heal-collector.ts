import type { Database } from "bun:sqlite";
import { createDatabase } from "../storage/database";
import { markLatestHealEvent, saveHealEvent } from "../storage/repository";

export interface HealCommandRequest {
  collectorId: string;
  prompt: string;
  targetUrl?: string;
  timeoutSeconds?: number;
}

export interface ApproveCommandRequest {
  collectorId: string;
  targetUrl?: string;
  timeoutSeconds?: number;
}

export interface HealOutput {
  collectorId: string;
  status: string;
  nextStep: string | null;
  raw: Record<string, unknown>;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (args: string[]) => Promise<CommandResult>;

export function buildHealArgs(request: HealCommandRequest): string[] {
  const args = ["scraper", "heal", request.collectorId, request.prompt];
  if (request.targetUrl) args.push("--url", request.targetUrl);
  if (request.timeoutSeconds !== undefined) args.push("--timeout", String(request.timeoutSeconds));
  args.push("--json");
  return args;
}

export function buildApproveArgs(request: ApproveCommandRequest): string[] {
  const args = ["scraper", "approve", request.collectorId];
  if (request.targetUrl) args.push("--url", request.targetUrl);
  if (request.timeoutSeconds !== undefined) args.push("--timeout", String(request.timeoutSeconds));
  args.push("--json");
  return args;
}

export function parseHealOutput(output: string): HealOutput {
  const raw = JSON.parse(output) as Record<string, unknown>;
  return {
    collectorId: String(raw.collector_id ?? ""),
    status: String(raw.status ?? "unknown"),
    nextStep: typeof raw.next_step === "string" ? raw.next_step : null,
    raw,
  };
}

const runBrightDataCommand: CommandRunner = async (args) => {
  const child = Bun.spawn(["brightdata", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stdout, stderr };
};

export interface HealPreviewRequest extends HealCommandRequest {
  db: Database;
  sourceId: string;
  failedRunId: string;
  reason: string;
}

export async function runHealPreview(request: HealPreviewRequest, runner: CommandRunner = runBrightDataCommand): Promise<HealOutput> {
  const command = await runner(buildHealArgs(request));
  if (command.exitCode !== 0) throw new Error(command.stderr || `Bright Data heal exited with ${command.exitCode}`);
  const output = parseHealOutput(command.stdout);
  saveHealEvent(request.db, {
    sourceId: request.sourceId,
    collectorId: request.collectorId,
    failedRunId: request.failedRunId,
    reason: request.reason,
    generatedPrompt: request.prompt,
    previewResult: output.raw,
    previewHealth: null,
    approved: null,
    repairedRunId: null,
  });
  return output;
}

export interface HealApprovalRequest extends ApproveCommandRequest {
  db: Database;
  sourceId: string;
  failedRunId: string;
}

export async function approveHeal(request: HealApprovalRequest, runner: CommandRunner = runBrightDataCommand): Promise<HealOutput> {
  const command = await runner(buildApproveArgs(request));
  if (command.exitCode !== 0) throw new Error(command.stderr || `Bright Data approval exited with ${command.exitCode}`);
  const output = parseHealOutput(command.stdout);
  if (!["approved", "completed", "done", "success"].includes(output.status.toLowerCase())) throw new Error(`Bright Data approval did not complete: ${output.status}`);
  markLatestHealEvent(request.db, { sourceId: request.sourceId, collectorId: request.collectorId, failedRunId: request.failedRunId, approved: true, repairedRunId: null });
  return output;
}

if (import.meta.main) {
  const env = process.env;
  const collectorId = env.BRIGHTDATA_COLLECTOR_ID;
  const sourceId = env.BRIGHTDATA_SOURCE_ID;
  const failedRunId = env.APPLYSIGNAL_FAILED_RUN_ID;
  const prompt = env.APPLYSIGNAL_HEAL_PROMPT;
  const reason = env.APPLYSIGNAL_HEAL_REASON ?? "operator-requested healing";
  if (!collectorId || !sourceId || !failedRunId || !prompt) throw new Error("BRIGHTDATA_COLLECTOR_ID, BRIGHTDATA_SOURCE_ID, APPLYSIGNAL_FAILED_RUN_ID, and APPLYSIGNAL_HEAL_PROMPT are required");
  const timeoutSeconds = Number(env.APPLYSIGNAL_HEAL_TIMEOUT_SECONDS ?? "600");
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) throw new Error("APPLYSIGNAL_HEAL_TIMEOUT_SECONDS must be a positive integer");
  const db = createDatabase(env.APPLYSIGNAL_DB ?? "data/applysignal.db");
  try {
    const request = { db, sourceId, failedRunId, collectorId, prompt, reason, targetUrl: env.BRIGHTDATA_TARGET_URL, timeoutSeconds };
    if (env.APPLYSIGNAL_HEAL_ACTION === "approve") {
      if (env.APPLYSIGNAL_APPROVE_HEAL !== "true") throw new Error("Set APPLYSIGNAL_APPROVE_HEAL=true for explicit human approval");
      console.log(JSON.stringify(await approveHeal(request)));
    } else {
      console.log(JSON.stringify(await runHealPreview(request)));
    }
  } finally {
    db.close();
  }
}
