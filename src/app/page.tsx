"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type {
  AirwayAdjunctType,
  ArrestWitnessing,
  MedicationRecord,
  OutcomeCategory,
  PatientAgeCategory,
  PatientDisposition,
  RunRecord,
  Shift,
  Station,
  VascularAccessRecord,
} from "@/lib/types";

type OptionsResponse = {
  stations: Station[];
};

type RunsResponse = {
  runs: RunRecord[];
};

type RoscFilter = "all" | "yes" | "no";
type Battalion = "b1" | "b2" | "b3" | "b4" | "b5";

/**
 * Extension points:
 * - Add/remove shifts here for both entry + reporting.
 * - Update arrest/age options here to render new checkboxes automatically.
 */
const shifts: Shift[] = ["A", "B", "C"];
const battalionOptions: Array<{ value: Battalion; label: string }> = [
  { value: "b1", label: "Battalion 1" },
  { value: "b2", label: "Battalion 2" },
  { value: "b3", label: "Battalion 3" },
  { value: "b4", label: "Battalion 4" },
  { value: "b5", label: "Battalion 5" },
];
const battalionStationIds: Record<Battalion, string[]> = {
  b1: ["st-1", "st-7", "st-9", "st-22", "st-27"],
  b2: ["st-2", "st-3", "st-4", "st-5", "st-19"],
  b3: ["st-12", "st-14", "st-15", "st-16", "st-20", "st-21"],
  b4: ["st-8", "st-18", "st-24", "st-26", "st-28"],
  b5: [],
};
const arrestWitnessOptions: Array<{ value: ArrestWitnessing; label: string }> = [
  { value: "witnessed", label: "Witnessed arrest" },
  { value: "unwitnessed", label: "Unwitnessed arrest" },
];
const patientAgeOptions: Array<{ value: PatientAgeCategory; label: string }> = [
  { value: "adult", label: "Adult" },
  { value: "pediatric", label: "Pediatric" },
];
const patientDispositionOptions: Array<{ value: PatientDisposition; label: string }> = [
  { value: "transport", label: "Transport" },
  { value: "rosc-transport", label: "ROSC-Transport" },
  { value: "ceased-efforts", label: "Ceased Efforts" },
];
const airwayAdjunctOptions: Array<{ value: AirwayAdjunctType; label: string }> = [
  { value: "bvm", label: "BVM" },
  { value: "npa", label: "NPA" },
  { value: "opa", label: "OPA" },
  { value: "i-gel", label: "I-Gel" },
  { value: "ett", label: "ETT" },
];
const medicationOptions: Array<{ id: string; name: string }> = [
  { id: "med-oxygen", name: "Oxygen" },
  { id: "med-normal-saline", name: "Normal Saline" },
  { id: "med-epi-1-10", name: "Epi 1:10" },
  { id: "med-naloxone", name: "Naloxone" },
  { id: "med-atropine", name: "Atropine" },
  { id: "med-amiodarone", name: "Amiodarone" },
  { id: "med-lidocaine", name: "Lidocaine" },
  { id: "med-magnesium", name: "Magnesium" },
  { id: "med-calcium", name: "Calcium" },
  { id: "med-sodium-bicarbonate", name: "Sodium Bicarbonate" },
];
// Branding: keep this app deployable for any agency.

/**
 * ImageTrend incident deep link.
 * Update this template to match your agency's ImageTrend URL pattern.
 * Use `{incident}` as the placeholder for the ImageTrend internal incident id (numeric).
 *
 * Example deep link (from your environment):
 * `https://cobbcounty.imagetrendelite.com/Elite/Organizationcobbcounty/Agencycobbcounty/EmsRunForm#/Incident1080507/Form103`
 */
const IMAGETREND_INCIDENT_URL_TEMPLATE =
  "https://cobbcounty.imagetrendelite.com/Elite/Organizationcobbcounty/Agencycobbcounty/EmsRunForm#/Incident{incident}/Form103";
/**
 * ImageTrend incident list/search page.
 * If you later discover a querystring key ImageTrend supports (ex: `searchText`),
 * set this template to include `{q}`.
 *
 * Example:
 * `.../IncidentList?startingFilter=ems&searchText={q}`
 */
const IMAGETREND_INCIDENT_LIST_URL_TEMPLATE =
  "https://cobbcounty.imagetrendelite.com/Elite/Organizationcobbcounty/Agencycobbcounty/RunForm/IncidentList?startingFilter=ems";

export default function Home() {
  // -------- App data --------
  const [stations, setStations] = useState<Station[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);

  // -------- Entry form state --------
  const [battalion, setBattalion] = useState<Battalion>("b1");
  const [primaryResponseTerritoryId, setPrimaryResponseTerritoryId] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [imageTrendIncidentLink, setImageTrendIncidentLink] = useState("");
  const [shift, setShift] = useState<Shift>("A");
  const [callDateTime, setCallDateTime] = useState("");
  const [patientDisposition, setPatientDisposition] = useState<PatientDisposition | null>(null);
  const [arrestWitnessing, setArrestWitnessing] = useState<ArrestWitnessing | null>(null);
  const [patientAgeCategory, setPatientAgeCategory] = useState<PatientAgeCategory | null>(null);
  const [rosc, setRosc] = useState(false);
  const [defibrillationGiven, setDefibrillationGiven] = useState(false);
  const [defibrillationCount, setDefibrillationCount] = useState("");
  const [airwayAdjuncts, setAirwayAdjuncts] = useState<Record<AirwayAdjunctType, boolean>>({
    bvm: false,
    npa: false,
    opa: false,
    "i-gel": false,
    ett: false,
  });
  const [airwayAdjunctSizes, setAirwayAdjunctSizes] = useState<Record<AirwayAdjunctType, string>>({
    bvm: "",
    npa: "",
    opa: "",
    "i-gel": "",
    ett: "",
  });
  const [vascularAccess, setVascularAccess] = useState<VascularAccessRecord[]>([]);
  const [accessTypeInput, setAccessTypeInput] = useState<"iv" | "io">("iv");
  const [accessLocationInput, setAccessLocationInput] = useState("");
  const [accessLocationOtherInput, setAccessLocationOtherInput] = useState("");
  const [accessSizeInput, setAccessSizeInput] = useState("");
  const [resqPumpUsed, setResqPumpUsed] = useState(false);
  const [resqPodUsed, setResqPodUsed] = useState(false);
  const [medicationsAdministered, setMedicationsAdministered] = useState<MedicationRecord[]>([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState(medicationOptions[0]?.id ?? "");
  const [selectedMedicationAmount, setSelectedMedicationAmount] = useState("");
  const [selectedMedicationAdministrations, setSelectedMedicationAdministrations] = useState(1);
  const [medicationOtherText, setMedicationOtherText] = useState("");
  const [incidentSummary, setIncidentSummary] = useState("");
  const [qiIssuesIdentified, setQiIssuesIdentified] = useState(false);
  const [qiIssueSummary, setQiIssueSummary] = useState("");
  const [defibPadsAppliedTime, setDefibPadsAppliedTime] = useState("");
  const [compressionsStartedTime, setCompressionsStartedTime] = useState("");
  const [defibrillationTime, setDefibrillationTime] = useState("");
  const [zollRecordLink, setZollRecordLink] = useState("");
  const [rhythmStripImageDataUrl, setRhythmStripImageDataUrl] = useState("");
  const [stationFilter, setStationFilter] = useState("all");
  const [battalionFilter, setBattalionFilter] = useState<"all" | Battalion>("all");
  const [roscFilter, setRoscFilter] = useState<RoscFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // -------- UI / request state --------
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [importProgressText, setImportProgressText] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notesRun, setNotesRun] = useState<RunRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [optionsRes, runsRes] = await Promise.all([
          fetch("/api/options"),
          fetch("/api/runs"),
        ]);

        if (!optionsRes.ok || !runsRes.ok) {
          throw new Error("Failed to load app data.");
        }

        const optionsJson = (await optionsRes.json()) as OptionsResponse;
        const runsJson = (await runsRes.json()) as RunsResponse;

        setStations(optionsJson.stations);
        setRuns(runsJson.runs);
        // Default battalion to B1 if those stations exist, otherwise fall back to first station.
        const allStations = optionsJson.stations;
        const b1First = battalionStationIds.b1.find((id) => allStations.some((s) => s.id === id));
        setBattalion("b1");
        setPrimaryResponseTerritoryId(b1First ?? allStations[0]?.id ?? "");
        setCallDateTime(toInputDateTime(new Date()));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!notesRun) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotesRun(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [notesRun]);

  useEffect(() => {
    if (!isExportMenuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExportMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExportMenuOpen]);

  useEffect(() => {
    // Reset dependent access fields when switching between IV and IO.
    setAccessLocationInput("");
    setAccessLocationOtherInput("");
    setAccessSizeInput("");
  }, [accessTypeInput]);

  const filteredRuns = useMemo(
    () =>
      runs.filter((run) => {
        const matchesBattalion =
          battalionFilter === "all" ||
          getBattalionForStationId(run.primaryResponseTerritoryId) === battalionFilter;
        const matchesStation = stationFilter === "all" || run.stationId === stationFilter;
        const matchesRosc =
          roscFilter === "all" || (roscFilter === "yes" ? run.rosc : !run.rosc);
        const runDate = new Date(run.callDateTime);
        const startBoundary = startDate ? new Date(`${startDate}T00:00:00`) : null;
        const endBoundary = endDate ? new Date(`${endDate}T23:59:59`) : null;
        const matchesStart = !startBoundary || runDate >= startBoundary;
        const matchesEnd = !endBoundary || runDate <= endBoundary;
        return matchesBattalion && matchesStation && matchesRosc && matchesStart && matchesEnd;
      }),
    [runs, battalionFilter, stationFilter, roscFilter, startDate, endDate],
  );

  const sortedRuns = useMemo(() => {
    const shiftOrder: Record<Shift, number> = { A: 0, B: 1, C: 2 };
    return [...filteredRuns].sort((a, b) => {
      const battalionA = battalionSortKey(getBattalionForStationId(a.primaryResponseTerritoryId));
      const battalionB = battalionSortKey(getBattalionForStationId(b.primaryResponseTerritoryId));
      if (battalionA !== battalionB) return battalionA - battalionB;

      const stationA = stationNumberFromId(a.primaryResponseTerritoryId);
      const stationB = stationNumberFromId(b.primaryResponseTerritoryId);
      if (stationA !== stationB) return stationA - stationB;

      const shiftA = shiftOrder[a.shift] ?? 99;
      const shiftB = shiftOrder[b.shift] ?? 99;
      if (shiftA !== shiftB) return shiftA - shiftB;

      // Within the same Battalion/Station/Shift group, show most recent first.
      return b.callDateTime.localeCompare(a.callDateTime);
    });
  }, [filteredRuns]);

  const roscCount = useMemo(
    () => filteredRuns.filter((run) => run.rosc).length,
    [filteredRuns],
  );
  const defibCount = useMemo(
    () => filteredRuns.filter((run) => run.defibrillationGiven).length,
    [filteredRuns],
  );
  const qiCount = useMemo(
    () => filteredRuns.filter((run) => run.qiIssuesIdentified).length,
    [filteredRuns],
  );
  const roscPercentageText = useMemo(() => {
    if (!filteredRuns.length) return "—";
    const pct = (roscCount / filteredRuns.length) * 100;
    const rounded = Math.round(pct * 10) / 10;
    return `${rounded}%`;
  }, [filteredRuns.length, roscCount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const incidentId = parseImageTrendIncidentId(imageTrendIncidentLink);
      if (!incidentId) {
        throw new Error("Paste a valid ImageTrend Incident Link (it must contain Incident#######).");
      }
      const needsAirwaySize = Object.entries(airwayAdjuncts).some(
        ([type, checked]) => checked && type !== "bvm" && !airwayAdjunctSizes[type as AirwayAdjunctType].trim(),
      );
      if (needsAirwaySize) {
        throw new Error("Size is required for airway adjuncts except BVM.");
      }
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryResponseTerritoryId,
          stationId: primaryResponseTerritoryId,
          patientAge: patientAge.trim() ? Number(patientAge) : null,
          runNumber: incidentId,
          imageTrendIncidentLink,
          shift,
          callDateTime,
          patientDisposition,
          rosc,
          defibrillationGiven,
          defibrillationCount: defibrillationCount.trim() ? Number(defibrillationCount) : null,
          airwayAdjuncts: Object.entries(airwayAdjuncts)
            .filter(([, checked]) => checked)
            .map(([type]) => ({
              type,
              size: type === "bvm" ? undefined : airwayAdjunctSizes[type as AirwayAdjunctType].trim(),
            })),
          vascularAccess,
          resqPumpUsed,
          resqPodUsed,
          medicationsAdministered,
          medicationOtherText,
          incidentSummary,
          qiIssuesIdentified,
          qiIssueSummary,
          defibPadsAppliedTime,
          compressionsStartedTime,
          defibrillationTime,
          zollRecordLink,
          rhythmStripImageDataUrl,
          outcomeCategory: "needs-improvement",
          arrestWitnessing,
          patientAgeCategory,
          notes: incidentSummary,
        }),
      });

      const json = (await response.json()) as { error?: string; run?: RunRecord };
      if (!response.ok || !json.run) {
        throw new Error(json.error || "Failed to save run.");
      }

      setRuns((prev) => [json.run!, ...prev]);
      setPrimaryResponseTerritoryId(stations[0]?.id ?? "");
      setPatientAge("");
      setImageTrendIncidentLink("");
      setShift("A");
      setPatientDisposition(null);
      setArrestWitnessing(null);
      setPatientAgeCategory(null);
      setRosc(false);
      setDefibrillationGiven(false);
      setDefibrillationCount("");
      setAirwayAdjuncts({ bvm: false, npa: false, opa: false, "i-gel": false, ett: false });
      setAirwayAdjunctSizes({ bvm: "", npa: "", opa: "", "i-gel": "", ett: "" });
      setVascularAccess([]);
      setAccessTypeInput("iv");
      setAccessLocationInput("");
      setAccessSizeInput("");
      setResqPumpUsed(false);
      setResqPodUsed(false);
      setMedicationsAdministered([]);
      setMedicationOtherText("");
      setIncidentSummary("");
      setQiIssuesIdentified(false);
      setQiIssueSummary("");
      setDefibPadsAppliedTime("");
      setCompressionsStartedTime("");
      setDefibrillationTime("");
      setZollRecordLink("");
      setRhythmStripImageDataUrl("");
      setCallDateTime(toInputDateTime(new Date()));
      setSuccess("Run saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save run.");
    } finally {
      setIsSaving(false);
    }
  }

  function toggleAirwayAdjunct(type: AirwayAdjunctType, checked: boolean) {
    setAirwayAdjuncts((prev) => ({ ...prev, [type]: checked }));
    if (!checked) {
      setAirwayAdjunctSizes((prev) => ({ ...prev, [type]: "" }));
    }
  }

  function addVascularAccess() {
    const location =
      accessTypeInput === "iv" && accessLocationInput === "other"
        ? accessLocationOtherInput.trim()
        : accessLocationInput.trim();
    const size = accessSizeInput.trim();
    if (!location || !size) {
      setError("Enter both vascular access location and size.");
      return;
    }
    setVascularAccess((prev) => [...prev, { type: accessTypeInput, location, size }]);
    setError("");
    setAccessLocationInput("");
    setAccessLocationOtherInput("");
    setAccessSizeInput("");
  }

  function removeVascularAccessAt(index: number) {
    setVascularAccess((prev) => prev.filter((_, i) => i !== index));
  }

  function addMedication() {
    const medication = medicationOptions.find((m) => m.id === selectedMedicationId);
    if (!medication || selectedMedicationAdministrations < 1 || !selectedMedicationAmount.trim()) return;
    setMedicationsAdministered((prev) => [
      ...prev,
      {
        medicationId: medication.id,
        medicationName: medication.name,
        amount: selectedMedicationAmount.trim(),
        administrations: selectedMedicationAdministrations,
      },
    ]);
    setSelectedMedicationAmount("");
    setSelectedMedicationAdministrations(1);
  }

  function removeMedicationAt(index: number) {
    setMedicationsAdministered((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImportCsvFile(file: File) {
    setError("");
    setSuccess("");
    setImportProgressText("");
    setIsImportingCsv(true);

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        throw new Error("CSV is empty (needs header row + at least 1 data row).");
      }
      const header = rows[0] ?? [];
      const dataRows = rows.slice(1).filter((r) => r.some((c) => (c ?? "").trim() !== ""));
      if (!dataRows.length) {
        throw new Error("No data rows found in CSV.");
      }

      const colIndex = buildHeaderIndex(header);
      let okCount = 0;
      let failCount = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] ?? [];
        setImportProgressText(`Importing row ${i + 1} of ${dataRows.length}…`);

        const incidentLink = getCsvCell(row, colIndex, [
          "imagetrend incident link",
          "imagetrend link",
          "incident link",
          "link",
        ]).trim();

        const stationValue = getCsvCell(row, colIndex, [
          "primary response territory",
          "primary territory",
          "station",
          "unit",
          "unit responding",
        ]).trim();

        const shiftValue = getCsvCell(row, colIndex, ["shift"]).trim().toUpperCase();
        const callDateTimeValue = getCsvCell(row, colIndex, ["call date/time", "call datetime", "call time", "date/time", "datetime"]).trim();

        // Required minimums.
        const incidentId = parseImageTrendIncidentId(incidentLink);
        const stationId = resolveStationIdFromCsvValue(stationValue, stations);
        const shiftParsed = shiftValue === "A" || shiftValue === "B" || shiftValue === "C" ? (shiftValue as Shift) : null;
        const callIso = parseCsvDateTimeToIso(callDateTimeValue);
        if (!incidentLink || !incidentId || !stationId || !shiftParsed || !callIso) {
          failCount++;
          continue;
        }

        const patientAgeRaw = getCsvCell(row, colIndex, ["patient age", "age"]).trim();
        const patientAgeParsed =
          patientAgeRaw && Number.isFinite(Number(patientAgeRaw)) ? Number(patientAgeRaw) : null;

        const roscValue = getCsvCell(row, colIndex, ["rosc", "rosc obtained"]).trim();
        const qiValue = getCsvCell(row, colIndex, ["qi", "qi case", "qi issues identified"]).trim();
        const defibGivenValue = getCsvCell(row, colIndex, ["defibrillation given", "defib given", "defib"]).trim();
        const defibCountValue = getCsvCell(row, colIndex, ["defibrillation count", "defib count", "shocks"]).trim();

        const body = {
          primaryResponseTerritoryId: stationId,
          stationId,
          patientAge: patientAgeParsed,
          runNumber: incidentId,
          imageTrendIncidentLink: incidentLink,
          shift: shiftParsed,
          callDateTime: callIso,
          patientDisposition: null,
          rosc: parseCsvBoolean(roscValue),
          defibrillationGiven: parseCsvBoolean(defibGivenValue),
          defibrillationCount: defibCountValue && Number.isFinite(Number(defibCountValue)) ? Number(defibCountValue) : null,
          airwayAdjuncts: [],
          vascularAccess: [],
          resqPumpUsed: false,
          resqPodUsed: false,
          medicationsAdministered: [],
          medicationOtherText: "",
          incidentSummary: "",
          qiIssuesIdentified: parseCsvBoolean(qiValue),
          qiIssueSummary: "",
          defibPadsAppliedTime: "",
          compressionsStartedTime: "",
          defibrillationTime: "",
          zollRecordLink: "",
          rhythmStripImageDataUrl: "",
          outcomeCategory: "needs-improvement" as const,
          arrestWitnessing: null,
          patientAgeCategory: null,
          notes: "",
          itemsUsed: [],
        };

        const response = await fetch("/api/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await response.json()) as { error?: string; run?: RunRecord };
        if (!response.ok || !json.run) {
          failCount++;
          continue;
        }
        okCount++;
        setRuns((prev) => [json.run!, ...prev]);
      }

      setSuccess(`Import finished. Imported=${okCount}, Skipped/Failed=${failCount}.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Failed to import CSV.");
    } finally {
      setIsImportingCsv(false);
      setImportProgressText("");
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  async function handleRhythmStripUpload(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setRhythmStripImageDataUrl(dataUrl);
  }

  function clearDashboardFilters() {
    setStationFilter("all");
    setBattalionFilter("all");
    setRoscFilter("all");
    setStartDate("");
    setEndDate("");
  }

  const stationsForSelectedBattalion = useMemo(() => {
    const all = stations;
    const explicitIds = battalionStationIds[battalion];
    const explicitSet = new Set(explicitIds);

    // Battalion 5 = any station not in battalions 1-4.
    if (battalion === "b5") {
      const b1to4 = new Set([
        ...battalionStationIds.b1,
        ...battalionStationIds.b2,
        ...battalionStationIds.b3,
        ...battalionStationIds.b4,
      ]);
      return all.filter((s) => !b1to4.has(s.id));
    }

    // Keep explicit list order as provided (so station dropdown is in a predictable order).
    return explicitIds
      .map((id) => all.find((s) => s.id === id))
      .filter((s): s is Station => Boolean(s))
      .concat(all.filter((s) => explicitSet.has(s.id) === false && false));
  }, [battalion, stations]);

  const stationsForBattalionFilter = useMemo(() => {
    if (battalionFilter === "all") return stations;
    if (battalionFilter === "b5") {
      const b1to4 = new Set([
        ...battalionStationIds.b1,
        ...battalionStationIds.b2,
        ...battalionStationIds.b3,
        ...battalionStationIds.b4,
      ]);
      return stations.filter((s) => !b1to4.has(s.id));
    }
    const ids = battalionStationIds[battalionFilter];
    return ids
      .map((id) => stations.find((s) => s.id === id))
      .filter((s): s is Station => Boolean(s));
  }, [battalionFilter, stations]);

  useEffect(() => {
    if (battalionFilter === "all") return;
    if (stationFilter === "all") return;
    const stillValid = stationsForBattalionFilter.some((s) => s.id === stationFilter);
    if (!stillValid) {
      setStationFilter("all");
    }
  }, [battalionFilter, stationFilter, stationsForBattalionFilter]);

  async function handleDeleteRun(run: RunRecord) {
    const label = `${run.primaryResponseTerritoryName} · Incident ${run.runNumber}`;
    if (!window.confirm(`Delete this run entry?\n\n${label}`)) {
      return;
    }

    setError("");
    setSuccess("");
    setDeletingId(run.id);

    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(run.id)}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error || "Failed to delete run.");
      }

      setRuns((prev) => prev.filter((r) => r.id !== run.id));
      setSuccess("Run deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete run.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExportPdf() {
    setError("");
    setSuccess("");
    setIsExportingPdf(true);

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const generatedAt = new Date();
      const stationLabel = stationFilter === "all"
        ? "All Stations"
        : stations.find((station) => station.id === stationFilter)?.name || stationFilter;
      const roscLabel = roscFilter === "all" ? "All" : roscFilter === "yes" ? "Yes" : "No";
      const dateLabel = startDate || endDate
        ? `${startDate || "Any"} to ${endDate || "Any"}`
        : "Any Date";

      doc.setFontSize(16);
      doc.text("EMS Cardiac Arrest QA Report", 40, 40);
      doc.setFontSize(10);
      doc.text(`Generated: ${generatedAt.toLocaleString()}`, 40, 60);
      doc.text(`Filters: Unit=${stationLabel} | ROSC=${roscLabel} | Date=${dateLabel}`, 40, 76);
      doc.text(
        `Summary: Total Arrests=${filteredRuns.length}, ROSC=${roscCount}, Pt's Defibrillated=${defibCount}, QI Cases=${qiCount}`,
        40,
        92,
      );
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(
        "Legend — Green: ROSC/Defibrillated | Yellow: No ROSC/No Defib | Red: QI Case",
        40,
        106,
      );
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      autoTable(doc, {
        startY: 118,
        styles: { fontSize: 8, cellPadding: 3, valign: "top", overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.2,
        margin: { left: 24, right: 24 },
        head: [
          [
            "Station / Shift",
            "ImageTrend Incident #",
            "Age",
            "Category",
            "Defibrillation",
            "ETT / I-Gel",
            "IV/IO Access",
            "RESQCPR",
            "Medications",
            "ISSUES / Notes",
            "ZOLL Link",
            "Start Monitor",
            "Start Hands",
            "Start Defib",
          ],
        ],
        body: filteredRuns.map((run) => [
          `${run.primaryResponseTerritoryName} / ${run.shift}`,
          run.runNumber,
          run.patientAge ?? "-",
          toOutcomeText(run.outcomeCategory),
          run.defibrillationGiven
            ? `Yes (${run.defibrillationCount ?? 0})`
            : "No",
          formatEttIGel(run.airwayAdjuncts),
          formatVascularAccess(run.vascularAccess),
          formatResqCpr(run.resqPumpUsed, run.resqPodUsed),
          formatMedications(run.medicationsAdministered),
          formatIssuesNotes(run.qiIssuesIdentified, run.qiIssueSummary, run.incidentSummary || run.notes),
          formatTextCell(run.zollRecordLink),
          formatTextCell(run.defibPadsAppliedTime),
          formatTextCell(run.compressionsStartedTime),
          formatTextCell(run.defibrillationTime),
        ]),
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 38 },
          2: { cellWidth: 20 },
          3: { cellWidth: 26 },
          4: { cellWidth: 34 },
          5: { cellWidth: 40 },
          6: { cellWidth: 30 },
          7: { cellWidth: 50 },
          8: { cellWidth: 86 },
          9: { cellWidth: 60 },
          10: { cellWidth: 64 },
          11: { cellWidth: 34 },
          12: { cellWidth: 34 },
          13: { cellWidth: 34 },
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const run = filteredRuns[data.row.index];
          if (!run) return;
          if (run.qiIssuesIdentified) {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [127, 29, 29];
            return;
          }
          if (run.rosc || run.defibrillationGiven) {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.textColor = [6, 78, 59];
            return;
          }
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        },
      });

      const filename = `ems-report-${toFileDate(generatedAt)}.pdf`;
      doc.save(filename);
      setSuccess("PDF report generated from current filters.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to generate PDF report.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  async function handleExportCsv() {
    setError("");
    setSuccess("");
    setIsExportingCsv(true);

    try {
      const headers = [
        "Station / Shift",
        "ImageTrend Incident #",
        "Age",
        "Outcome",
        "Defibrillation",
        "ETT / I-Gel",
        "IV / IO",
        "RESQCPR",
        "Medications",
        "ISSUES / Notes",
        "Zoll Online",
        "Start Monitor",
        "Start Hands",
        "Start Defib",
      ];

      const rows = filteredRuns.map((run) => [
        `${run.primaryResponseTerritoryName} / ${run.shift}`,
        run.runNumber,
        run.patientAge ?? "",
        toOutcomeText(run.outcomeCategory),
        run.defibrillationGiven ? `Yes (${run.defibrillationCount ?? 0})` : "No",
        formatEttIGel(run.airwayAdjuncts),
        formatVascularAccess(run.vascularAccess),
        formatResqCpr(run.resqPumpUsed, run.resqPodUsed),
        formatMedications(run.medicationsAdministered),
        formatIssuesNotes(
          run.qiIssuesIdentified,
          run.qiIssueSummary,
          run.incidentSummary || run.notes,
        ),
        run.zollRecordLink || "",
        run.defibPadsAppliedTime || "",
        run.compressionsStartedTime || "",
        run.defibrillationTime || "",
      ]);

      downloadCsv(
        `ems-report-${toFileDate(new Date())}.csv`,
        [headers, ...rows],
      );
      setSuccess("CSV exported from current filters.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  }

  if (isLoading) {
    return <main className="min-h-screen p-4 sm:p-6">Loading EMS app...</main>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-zinc-50 to-zinc-100 p-4 sm:p-6 text-zinc-900">
      <div className="mx-auto mb-4 sm:mb-6 w-full max-w-[min(100%,110rem)] rounded-2xl bg-slate-900 p-4 sm:p-5 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-200">Operations Dashboard</p>
              <h1 className="text-xl font-semibold md:text-2xl">EMS Cardiac Arrest QA</h1>
            </div>
          </div>
          <div className="w-full md:w-auto">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-6 md:text-sm">
                <div className="col-span-1 sm:col-span-2">
                  <StatChip label="Total Arrests" value={String(filteredRuns.length)} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <StatChip label="ROSC %" value={roscPercentageText} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <StatChip label="ROSC" value={String(roscCount)} />
                </div>
                <div className="col-span-1 sm:col-span-3">
                  <StatChip label="Pt's Defibrillated" value={String(defibCount)} />
                </div>
                <div className="col-span-1 sm:col-span-3">
                  <StatChip label="QI Cases" value={String(qiCount)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[min(100%,110rem)] gap-4 sm:gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-md lg:col-span-1">
          <h2 className="text-xl font-semibold">New EMS Run</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Manual entry by station, run number, shift, outcome category, ROSC, and items used.
          </p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <label className="block text-sm">
              Battalion
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                value={battalion}
                onChange={(e) => {
                  const next = e.target.value as Battalion;
                  setBattalion(next);
                  const nextStations =
                    next === "b5"
                      ? stationsForSelectedBattalion
                      : battalionStationIds[next]
                          .map((id) => stations.find((s) => s.id === id))
                          .filter((s): s is Station => Boolean(s));
                  setPrimaryResponseTerritoryId(nextStations[0]?.id ?? stations[0]?.id ?? "");
                }}
                required
              >
                {battalionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Primary Response Territory
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                value={primaryResponseTerritoryId}
                onChange={(e) => setPrimaryResponseTerritoryId(e.target.value)}
                required
              >
                {stationsForSelectedBattalion.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Shift
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                value={shift}
                onChange={(e) => setShift(e.target.value as Shift)}
              >
                {shifts.map((shiftOption) => (
                  <option key={shiftOption} value={shiftOption}>
                    {shiftOption}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              ImageTrend Incident Link
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                value={imageTrendIncidentLink}
                onChange={(e) => setImageTrendIncidentLink(e.target.value)}
                placeholder="Paste full ImageTrend incident link"
                required
              />
            </label>

            <label className="block text-sm">
              Call Date/Time
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                type="datetime-local"
                value={callDateTime}
                onChange={(e) => setCallDateTime(e.target.value)}
                required
              />
            </label>

            <label className="block text-sm">
              Patient Age
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                type="number"
                min={0}
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                placeholder="Example: 67"
              />
            </label>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium">Arrest witnessed?</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {arrestWitnessOptions.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={arrestWitnessing === option.value}
                      onChange={(e) =>
                        setArrestWitnessing(e.target.checked ? option.value : null)
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">Check one or leave both unchecked.</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium">Patient disposition</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {patientDispositionOptions.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={patientDisposition === option.value}
                      onChange={(e) => setPatientDisposition(e.target.checked ? option.value : null)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">Check one or leave all unchecked.</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium">Patient age group</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {patientAgeOptions.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={patientAgeCategory === option.value}
                      onChange={(e) =>
                        setPatientAgeCategory(e.target.checked ? option.value : null)
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">Check one or leave all unchecked.</p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rosc} onChange={(e) => setRosc(e.target.checked)} />
              ROSC achieved
            </label>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={defibrillationGiven}
                  onChange={(e) => setDefibrillationGiven(e.target.checked)}
                />
                Defibrillation given
              </label>
              {defibrillationGiven && (
                <label className="mt-2 block text-sm">
                  Number of defibrillations
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                    type="number"
                    min={1}
                    value={defibrillationCount}
                    onChange={(e) => setDefibrillationCount(e.target.value)}
                  />
                </label>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium">Airway adjunct</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {airwayAdjunctOptions.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={airwayAdjuncts[option.value]}
                      onChange={(e) => toggleAirwayAdjunct(option.value, e.target.checked)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {airwayAdjunctOptions
                  .filter((option) => option.value !== "bvm" && airwayAdjuncts[option.value])
                  .map((option) => (
                    <label key={`${option.value}-size`} className="block text-sm">
                      {option.label} size
                      <input
                        className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                        value={airwayAdjunctSizes[option.value]}
                        onChange={(e) =>
                          setAirwayAdjunctSizes((prev) => ({ ...prev, [option.value]: e.target.value }))
                        }
                        placeholder={option.value === "ett" ? "e.g. 7.5" : "Enter size"}
                      />
                    </label>
                  ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium">IV or IO access</p>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <select
                  className="rounded-lg border border-zinc-300 p-2 text-sm"
                  value={accessTypeInput}
                  onChange={(e) => setAccessTypeInput(e.target.value as "iv" | "io")}
                >
                  <option value="iv">IV</option>
                  <option value="io">IO</option>
                </select>
                <select
                  className="rounded-lg border border-zinc-300 p-2 text-sm"
                  value={accessLocationInput}
                  onChange={(e) => setAccessLocationInput(e.target.value)}
                >
                  <option value="">Location</option>
                  {accessTypeInput === "iv" ? (
                    <>
                      <option value="AC">AC</option>
                      <option value="Forearm">Forearm</option>
                      <option value="EJ">EJ</option>
                      <option value="Wrist">Wrist</option>
                      <option value="other">Other</option>
                    </>
                  ) : (
                    <>
                      <option value="Proximal Tibia">Proximal Tibia</option>
                      <option value="Distal Tibia">Distal Tibia</option>
                      <option value="Humerus">Humerus</option>
                    </>
                  )}
                </select>
                {accessTypeInput === "iv" && accessLocationInput === "other" ? (
                  <input
                    className="rounded-lg border border-zinc-300 p-2 text-sm"
                    value={accessLocationOtherInput}
                    onChange={(e) => setAccessLocationOtherInput(e.target.value)}
                    placeholder="Enter location"
                  />
                ) : (
                  <select
                    className="rounded-lg border border-zinc-300 p-2 text-sm"
                    value={accessSizeInput}
                    onChange={(e) => setAccessSizeInput(e.target.value)}
                  >
                    <option value="">Size</option>
                    {accessTypeInput === "iv" ? (
                      <>
                        <option value="16">16</option>
                        <option value="18">18</option>
                        <option value="20">20</option>
                        <option value="22">22</option>
                        <option value="24">24</option>
                      </>
                    ) : (
                      <>
                        <option value="25">25</option>
                        <option value="45">45</option>
                      </>
                    )}
                  </select>
                )}
                {accessTypeInput === "iv" && accessLocationInput === "other" ? (
                  <select
                    className="rounded-lg border border-zinc-300 p-2 text-sm"
                    value={accessSizeInput}
                    onChange={(e) => setAccessSizeInput(e.target.value)}
                  >
                    <option value="">IV Size</option>
                    <option value="16">16</option>
                    <option value="18">18</option>
                    <option value="20">20</option>
                    <option value="22">22</option>
                    <option value="24">24</option>
                  </select>
                ) : null}
                <button
                  className="rounded-lg bg-zinc-900 px-3 text-sm text-white"
                  type="button"
                  onClick={addVascularAccess}
                >
                  Add Access
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {vascularAccess.map((entry, index) => (
                  <li key={`${entry.type}-${entry.location}-${entry.size}-${index}`} className="flex justify-between gap-2">
                    <span>{entry.type.toUpperCase()} - {entry.location} ({entry.size})</span>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs hover:bg-zinc-100"
                      onClick={() => removeVascularAccessAt(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <input type="checkbox" checked={resqPumpUsed} onChange={(e) => setResqPumpUsed(e.target.checked)} />
                ResQ Pump used
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <input type="checkbox" checked={resqPodUsed} onChange={(e) => setResqPodUsed(e.target.checked)} />
                ResQ Pod used
              </label>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium">Medications administered</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  className="min-w-40 flex-1 rounded-lg border border-zinc-300 p-2 text-sm"
                  value={selectedMedicationId}
                  onChange={(e) => setSelectedMedicationId(e.target.value)}
                >
                  {medicationOptions.map((med) => (
                    <option key={med.id} value={med.id}>{med.name}</option>
                  ))}
                </select>
                <input
                  className="min-w-28 flex-1 rounded-lg border border-zinc-300 p-2 text-sm"
                  value={selectedMedicationAmount}
                  onChange={(e) => setSelectedMedicationAmount(e.target.value)}
                  placeholder="Amount (e.g. 1 mg)"
                />
                <input
                  className="w-24 rounded-lg border border-zinc-300 p-2 text-sm"
                  type="number"
                  min={1}
                  value={selectedMedicationAdministrations}
                  onChange={(e) => setSelectedMedicationAdministrations(Number(e.target.value))}
                  title="Number of administrations"
                />
                <button className="rounded-lg bg-zinc-900 px-3 text-sm text-white" type="button" onClick={addMedication}>
                  Add Med
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {medicationsAdministered.map((entry, index) => (
                  <li key={`${entry.medicationId}-${index}`} className="flex justify-between gap-2">
                    <span>{entry.medicationName}: {entry.amount} (x{entry.administrations})</span>
                    <button
                      type="button"
                      className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs hover:bg-zinc-100"
                      onClick={() => removeMedicationAt(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <label className="mt-2 block text-sm">
                Other medication/details
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                  value={medicationOtherText}
                  onChange={(e) => setMedicationOtherText(e.target.value)}
                  placeholder="Anything outside preset list"
                />
              </label>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium">Critical intervention times</p>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <label className="text-sm">
                  Time of defib pads applied
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                    type="time"
                    value={defibPadsAppliedTime}
                    onChange={(e) => setDefibPadsAppliedTime(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Time to compressions
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                    type="time"
                    value={compressionsStartedTime}
                    onChange={(e) => setCompressionsStartedTime(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Time to defibrillation
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                    type="time"
                    value={defibrillationTime}
                    onChange={(e) => setDefibrillationTime(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium">ZOLL record / rhythm strip</p>
              <label className="mt-2 block text-sm">
                ZOLL EKG record link
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                  type="url"
                  value={zollRecordLink}
                  onChange={(e) => setZollRecordLink(e.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label className="mt-2 block text-sm">
                Upload rhythm strip image
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleRhythmStripUpload(e.target.files?.[0] ?? null)}
                />
              </label>
              {rhythmStripImageDataUrl && (
                <img src={rhythmStripImageDataUrl} alt="Rhythm strip preview" className="mt-2 max-h-32 rounded border border-zinc-200" />
              )}
            </div>

            <label className="block text-sm">
              Written incident summary
              <textarea
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                rows={4}
                value={incidentSummary}
                onChange={(e) => setIncidentSummary(e.target.value)}
              />
            </label>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={qiIssuesIdentified}
                  onChange={(e) => setQiIssuesIdentified(e.target.checked)}
                />
                QI issues identified
              </label>
              {qiIssuesIdentified && (
                <label className="mt-2 block text-sm">
                  QI summary / referral details
                  <textarea
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                    rows={3}
                    value={qiIssueSummary}
                    onChange={(e) => setQiIssueSummary(e.target.value)}
                  />
                </label>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <button
              className="w-full rounded-lg bg-red-700 p-2.5 font-medium text-white shadow disabled:opacity-60"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Run"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-md lg:col-span-2">
          <h2 className="text-xl font-semibold">Unit Dashboard</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            <label className="text-sm text-zinc-700">
              Battalion Filter
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                value={battalionFilter}
                onChange={(e) => setBattalionFilter(e.target.value as "all" | Battalion)}
              >
                <option value="all">All Battalions</option>
                {battalionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-zinc-700">
              Unit Filter
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
              >
                <option value="all">All Units</option>
                {stationsForBattalionFilter.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-zinc-700">
              ROSC Filter
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                value={roscFilter}
                onChange={(e) => setRoscFilter(e.target.value as RoscFilter)}
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="text-sm text-zinc-700">
              Start Date
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label className="text-sm text-zinc-700">
              End Date
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>

            <div className="mt-4 flex flex-wrap items-end gap-2 xl:col-span-2 sm:flex-nowrap">
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) void handleImportCsvFile(file);
                }}
              />
              <button
                type="button"
                className="h-10 shrink-0 whitespace-nowrap rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700"
                onClick={clearDashboardFilters}
              >
                Clear Filters
              </button>
              <button
                type="button"
                className="h-10 shrink-0 whitespace-nowrap rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => importInputRef.current?.click()}
                disabled={isImportingCsv || isExportingPdf || isExportingCsv}
                title="Import runs from a CSV exported from Excel"
              >
                {isImportingCsv ? "Importing…" : "Import CSV"}
              </button>
              <div className="relative">
                <button
                  type="button"
                  className="h-10 shrink-0 whitespace-nowrap rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-60"
                  onClick={() => setIsExportMenuOpen((prev) => !prev)}
                  disabled={isExportingPdf || isExportingCsv}
                  aria-haspopup="menu"
                  aria-expanded={isExportMenuOpen}
                >
                  {isExportingPdf || isExportingCsv ? "Exporting…" : "Export"}
                </button>

                {isExportMenuOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    role="presentation"
                    onClick={() => setIsExportMenuOpen(false)}
                  >
                    <div
                      role="menu"
                      aria-label="Export options"
                      className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          void handleExportPdf();
                        }}
                      >
                        Export PDF
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          void handleExportCsv();
                        }}
                      >
                        Export CSV (Excel)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {importProgressText ? (
              <p className="mt-2 text-xs text-zinc-600">{importProgressText}</p>
            ) : null}
          </div>

          <div className="mt-4 w-full overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="p-2">Date/Time</th>
                  <th className="hidden p-2 sm:table-cell">Primary Territory</th>
                  <th className="p-2">ImageTrend Incident #</th>
                  <th className="hidden p-2 md:table-cell">Patient Age</th>
                  <th className="hidden p-2 md:table-cell">Shift</th>
                  <th className="hidden p-2 lg:table-cell">Witness</th>
                  <th className="hidden p-2 lg:table-cell">Age Group</th>
                  <th className="hidden p-2 sm:table-cell">Category</th>
                  <th className="p-2">ROSC</th>
                  <th className="hidden p-2 sm:table-cell">QI</th>
                  <th className="p-2 min-w-[9.5rem]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50/90"
                    onClick={() => setNotesRun(run)}
                  >
                    <td className="p-2">{new Date(run.callDateTime).toLocaleString()}</td>
                    <td className="hidden p-2 sm:table-cell">{run.primaryResponseTerritoryName}</td>
                    <td className="p-2" onClick={(event) => event.stopPropagation()}>
                      {getImageTrendHref(run.runNumber, run.imageTrendIncidentLink) ? (
                        <a
                          href={getImageTrendHref(run.runNumber, run.imageTrendIncidentLink)!}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
                          title="Open ImageTrend incident"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {getIncidentDisplayNumber(run.runNumber, run.imageTrendIncidentLink)}
                        </a>
                      ) : (
                        <span className="font-medium text-zinc-900">
                          {getIncidentDisplayNumber(run.runNumber, run.imageTrendIncidentLink)}
                        </span>
                      )}
                    </td>
                    <td className="hidden p-2 md:table-cell">{run.patientAge ?? "—"}</td>
                    <td className="hidden p-2 md:table-cell">{run.shift}</td>
                    <td className="hidden p-2 text-zinc-700 lg:table-cell">{formatWitnessDisplay(run.arrestWitnessing)}</td>
                    <td className="hidden p-2 text-zinc-700 lg:table-cell">{formatAgeDisplay(run.patientAgeCategory)}</td>
                    <td className="hidden p-2 sm:table-cell">
                      <Badge tone={toBadgeToneFromRun(run)}>{toCategoryTextFromRun(run)}</Badge>
                    </td>
                    <td className="p-2">
                      <span
                        className={
                          run.rosc
                            ? "rounded-md bg-emerald-100 px-2 py-1 text-emerald-700"
                            : "rounded-md bg-red-100 px-2 py-1 text-red-700"
                        }
                      >
                        {run.rosc ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="hidden p-2 sm:table-cell">
                      <span
                        className={
                          run.qiIssuesIdentified
                            ? "rounded-md bg-red-100 px-2 py-1 text-red-700"
                            : "rounded-md px-2 py-1 text-zinc-600"
                        }
                      >
                        {run.qiIssuesIdentified ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="p-2" onClick={(event) => event.stopPropagation()}>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                          onClick={() => setNotesRun(run)}
                        >
                          Notes
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                          disabled={deletingId === run.id}
                          onClick={() => void handleDeleteRun(run)}
                        >
                          {deletingId === run.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRuns.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-zinc-500" colSpan={13}>
                      No calls match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {notesRun && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setNotesRun(null)}
        >
          <div
            className="max-h-[min(80vh,28rem)] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="run-notes-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-zinc-100 px-4 py-3">
              <h3 id="run-notes-title" className="text-base font-semibold text-zinc-900">
                Incident details
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                {notesRun.primaryResponseTerritoryName} · Incident {notesRun.runNumber} ·{" "}
                {new Date(notesRun.callDateTime).toLocaleString()}
              </p>
            </div>
            <div className="max-h-[min(60vh,20rem)] space-y-4 overflow-y-auto px-4 py-3">
              <div className="text-sm">
                <p className="font-medium text-zinc-700">Arrest</p>
                <p className="mt-1 text-zinc-800">
                  Territory: {notesRun.primaryResponseTerritoryName} · Patient age:{" "}
                  {notesRun.patientAge ?? "—"}
                </p>
                <p className="mt-1 text-zinc-800">
                  Witness: {formatWitnessDisplay(notesRun.arrestWitnessing)} · Age:{" "}
                  {formatAgeDisplay(notesRun.patientAgeCategory)}
                </p>
                <p className="mt-1 text-zinc-800">
                  Disposition: {formatDispositionDisplay(notesRun.patientDisposition)} · Defib:{" "}
                  {notesRun.defibrillationGiven ? `Yes (${notesRun.defibrillationCount ?? 0})` : "No"}
                </p>
                <p className="mt-1 text-zinc-800">
                  ResQ Pump: {notesRun.resqPumpUsed ? "Yes" : "No"} · ResQ Pod:{" "}
                  {notesRun.resqPodUsed ? "Yes" : "No"}
                </p>
              </div>
              {notesRun.vascularAccess?.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium text-zinc-700">IV/IO access</p>
                  <ul className="mt-1 list-inside list-disc text-zinc-800">
                    {notesRun.vascularAccess.map((entry, idx) => (
                      <li key={`${entry.type}-${entry.location}-${entry.size}-${idx}`}>
                        {entry.type.toUpperCase()} - {entry.location} ({entry.size})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {notesRun.medicationsAdministered?.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium text-zinc-700">Medications</p>
                  <ul className="mt-1 list-inside list-disc text-zinc-800">
                    {notesRun.medicationsAdministered.map((med, idx) => (
                      <li key={`${med.medicationId}-${idx}`}>
                        {med.medicationName}: {med.amount} (x{med.administrations})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!notesRun.medicationOtherText && (
                <p className="text-sm text-zinc-800">
                  Other meds/details: {notesRun.medicationOtherText}
                </p>
              )}
              <div>
                <p className="text-sm font-medium text-zinc-700">Written incident summary</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                  {notesRun.incidentSummary?.trim()
                    ? notesRun.incidentSummary
                    : notesRun.notes?.trim()
                      ? notesRun.notes
                      : "No incident summary was recorded for this call."}
                </p>
              </div>
              {notesRun.qiIssuesIdentified && (
                <div>
                  <p className="text-sm font-medium text-zinc-700">QI issue summary</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                    {notesRun.qiIssueSummary || "QI issue flagged without summary."}
                  </p>
                </div>
              )}
              {!!notesRun.zollRecordLink && (
                <p className="text-sm">
                  <a href={notesRun.zollRecordLink} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                    Open ZOLL EKG record
                  </a>
                </p>
              )}
              {!!notesRun.rhythmStripImageDataUrl && (
                <img src={notesRun.rhythmStripImageDataUrl} alt="Rhythm strip" className="max-h-40 rounded border border-zinc-200" />
              )}
            </div>
            <div className="flex justify-end border-t border-zinc-100 px-4 py-3">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={() => setNotesRun(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function formatWitnessDisplay(value: ArrestWitnessing | null | undefined): string {
  if (value === "witnessed") return "Witnessed";
  if (value === "unwitnessed") return "Unwitnessed";
  return "—";
}

function formatAgeDisplay(value: PatientAgeCategory | null | undefined): string {
  if (value === "adult") return "Adult";
  if (value === "pediatric") return "Pediatric";
  return "—";
}

function formatDispositionDisplay(value: PatientDisposition | null | undefined): string {
  if (value === "transport") return "Transport";
  if (value === "rosc-transport") return "ROSC-Transport";
  if (value === "ceased-efforts") return "Ceased Efforts";
  return "—";
}

function formatTextCell(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || "—";
}

function formatYesNo(value: boolean | null | undefined): string {
  return value ? "Yes" : "No";
}

function formatAirwayAdjuncts(items: RunRecord["airwayAdjuncts"]): string {
  if (!items?.length) return "—";
  return items
    .map((item) => {
      const label = item.type === "i-gel" ? "I-Gel" : item.type.toUpperCase();
      return item.size ? `${label} (${item.size})` : label;
    })
    .join("; ");
}

function formatVascularAccess(items: RunRecord["vascularAccess"]): string {
  if (!items?.length) return "—";
  return items
    .map((item) => `${item.type.toUpperCase()} ${item.location} (${item.size})`)
    .join("; ");
}

function formatEttIGel(items: RunRecord["airwayAdjuncts"]): string {
  if (!items?.length) return "—";
  const filtered = items.filter((item) => item.type === "ett" || item.type === "i-gel");
  if (!filtered.length) return "—";
  return filtered
    .map((item) => `${item.type === "ett" ? "ETT" : "I-Gel"}${item.size ? ` (${item.size})` : ""}`)
    .join("; ");
}

function formatResqCpr(pumpUsed: boolean, podUsed: boolean): string {
  const parts = [];
  if (pumpUsed) parts.push("Pump");
  if (podUsed) parts.push("Pod");
  return parts.length ? parts.join(" + ") : "No";
}

function formatMedications(items: RunRecord["medicationsAdministered"]): string {
  if (!items?.length) return "—";
  return items
    .map((item) => {
      const amount =
        typeof item.amount === "string" && item.amount.trim()
          ? item.amount.trim()
          : Number.isFinite((item as unknown as { quantity?: number }).quantity)
            ? String((item as unknown as { quantity: number }).quantity)
            : "";
      const administrations = Number.isFinite(item.administrations) ? item.administrations : 1;
      return `${item.medicationName}${amount ? ` ${amount}` : ""} x${administrations}`;
    })
    .join("; ");
}

function formatIssuesNotes(qiFlag: boolean, qiSummary: string, incidentSummary: string): string {
  const qi = qiFlag ? `QI: ${formatTextCell(qiSummary)}` : "";
  const note = formatTextCell(incidentSummary);
  if (qi && note !== "—") return `${qi} | Note: ${note}`;
  if (qi) return qi;
  return note;
}

function getImageTrendIncidentUrl(incidentNumber: string): string | null {
  const template = IMAGETREND_INCIDENT_URL_TEMPLATE.trim();
  if (!template) return null;
  if (!incidentNumber?.trim()) return null;
  const raw = incidentNumber.trim();
  // Supports:
  // - "1080507"
  // - "Incident1080507"
  // - Full URL containing "...#/Incident1080507/..."
  const match = /Incident(\d+)/.exec(raw) || /#\/Incident(\d+)\//.exec(raw) || /^(\d+)$/.exec(raw);
  const id = match?.[1];
  if (!id) return null;
  return template.replace("{incident}", encodeURIComponent(id));
}

function getImageTrendListUrl(query: string): string | null {
  const template = IMAGETREND_INCIDENT_LIST_URL_TEMPLATE.trim();
  if (!template) return null;
  const q = query.trim();
  if (!q) return template;
  return template.includes("{q}") ? template.replace("{q}", encodeURIComponent(q)) : template;
}

function parseImageTrendIncidentId(value: string): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const match = /Incident(\d+)/.exec(raw) || /#\/Incident(\d+)\//.exec(raw);
  return match?.[1] ?? null;
}

function getIncidentDisplayNumber(value: string, link?: string): string {
  const fromLink = parseImageTrendIncidentId(link ?? "");
  if (fromLink) return fromLink;
  const raw = value?.trim() ?? "";
  if (!raw) return "";
  const tail = /(\d+)$/.exec(raw)?.[1];
  return tail ?? raw;
}

function getImageTrendHref(incidentNumber: string, incidentLink?: string): string | null {
  const trimmedLink = incidentLink?.trim() ?? "";
  if (trimmedLink) return trimmedLink;
  // Prefer direct incident deep link when possible.
  const direct = getImageTrendIncidentUrl(incidentNumber);
  if (direct) return direct;

  // Otherwise fall back to incident list/search page using the displayed tail digits.
  const display = getIncidentDisplayNumber(incidentNumber);
  return getImageTrendListUrl(display);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  function pushCell() {
    row.push(cell);
    cell = "";
  }
  function pushRow() {
    while (row.length && !row[row.length - 1]?.trim()) row.pop();
    rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ",") {
      pushCell();
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      pushCell();
      pushRow();
      continue;
    }
    cell += ch;
  }

  pushCell();
  if (row.some((c) => (c ?? "").trim() !== "")) pushRow();
  return rows;
}

function normalizeCsvHeader(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9/ #_-]/g, "")
    .trim();
}

function buildHeaderIndex(headerRow: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  headerRow.forEach((cell, i) => {
    const key = normalizeCsvHeader(cell);
    if (key && index[key] === undefined) index[key] = i;
  });
  return index;
}

function getCsvCell(row: string[], headerIndex: Record<string, number>, keys: string[]): string {
  for (const key of keys) {
    const idx = headerIndex[normalizeCsvHeader(key)];
    if (typeof idx === "number") return (row[idx] ?? "").trim();
  }
  return "";
}

function parseCsvBoolean(value: string): boolean {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return false;
  return v === "y" || v === "yes" || v === "true" || v === "1";
}

function resolveStationIdFromCsvValue(value: string, stations: Station[]): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const direct = stations.find((s) => s.id.toLowerCase() === raw.toLowerCase());
  if (direct) return direct.id;

  const num = /(\d{1,2})/.exec(raw)?.[1];
  if (num) {
    const idGuess = `st-${String(Number(num))}`;
    const byGuess = stations.find((s) => s.id === idGuess);
    if (byGuess) return byGuess.id;
    const byNameLoose = stations.find((s) => {
      const n = normalizeCsvHeader(s.name);
      return n.includes(` ${Number(num)}`) || n.endsWith(String(Number(num)));
    });
    if (byNameLoose) return byNameLoose.id;
  }

  const byName = stations.find((s) => normalizeCsvHeader(s.name) === normalizeCsvHeader(raw));
  return byName ? byName.id : null;
}

function parseCsvDateTimeToIso(value: string): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

function stationNumberFromId(stationId: string): number {
  const match = /st-(\d+)/.exec(stationId);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function getBattalionForStationId(stationId: string): Battalion {
  const id = stationId?.trim();
  if (!id) return "b5";
  if (battalionStationIds.b1.includes(id)) return "b1";
  if (battalionStationIds.b2.includes(id)) return "b2";
  if (battalionStationIds.b3.includes(id)) return "b3";
  if (battalionStationIds.b4.includes(id)) return "b4";
  return "b5";
}

function battalionSortKey(b: Battalion): number {
  if (b === "b1") return 1;
  if (b === "b2") return 2;
  if (b === "b3") return 3;
  if (b === "b4") return 4;
  return 5;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read uploaded file."));
    reader.readAsDataURL(file);
  });
}

function toInputDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toFileDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`;
}

function escapeCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const mustQuote = /[",\r\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

function downloadCsv(filename: string, rows: Array<Array<unknown>>) {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toOutcomeText(category: OutcomeCategory) {
  if (category === "win") return "Win";
  if (category === "negative") return "Negative";
  return "Needs Improvement";
}

function toBadgeTone(category: OutcomeCategory): "green" | "amber" | "red" {
  if (category === "win") return "green";
  if (category === "negative") return "red";
  return "amber";
}

function toCategoryTextFromRun(run: RunRecord): string {
  if (run.qiIssuesIdentified) return "QI Case";
  if (run.rosc) return "ROSC";
  if (run.defibrillationGiven) return "Pt Defibrillated";
  return "Arrest";
}

function toBadgeToneFromRun(run: RunRecord): "green" | "amber" | "red" {
  if (run.qiIssuesIdentified) return "red";
  if (run.rosc) return "green";
  if (run.defibrillationGiven) return "green";
  return "amber";
}

/** PDF row colors aligned with dashboard outcome badges (green / amber / red). */
function outcomePdfRowStyles(category: OutcomeCategory): {
  fillColor: [number, number, number];
  textColor: [number, number, number];
} {
  // Legacy fallback: keep reasonable coloring if older outcomeCategory is present.
  if (category === "negative") return { fillColor: [254, 226, 226], textColor: [127, 29, 29] };
  if (category === "win") return { fillColor: [220, 252, 231], textColor: [6, 78, 59] };
  return { fillColor: [254, 243, 199], textColor: [146, 64, 14] };
}

function Badge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red";
  children: string;
}) {
  const toneClasses =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800 ring-amber-200"
        : "bg-red-100 text-red-800 ring-red-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${toneClasses}`}>
      {children}
    </span>
  );
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="shrink-0 rounded-lg border border-white/30 bg-white/10 px-2 py-2 text-white">
      <p className="text-[11px] uppercase tracking-wide opacity-85">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
