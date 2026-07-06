import { NextResponse } from "next/server";

import { buildRunFromPayload, type CreateRunPayload } from "@/lib/build-run-from-payload";
import { isDatabaseEnabled } from "@/lib/db";
import { dbGetOptions, dbGetRuns, dbInsertRun } from "@/lib/db-store";
import { readDb, writeDb } from "@/lib/store";

export async function GET() {
  const db = isDatabaseEnabled() ? await dbReadCompat() : await readDb();
  const sortedRuns = [...db.runs]
    .map((run) => ({
      ...run,
      runType: run.runType === "trauma" ? "trauma" : "cardiac-arrest",
      primaryResponseTerritoryId: run.primaryResponseTerritoryId ?? run.stationId,
      primaryResponseTerritoryName: run.primaryResponseTerritoryName ?? run.stationName,
      patientAge: Number.isFinite(run.patientAge) ? run.patientAge : null,
      patientDisposition: run.patientDisposition ?? null,
      defibrillationGiven: Boolean(run.defibrillationGiven),
      defibrillationCount:
        Number.isFinite(run.defibrillationCount) && (run.defibrillationCount as number) >= 0
          ? run.defibrillationCount
          : null,
      airwayAdjuncts: Array.isArray(run.airwayAdjuncts)
        ? run.airwayAdjuncts.map((entry) => ({
            type: entry.type,
            size: entry.type !== "bvm" ? (entry.size ?? "") : undefined,
          }))
        : [],
      vascularAccess: Array.isArray(run.vascularAccess) ? run.vascularAccess : [],
      resqPumpUsed: Boolean(run.resqPumpUsed),
      resqPodUsed: Boolean(run.resqPodUsed),
      medicationsAdministered: Array.isArray(run.medicationsAdministered)
        ? run.medicationsAdministered.map((entry) => ({
            medicationId: entry.medicationId,
            medicationName: entry.medicationName,
            amount:
              typeof entry.amount === "string" && entry.amount.trim()
                ? entry.amount.trim()
                : Number.isFinite((entry as unknown as { quantity?: number }).quantity)
                  ? String((entry as unknown as { quantity: number }).quantity)
                  : "",
            administrations: Number.isFinite(entry.administrations)
              ? entry.administrations
              : 1,
          }))
        : [],
      medicationOtherText: run.medicationOtherText ?? "",
      incidentSummary: run.incidentSummary ?? run.notes ?? "",
      imageTrendIncidentLink: run.imageTrendIncidentLink ?? "",
      qiIssuesIdentified: Boolean(run.qiIssuesIdentified),
      qiIssueSummary: run.qiIssueSummary ?? "",
      defibPadsAppliedTime: run.defibPadsAppliedTime ?? "",
      compressionsStartedTime: run.compressionsStartedTime ?? "",
      defibrillationTime: run.defibrillationTime ?? "",
      zollRecordLink: run.zollRecordLink ?? "",
      rhythmStripImageDataUrl: run.rhythmStripImageDataUrl ?? "",
      outcomeCategory: run.outcomeCategory || "needs-improvement",
      arrestWitnessing: run.arrestWitnessing ?? null,
      patientAgeCategory:
        run.patientAgeCategory === "adult" || run.patientAgeCategory === "pediatric"
          ? run.patientAgeCategory
          : null,
      traumaCenterCriteriaSelected:
        typeof run.traumaCenterCriteriaSelected === "boolean" ? run.traumaCenterCriteriaSelected : null,
      traumaTriageCriteriaSelected:
        typeof run.traumaTriageCriteriaSelected === "boolean" ? run.traumaTriageCriteriaSelected : null,
      traumaMedicationsText: run.traumaMedicationsText ?? "",
      traumaProcedures: Array.isArray(run.traumaProcedures)
        ? run.traumaProcedures
            .filter((entry) => entry.procedureId && entry.procedureName)
            .map((entry) => ({
              procedureId: entry.procedureId,
              procedureName: entry.procedureName,
            }))
        : [],
      traumaProcedureOtherText: run.traumaProcedureOtherText ?? "",
      traumaProceduresText: run.traumaProceduresText ?? "",
    }))
    .sort((a, b) => b.callDateTime.localeCompare(a.callDateTime));
  return NextResponse.json({ runs: sortedRuns });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateRunPayload;
  const db = isDatabaseEnabled() ? await dbReadCompat() : await readDb();

  const result = buildRunFromPayload(payload, db);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (isDatabaseEnabled()) {
    await dbInsertRun(result.run);
  } else {
    db.runs.push(result.run);
    await writeDb(db);
  }

  return NextResponse.json({ run: result.run }, { status: 201 });
}

async function dbReadCompat() {
  const { stations, items } = await dbGetOptions();
  const runs = await dbGetRuns();
  return { stations, items, runs };
}
