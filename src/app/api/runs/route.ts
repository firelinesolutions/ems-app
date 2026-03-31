import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { isDatabaseEnabled } from "@/lib/db";
import { dbGetOptions, dbGetRuns, dbInsertRun } from "@/lib/db-store";
import { readDb, writeDb } from "@/lib/store";
import type {
  AirwayAdjunctRecord,
  AirwayAdjunctType,
  ArrestWitnessing,
  MedicationRecord,
  OutcomeCategory,
  PatientAgeCategory,
  PatientDisposition,
  RunRecord,
  Shift,
  UsedItemInput,
  UsedItemRecord,
  VascularAccessRecord,
  VascularAccessType,
} from "@/lib/types";
import { supplyItemRequiresSize } from "@/lib/types";

type CreateRunPayload = {
  primaryResponseTerritoryId: string;
  stationId?: string;
  patientAge: number | null;
  runNumber?: string;
  imageTrendIncidentLink?: string;
  shift: Shift;
  callDateTime: string;
  patientDisposition: PatientDisposition | null;
  rosc: boolean;
  defibrillationGiven: boolean;
  defibrillationCount: number | null;
  airwayAdjuncts: AirwayAdjunctRecord[];
  vascularAccess: VascularAccessRecord[];
  resqPumpUsed: boolean;
  resqPodUsed: boolean;
  medicationsAdministered: MedicationRecord[];
  medicationOtherText?: string;
  incidentSummary?: string;
  qiIssuesIdentified: boolean;
  qiIssueSummary?: string;
  defibPadsAppliedTime?: string;
  compressionsStartedTime?: string;
  defibrillationTime?: string;
  zollRecordLink?: string;
  rhythmStripImageDataUrl?: string;
  outcomeCategory: OutcomeCategory;
  arrestWitnessing: ArrestWitnessing | null;
  patientAgeCategory: PatientAgeCategory | null;
  notes?: string; // legacy fallback
  itemsUsed: UsedItemInput[];
};

const airwayAdjunctTypes: AirwayAdjunctType[] = ["bvm", "npa", "opa", "i-gel", "ett"];
const vascularAccessTypes: VascularAccessType[] = ["iv", "io"];

export async function GET() {
  const db = isDatabaseEnabled() ? await dbReadCompat() : await readDb();
  const sortedRuns = [...db.runs]
    .map((run) => ({
      ...run,
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
    }))
    .sort((a, b) => b.callDateTime.localeCompare(a.callDateTime));
  return NextResponse.json({ runs: sortedRuns });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateRunPayload;
  const db = isDatabaseEnabled() ? await dbReadCompat() : await readDb();

  const effectiveStationId = payload.stationId || payload.primaryResponseTerritoryId;
  const station = db.stations.find((s) => s.id === effectiveStationId);
  if (!station) {
    return NextResponse.json({ error: "Invalid station." }, { status: 400 });
  }
  const primaryResponseTerritory = db.stations.find(
    (s) => s.id === payload.primaryResponseTerritoryId,
  );
  if (!primaryResponseTerritory) {
    return NextResponse.json(
      { error: "Invalid primary response territory." },
      { status: 400 },
    );
  }

  const incidentLink = payload.imageTrendIncidentLink?.trim() || "";
  const incidentIdFromLink = /Incident(\d+)/.exec(incidentLink)?.[1] || /#\/Incident(\d+)\//.exec(incidentLink)?.[1] || "";
  const runNumber = payload.runNumber?.trim() || incidentIdFromLink;
  if (!incidentLink || !incidentIdFromLink || !runNumber) {
    return NextResponse.json(
      { error: "ImageTrend incident link is required (must contain Incident#######)." },
      { status: 400 },
    );
  }

  if (!payload.callDateTime) {
    return NextResponse.json(
      { error: "Call date/time is required." },
      { status: 400 },
    );
  }
  if (payload.patientAge !== null && (!Number.isFinite(payload.patientAge) || payload.patientAge < 0)) {
    return NextResponse.json(
      { error: "Patient age must be a valid non-negative number." },
      { status: 400 },
    );
  }
  if (
    payload.defibrillationGiven &&
    (!Number.isFinite(payload.defibrillationCount) || (payload.defibrillationCount as number) < 1)
  ) {
    return NextResponse.json(
      { error: "Enter number of defibrillations when defibrillation is marked Yes." },
      { status: 400 },
    );
  }

  for (const line of payload.itemsUsed || []) {
    const catalogItem = db.items.find((catalog) => catalog.id === line.itemId);
    if (!catalogItem) continue;
    if (supplyItemRequiresSize(catalogItem.id)) {
      const size = typeof line.size === "string" ? line.size.trim() : "";
      if (!size) {
        return NextResponse.json(
          { error: `Size is required for ${catalogItem.name}.` },
          { status: 400 },
        );
      }
    }
  }

  const itemsUsed: UsedItemRecord[] = (payload.itemsUsed || [])
    .map((item) => {
      const catalogItem = db.items.find((catalog) => catalog.id === item.itemId);
      if (!catalogItem || !Number.isFinite(item.quantity) || item.quantity < 1) {
        return null;
      }

      const size =
        typeof item.size === "string" ? item.size.trim() : "";
      if (supplyItemRequiresSize(catalogItem.id) && !size) {
        return null;
      }

      const record: UsedItemRecord = {
        itemId: catalogItem.id,
        itemName: catalogItem.name,
        quantity: Math.floor(item.quantity),
      };
      if (size) {
        record.size = size;
      }
      return record;
    })
    .filter((item): item is UsedItemRecord => item !== null);
  const parsedPatientAge =
    payload.patientAge !== null && Number.isFinite(payload.patientAge)
      ? Math.floor(payload.patientAge)
      : null;
  const parsedDefibrillationCount =
    payload.defibrillationGiven && Number.isFinite(payload.defibrillationCount)
      ? Math.floor(payload.defibrillationCount as number)
      : null;
  const airwayAdjuncts: AirwayAdjunctRecord[] = (payload.airwayAdjuncts || [])
    .filter((entry) => airwayAdjunctTypes.includes(entry.type))
    .map((entry) => ({
      type: entry.type,
      size: entry.type !== "bvm" ? (entry.size?.trim() || "") : undefined,
    }));
  if (airwayAdjuncts.some((entry) => entry.type !== "bvm" && !entry.size)) {
    return NextResponse.json(
      { error: "Size is required for airway adjuncts except BVM." },
      { status: 400 },
    );
  }
  const vascularAccess: VascularAccessRecord[] = (payload.vascularAccess || [])
    .filter((entry) => vascularAccessTypes.includes(entry.type))
    .map((entry) => ({
      type: entry.type,
      location: (entry.location || "").trim(),
      size: (entry.size || "").trim(),
    }))
    .filter((entry) => entry.location && entry.size);
  const medicationsAdministered: MedicationRecord[] = (payload.medicationsAdministered || [])
    .filter((entry) => entry.medicationId && entry.medicationName)
    .map((entry) => ({
      medicationId: entry.medicationId,
      medicationName: entry.medicationName,
      amount: (entry.amount || "").trim(),
      administrations: Number.isFinite(entry.administrations)
        ? Math.floor(entry.administrations)
        : 0,
    }))
    .filter((entry) => entry.amount && entry.administrations > 0);

  const newRun = {
    id: randomUUID(),
    primaryResponseTerritoryId: primaryResponseTerritory.id,
    primaryResponseTerritoryName: primaryResponseTerritory.name,
    stationId: station.id,
    stationName: station.name,
    patientAge: parsedPatientAge,
    runNumber,
    imageTrendIncidentLink: incidentLink,
    shift: payload.shift || "A",
    callDateTime: payload.callDateTime,
    patientDisposition:
      payload.patientDisposition === "transport" ||
      payload.patientDisposition === "rosc-transport" ||
      payload.patientDisposition === "ceased-efforts"
        ? payload.patientDisposition
        : null,
    rosc: Boolean(payload.rosc),
    defibrillationGiven: Boolean(payload.defibrillationGiven),
    defibrillationCount: parsedDefibrillationCount,
    airwayAdjuncts,
    vascularAccess,
    resqPumpUsed: Boolean(payload.resqPumpUsed),
    resqPodUsed: Boolean(payload.resqPodUsed),
    medicationsAdministered,
    medicationOtherText: payload.medicationOtherText?.trim() || "",
    incidentSummary: payload.incidentSummary?.trim() || payload.notes?.trim() || "",
    qiIssuesIdentified: Boolean(payload.qiIssuesIdentified),
    qiIssueSummary: payload.qiIssueSummary?.trim() || "",
    defibPadsAppliedTime: payload.defibPadsAppliedTime?.trim() || "",
    compressionsStartedTime: payload.compressionsStartedTime?.trim() || "",
    defibrillationTime: payload.defibrillationTime?.trim() || "",
    zollRecordLink: payload.zollRecordLink?.trim() || "",
    rhythmStripImageDataUrl: payload.rhythmStripImageDataUrl?.trim() || "",
    outcomeCategory: payload.outcomeCategory || "needs-improvement",
    arrestWitnessing:
      payload.arrestWitnessing === "witnessed" ||
      payload.arrestWitnessing === "unwitnessed"
        ? payload.arrestWitnessing
        : null,
    patientAgeCategory:
      payload.patientAgeCategory === "adult" ||
      payload.patientAgeCategory === "pediatric"
        ? payload.patientAgeCategory
        : null,
    notes: payload.incidentSummary?.trim() || payload.notes?.trim() || "",
    itemsUsed,
    createdAt: new Date().toISOString(),
  };

  db.runs.push(newRun);
  if (isDatabaseEnabled()) {
    await dbInsertRun(newRun as unknown as RunRecord);
  } else {
    await writeDb(db);
  }

  return NextResponse.json({ run: newRun }, { status: 201 });
}

async function dbReadCompat() {
  // When database is enabled, stations/items are normalized; runs are stored as JSON.
  const { stations, items } = await dbGetOptions();
  const runs = await dbGetRuns();
  return { stations, items, runs };
}
