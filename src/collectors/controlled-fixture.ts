import { readFile } from "node:fs/promises";
import type { RawJobRow } from "../domain/observations";

export type ControlledFixtureLayout = "layout-a" | "layout-b";

export interface ControlledFixtureApplicationField {
  field_label: string;
  normalized_category: string;
  is_required: boolean | null;
}

export interface ControlledFixtureResult {
  layoutId: ControlledFixtureLayout;
  layoutLabel: string;
  rows: RawJobRow[];
  applicationFields: Record<string, ControlledFixtureApplicationField[]>;
}

const fixtureUrl = new URL("./fixtures/controlled-career-site.json", import.meta.url);

const asText = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;

const canonicalizeSemanticOpening = (opening: Record<string, unknown>): RawJobRow => ({
  source_job_id: asText(opening.reference),
  title: asText(opening.role),
  location: Array.isArray(opening.place) ? opening.place.filter((value): value is string => typeof value === "string").join(" · ") : asText(opening.place),
  employment_type: asText(opening.type),
  posted_date: asText(opening.source_date),
  description: asText(opening.summary),
  url: asText(opening.detail),
  application_url: asText(opening.apply),
});

export async function loadControlledFixture(layoutId: ControlledFixtureLayout): Promise<ControlledFixtureResult> {
  const document = JSON.parse(await readFile(fixtureUrl, "utf8")) as {
    layouts: Record<string, { label: string; jobs?: RawJobRow[]; openings?: Record<string, unknown>[] }>;
    application_fields?: Record<string, ControlledFixtureApplicationField[]>;
  };
  const layout = document.layouts[layoutId];
  if (!layout) throw new Error(`unknown controlled fixture layout: ${layoutId}`);
  const rows = layout.jobs ?? (layout.openings ?? []).map(canonicalizeSemanticOpening);
  return {
    layoutId,
    layoutLabel: layout.label,
    rows,
    applicationFields: document.application_fields ?? {},
  };
}
