import { randomUUID } from "node:crypto";

import type {
  AirwayAdjunctRecord,
  AirwayAdjunctType,
  ArrestWitnessing,
  EMSDatabase,
  MedicationRecord,
  OutcomeCategory,
  PatientAgeCategory,
  PatientDisposition,
  ProcedureRecord,
  RunRecord,
  RunType,
  Shift,
  UsedItemInput,
  UsedItemRecord,
  VascularAccessRecord,
  VascularAccessType,
} from "@/lib/types";
import { supplyItemRequiresSize } from "@/lib/types";

export type CreateRunPayload = {
  runType?: RunType;
  primaryResponseTerritoryId: string;
  stationId?: string;
  patientAge: number | null;
  runNumber?: string;
  imageTrendIncidentLink?: string;
  shift: Shift;
  callDateTime: string;
  traumaCenterCriteriaSelected?: boolean | null;
  traumaTriageCriteriaSelected?: boolean | null;
  traumaMedicationsText?: string;
  traumaProcedures?: ProcedureRecord[];
  traumaProcedureOtherText?: string;
  traumaProceduresText?: string;
  patientDisposition?: PatientDisposition | null;
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
  notes?: string;
  itemsUsed: UsedItemInput[];
};

type BuildRunResult =
  | { ok: true; run: RunRecord }
  | { ok: false; error: string; status: number };

const airwayAdjunctTypes: AirwayAdjunctType[] = ["bvm", "npa", "opa", "i-gel", "ett"];
const vascularAccessTypes: VascularAccessType[] = ["iv", "io"];

export function buildRunFromPayload(
  payload: CreateRunPayload,
  db: EMSDatabase,
  existingRun?: RunRecord,
): BuildRunResult {
  const effectiveStationId = payload.stationId || payload.primaryResponseTerritoryId;
  const station = db.stations.find((s) => s.id === effectiveStationId);
  if (!station) {
    return { ok: false, error: "Invalid station.", status: 400 };
  }
  const primaryResponseTerritory = db.stations.find(
    (s) => s.id === payload.primaryResponseTerritoryId,
  );
  if (!primaryResponseTerritory) {
    return { ok: false, error: "Invalid primary response territory.", status: 400 };
  }

  const incidentLink = payload.imageTrendIncidentLink?.trim() || "";
  const incidentIdFromLink =
    /Incident(\d+)/.exec(incidentLink)?.[1] ||
    /#\/Incident(\d+)\//.exec(incidentLink)?.[1] ||
    "";
  const runNumber = payload.runNumber?.trim() || incidentIdFromLink;
  if (!incidentLink || !incidentIdFromLink || !runNumber) {
    return {
      ok: false,
      error: "ImageTrend incident link is required (must contain Incident#######).",
      status: 400,
    };
  }

  if (!payload.callDateTime) {
    return { ok: false, error: "Call date/time is required.", status: 400 };
  }
  if (payload.patientAge !== null && (!Number.isFinite(payload.patientAge) || payload.patientAge < 0)) {
    return { ok: false, error: "Patient age must be a valid non-negative number.", status: 400 };
  }

  const parsedPatientAge =
    payload.patientAge !== null && Number.isFinite(payload.patientAge)
      ? Math.floor(payload.patientAge)
      : null;

  const runId = existingRun?.id ?? randomUUID();
  const createdAt = existingRun?.createdAt ?? new Date().toISOString();

  if (payload.runType === "trauma") {
    const traumaVascularAccess: VascularAccessRecord[] = (payload.vascularAccess || [])
      .filter((entry) => vascularAccessTypes.includes(entry.type))
      .map((entry) => ({
        type: entry.type,
        location: (entry.location || "").trim(),
        size: (entry.size || "").trim(),
      }))
      .filter((entry) => entry.location && entry.size);

    const traumaMedicationsAdministered: MedicationRecord[] = (payload.medicationsAdministered || [])
      .filter((entry) => entry.medicationId && entry.medicationName)
      .map((entry) => ({
        medicationId: entry.medicationId,
        medicationName: entry.medicationName,
        amount: (entry.amount || "").trim(),
        administrations:
          Number.isFinite(entry.administrations) && entry.administrations > 0
            ? Math.floor(entry.administrations)
            : 1,
      }))
      .filter((entry) => entry.amount);

    const traumaProcedures: ProcedureRecord[] = (payload.traumaProcedures || [])
      .filter((entry) => entry.procedureId && entry.procedureName)
      .map((entry) => ({
        procedureId: entry.procedureId,
        procedureName: entry.procedureName,
      }));

    const run: RunRecord = {
      id: runId,
      runType: "trauma",
      primaryResponseTerritoryId: primaryResponseTerritory.id,
      primaryResponseTerritoryName: primaryResponseTerritory.name,
      stationId: station.id,
      stationName: station.name,
      patientAge: parsedPatientAge,
      runNumber,
      imageTrendIncidentLink: incidentLink,
      shift: payload.shift || "A",
      callDateTime: payload.callDateTime,
      traumaCenterCriteriaSelected:
        typeof payload.traumaCenterCriteriaSelected === "boolean"
          ? payload.traumaCenterCriteriaSelected
          : null,
      traumaTriageCriteriaSelected:
        typeof payload.traumaTriageCriteriaSelected === "boolean"
          ? payload.traumaTriageCriteriaSelected
          : null,
      traumaMedicationsText: payload.traumaMedicationsText?.trim() || "",
      traumaProcedures,
      traumaProcedureOtherText: payload.traumaProcedureOtherText?.trim() || "",
      traumaProceduresText: payload.traumaProceduresText?.trim() || "",
      patientDisposition: null,
      rosc: false,
      defibrillationGiven: false,
      defibrillationCount: null,
      airwayAdjuncts: [],
      vascularAccess: traumaVascularAccess,
      resqPumpUsed: false,
      resqPodUsed: false,
      medicationsAdministered: traumaMedicationsAdministered,
      medicationOtherText: payload.medicationOtherText?.trim() || "",
      incidentSummary: "",
      qiIssuesIdentified: false,
      qiIssueSummary: "",
      defibPadsAppliedTime: "",
      compressionsStartedTime: "",
      defibrillationTime: "",
      zollRecordLink: "",
      rhythmStripImageDataUrl: "",
      outcomeCategory: "needs-improvement",
      arrestWitnessing: null,
      patientAgeCategory: null,
      notes: "",
      itemsUsed: existingRun?.itemsUsed ?? [],
      createdAt,
    };

    return { ok: true, run };
  }

  if (
    payload.defibrillationGiven &&
    (!Number.isFinite(payload.defibrillationCount) || (payload.defibrillationCount as number) < 1)
  ) {
    return {
      ok: false,
      error: "Enter number of defibrillations when defibrillation is marked Yes.",
      status: 400,
    };
  }

  for (const line of payload.itemsUsed || []) {
    const catalogItem = db.items.find((catalog) => catalog.id === line.itemId);
    if (!catalogItem) continue;
    if (supplyItemRequiresSize(catalogItem.id)) {
      const size = typeof line.size === "string" ? line.size.trim() : "";
      if (!size) {
        return { ok: false, error: `Size is required for ${catalogItem.name}.`, status: 400 };
      }
    }
  }

  const itemsUsed: UsedItemRecord[] = (payload.itemsUsed || [])
    .map((item) => {
      const catalogItem = db.items.find((catalog) => catalog.id === item.itemId);
      if (!catalogItem || !Number.isFinite(item.quantity) || item.quantity < 1) {
        return null;
      }

      const size = typeof item.size === "string" ? item.size.trim() : "";
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

  const parsedDefibrillationCount =
    payload.defibrillationGiven && Number.isFinite(payload.defibrillationCount)
      ? Math.floor(payload.defibrillationCount as number)
      : null;

  const airwayAdjuncts: AirwayAdjunctRecord[] = (payload.airwayAdjuncts || [])
    .filter((entry) => airwayAdjunctTypes.includes(entry.type))
    .map((entry) => ({
      type: entry.type,
      size: entry.type !== "bvm" ? entry.size?.trim() || "" : undefined,
    }));

  if (airwayAdjuncts.some((entry) => entry.type !== "bvm" && !entry.size)) {
    return { ok: false, error: "Size is required for airway adjuncts except BVM.", status: 400 };
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

  const run: RunRecord = {
    id: runId,
    runType: "cardiac-arrest",
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
      payload.arrestWitnessing === "witnessed" || payload.arrestWitnessing === "unwitnessed"
        ? payload.arrestWitnessing
        : null,
    patientAgeCategory:
      payload.patientAgeCategory === "adult" || payload.patientAgeCategory === "pediatric"
        ? payload.patientAgeCategory
        : null,
    notes: payload.incidentSummary?.trim() || payload.notes?.trim() || "",
    itemsUsed,
    createdAt,
  };

  return { ok: true, run };
}
