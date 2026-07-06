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
  ProcedureRecord,
  RunRecord,
  Shift,
  Station,
  VascularAccessRecord,
} from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import { LoadingScreen } from "@/components/loading-screen";
import { StatusBanner } from "@/components/status-banner";
import { TimeSelect24, isValidTime24 } from "@/components/time-input-24";

type OptionsResponse = {
  stations: Station[];
};

type RunsResponse = {
  runs: RunRecord[];
};

type RoscFilter = "all" | "yes" | "no";
type Battalion = "b1" | "b2" | "b3" | "b4" | "b5";
type QAModule = "cardiac-arrest" | "trauma";

const moduleOptions: Array<{ value: QAModule; label: string }> = [
  { value: "cardiac-arrest", label: "Cardiac Arrest" },
  { value: "trauma", label: "Trauma" },
];

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
  b3: ["st-12", "st-14", "st-15", "st-16", "st-20", "st-21", "st-25"],
  b4: ["st-8", "st-11", "st-18", "st-24", "st-26", "st-28"],
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
const traumaMedicationOptions: Array<{ id: string; name: string }> = [
  { id: "med-txa", name: "TXA" },
  { id: "med-rocephin", name: "Rocephin" },
  { id: "med-prbcs", name: "PRBCs" },
  { id: "med-plasma", name: "Plasma" },
  { id: "med-oxygen", name: "Oxygen" },
  { id: "med-calcium", name: "Calcium" },
  { id: "med-saline", name: "Saline" },
  { id: "med-ketamine", name: "Ketamine" },
  { id: "med-fentanyl", name: "Fentanyl" },
  { id: "med-toradol", name: "Toradol" },
  { id: "med-versed", name: "Versed" },
  { id: "med-albuterol", name: "Albuterol" },
  { id: "med-sodium-bicarbonate", name: "Sodium Bicarbonate" },
];
const traumaProcedureOptions: Array<{ id: string; name: string }> = [
  { id: "proc-c-collar", name: "C Collar" },
  { id: "proc-c-spine-restriction", name: "C Spine Restriction" },
  { id: "proc-blood-product-admin", name: "Blood Product Administration" },
  { id: "proc-tourniquet", name: "Tourniquet" },
  { id: "proc-lsb-applied", name: "LSB Applied" },
  { id: "proc-hemostatic-spray", name: "Hemostatic Spray" },
  { id: "proc-trauma-gel", name: "Trauma Gel" },
  { id: "proc-occlusive-dressing", name: "Occlusive Dressing" },
  { id: "proc-needle-decompression", name: "Needle Decompression" },
  { id: "proc-needle-cricothyrotomy", name: "Needle Cricothyrotomy" },
  { id: "proc-packing-hemorrhage", name: "Packing for Hemorrhage" },
  { id: "proc-blood-transfusion", name: "Transfusion of Blood Products" },
  { id: "proc-etco2", name: "ETCO2" },
  { id: "proc-pressure-dressing", name: "Pressure Dressing" },
  { id: "proc-pelvic-binder", name: "Pelvic Binder" },
  { id: "proc-traction-splint", name: "Traction Splint" },
  { id: "proc-direct-pressure", name: "Direct Pressure" },
  { id: "proc-general-wound-care", name: "General Wound Care/Dressing" },
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
  const [activeModule, setActiveModule] = useState<QAModule>("cardiac-arrest");
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
  const [traumaStationFilter, setTraumaStationFilter] = useState("all");
  const [traumaBattalionFilter, setTraumaBattalionFilter] = useState<"all" | Battalion>("all");
  const [traumaCenterFilter, setTraumaCenterFilter] = useState<RoscFilter>("all");
  const [traumaTriageFilter, setTraumaTriageFilter] = useState<RoscFilter>("all");
  const [traumaStartDate, setTraumaStartDate] = useState("");
  const [traumaEndDate, setTraumaEndDate] = useState("");
  const [traumaMedicationFilter, setTraumaMedicationFilter] = useState("all");
  const [traumaProcedureFilter, setTraumaProcedureFilter] = useState("all");

  // -------- Trauma entry form state --------
  const [traumaBattalion, setTraumaBattalion] = useState<Battalion>("b1");
  const [traumaPrimaryResponseTerritoryId, setTraumaPrimaryResponseTerritoryId] = useState("");
  const [traumaPatientAge, setTraumaPatientAge] = useState("");
  const [traumaImageTrendIncidentLink, setTraumaImageTrendIncidentLink] = useState("");
  const [traumaShift, setTraumaShift] = useState<Shift>("A");
  const [traumaCallDateTime, setTraumaCallDateTime] = useState("");
  const [traumaCenterCriteria, setTraumaCenterCriteria] = useState<"" | "yes" | "no">("");
  const [traumaTriageCriteria, setTraumaTriageCriteria] = useState<"" | "yes" | "no">("");
  const [traumaMedicationsAdministered, setTraumaMedicationsAdministered] = useState<MedicationRecord[]>([]);
  const [traumaSelectedMedicationId, setTraumaSelectedMedicationId] = useState(
    traumaMedicationOptions[0]?.id ?? "",
  );
  const [traumaSelectedMedicationDosage, setTraumaSelectedMedicationDosage] = useState("");
  const [traumaMedicationOtherText, setTraumaMedicationOtherText] = useState("");
  const [traumaProceduresPerformed, setTraumaProceduresPerformed] = useState<ProcedureRecord[]>([]);
  const [traumaSelectedProcedureId, setTraumaSelectedProcedureId] = useState(
    traumaProcedureOptions[0]?.id ?? "",
  );
  const [traumaProcedureOtherText, setTraumaProcedureOtherText] = useState("");
  const [traumaVascularAccess, setTraumaVascularAccess] = useState<VascularAccessRecord[]>([]);
  const [traumaAccessTypeInput, setTraumaAccessTypeInput] = useState<"iv" | "io">("iv");
  const [traumaAccessLocationInput, setTraumaAccessLocationInput] = useState("");
  const [traumaAccessLocationOtherInput, setTraumaAccessLocationOtherInput] = useState("");
  const [traumaAccessSizeInput, setTraumaAccessSizeInput] = useState("");

  // -------- UI / request state --------
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTrauma, setIsSavingTrauma] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isTraumaExportMenuOpen, setIsTraumaExportMenuOpen] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [importProgressText, setImportProgressText] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const traumaImportInputRef = useRef<HTMLInputElement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCardiacRunId, setEditingCardiacRunId] = useState<string | null>(null);
  const [editingTraumaRunId, setEditingTraumaRunId] = useState<string | null>(null);
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
        setTraumaBattalion("b1");
        setTraumaPrimaryResponseTerritoryId(b1First ?? allStations[0]?.id ?? "");
        const now = toInputDateTime(new Date());
        setCallDateTime(now);
        setTraumaCallDateTime(now);
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
    if (!isExportMenuOpen && !isTraumaExportMenuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExportMenuOpen(false);
        setIsTraumaExportMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExportMenuOpen, isTraumaExportMenuOpen]);

  useEffect(() => {
    // Reset dependent access fields when switching between IV and IO.
    setAccessLocationInput("");
    setAccessLocationOtherInput("");
    setAccessSizeInput("");
  }, [accessTypeInput]);

  useEffect(() => {
    setTraumaAccessLocationInput("");
    setTraumaAccessLocationOtherInput("");
    setTraumaAccessSizeInput("");
  }, [traumaAccessTypeInput]);

  useEffect(() => {
    setError("");
    setSuccess("");
  }, [activeModule]);

  const cardiacRuns = useMemo(
    () => runs.filter((run) => (run.runType ?? "cardiac-arrest") !== "trauma"),
    [runs],
  );

  const traumaRuns = useMemo(
    () => runs.filter((run) => run.runType === "trauma"),
    [runs],
  );

  const filteredRuns = useMemo(
    () =>
      cardiacRuns.filter((run) => {
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
    [cardiacRuns, battalionFilter, stationFilter, roscFilter, startDate, endDate],
  );

  const traumaBaseFilteredRuns = useMemo(
    () =>
      traumaRuns.filter((run) => {
        const matchesBattalion =
          traumaBattalionFilter === "all" ||
          getBattalionForStationId(run.primaryResponseTerritoryId) === traumaBattalionFilter;
        const matchesStation =
          traumaStationFilter === "all" || run.stationId === traumaStationFilter;
        const matchesTraumaCenter =
          traumaCenterFilter === "all" ||
          (traumaCenterFilter === "yes"
            ? run.traumaCenterCriteriaSelected === true
            : run.traumaCenterCriteriaSelected !== true);
        const matchesTraumaTriage =
          traumaTriageFilter === "all" ||
          (traumaTriageFilter === "yes"
            ? run.traumaTriageCriteriaSelected === true
            : run.traumaTriageCriteriaSelected !== true);
        const runDate = new Date(run.callDateTime);
        const startBoundary = traumaStartDate ? new Date(`${traumaStartDate}T00:00:00`) : null;
        const endBoundary = traumaEndDate ? new Date(`${traumaEndDate}T23:59:59`) : null;
        const matchesStart = !startBoundary || runDate >= startBoundary;
        const matchesEnd = !endBoundary || runDate <= endBoundary;
        return (
          matchesBattalion &&
          matchesStation &&
          matchesTraumaCenter &&
          matchesTraumaTriage &&
          matchesStart &&
          matchesEnd
        );
      }),
    [
      traumaRuns,
      traumaBattalionFilter,
      traumaStationFilter,
      traumaCenterFilter,
      traumaTriageFilter,
      traumaStartDate,
      traumaEndDate,
    ],
  );

  const traumaMedicationUsageById = useMemo(
    () => buildTraumaMedicationUsageMap(traumaBaseFilteredRuns),
    [traumaBaseFilteredRuns],
  );

  const traumaProcedureUsageById = useMemo(
    () => buildTraumaProcedureUsageMap(traumaBaseFilteredRuns),
    [traumaBaseFilteredRuns],
  );

  const filteredTraumaRuns = useMemo(
    () =>
      traumaBaseFilteredRuns.filter((run) => {
        const matchesMedication =
          traumaMedicationFilter === "all" ||
          runMatchesTraumaMedicationFilter(run, traumaMedicationFilter);
        const matchesProcedure =
          traumaProcedureFilter === "all" ||
          runMatchesTraumaProcedureFilter(run, traumaProcedureFilter);
        return matchesMedication && matchesProcedure;
      }),
    [traumaBaseFilteredRuns, traumaMedicationFilter, traumaProcedureFilter],
  );

  const selectedTraumaMedicationUsage = useMemo(() => {
    if (traumaMedicationFilter === "all") return null;
    return traumaMedicationUsageById.get(traumaMedicationFilter) ?? {
      label: traumaMedicationFilter,
      administrations: 0,
      runs: 0,
    };
  }, [traumaMedicationFilter, traumaMedicationUsageById]);

  const selectedTraumaProcedureUsage = useMemo(() => {
    if (traumaProcedureFilter === "all") return null;
    return traumaProcedureUsageById.get(traumaProcedureFilter) ?? {
      label: traumaProcedureFilter,
      count: 0,
      runs: 0,
    };
  }, [traumaProcedureFilter, traumaProcedureUsageById]);

  const sortedTraumaRuns = useMemo(() => {
    const shiftOrder: Record<Shift, number> = { A: 0, B: 1, C: 2 };
    return [...filteredTraumaRuns].sort((a, b) => {
      const battalionA = battalionSortKey(getBattalionForStationId(a.primaryResponseTerritoryId));
      const battalionB = battalionSortKey(getBattalionForStationId(b.primaryResponseTerritoryId));
      if (battalionA !== battalionB) return battalionA - battalionB;

      const stationA = stationNumberFromId(a.primaryResponseTerritoryId);
      const stationB = stationNumberFromId(b.primaryResponseTerritoryId);
      if (stationA !== stationB) return stationA - stationB;

      const shiftA = shiftOrder[a.shift] ?? 99;
      const shiftB = shiftOrder[b.shift] ?? 99;
      if (shiftA !== shiftB) return shiftA - shiftB;

      return b.callDateTime.localeCompare(a.callDateTime);
    });
  }, [filteredTraumaRuns]);

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

  const traumaTriageCount = useMemo(
    () => filteredTraumaRuns.filter((run) => run.traumaTriageCriteriaSelected).length,
    [filteredTraumaRuns],
  );
  const traumaCenterCount = useMemo(
    () => filteredTraumaRuns.filter((run) => run.traumaCenterCriteriaSelected).length,
    [filteredTraumaRuns],
  );

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
  const traumaCenterPercentageText = useMemo(() => {
    if (!filteredTraumaRuns.length) return "—";
    const pct = (traumaCenterCount / filteredTraumaRuns.length) * 100;
    const rounded = Math.round(pct * 10) / 10;
    return `${rounded}%`;
  }, [filteredTraumaRuns.length, traumaCenterCount]);
  const traumaTriagePercentageText = useMemo(() => {
    if (!filteredTraumaRuns.length) return "—";
    const pct = (traumaTriageCount / filteredTraumaRuns.length) * 100;
    const rounded = Math.round(pct * 10) / 10;
    return `${rounded}%`;
  }, [filteredTraumaRuns.length, traumaTriageCount]);

  const headerStats = useMemo(() => {
    if (activeModule === "cardiac-arrest") {
      return [
        { label: "Total Arrests", value: String(filteredRuns.length) },
        { label: "ROSC %", value: roscPercentageText },
        { label: "ROSC", value: String(roscCount) },
        { label: "Defibrillated", value: String(defibCount) },
        { label: "QI Cases", value: String(qiCount) },
      ];
    }
    return [
      { label: "Total Cases", value: String(filteredTraumaRuns.length) },
      { label: "Center %", value: traumaCenterPercentageText },
      { label: "Trauma Center", value: String(traumaCenterCount) },
      { label: "Triage %", value: traumaTriagePercentageText },
      { label: "Trauma Triage", value: String(traumaTriageCount) },
    ];
  }, [
    activeModule,
    defibCount,
    filteredRuns.length,
    filteredTraumaRuns.length,
    qiCount,
    roscCount,
    roscPercentageText,
    traumaCenterCount,
    traumaCenterPercentageText,
    traumaTriageCount,
    traumaTriagePercentageText,
  ]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

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
      const callTime = splitInputDateTime(callDateTime).time;
      if (!callTime || !isValidTime24(callTime)) {
        throw new Error("Enter call time in 24-hour format (HH:MM), e.g. 14:30.");
      }
      const needsAirwaySize = Object.entries(airwayAdjuncts).some(
        ([type, checked]) => checked && type !== "bvm" && !airwayAdjunctSizes[type as AirwayAdjunctType].trim(),
      );
      if (needsAirwaySize) {
        throw new Error("Size is required for airway adjuncts except BVM.");
      }
      const response = await fetch(
        editingCardiacRunId ? `/api/runs/${encodeURIComponent(editingCardiacRunId)}` : "/api/runs",
        {
        method: editingCardiacRunId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runType: "cardiac-arrest",
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
          itemsUsed: [],
        }),
      },
      );

      const json = (await response.json()) as { error?: string; run?: RunRecord };
      if (!response.ok || !json.run) {
        throw new Error(json.error || "Failed to save run.");
      }

      setRuns((prev) =>
        editingCardiacRunId
          ? prev.map((entry) => (entry.id === json.run!.id ? json.run! : entry))
          : [json.run!, ...prev],
      );
      resetCardiacForm();
      setSuccess(editingCardiacRunId ? "Run updated successfully." : "Run saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save run.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTraumaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSavingTrauma(true);

    try {
      const incidentId = parseImageTrendIncidentId(traumaImageTrendIncidentLink);
      if (!incidentId) {
        throw new Error("Paste a valid ImageTrend Incident Link (it must contain Incident#######).");
      }
      if (!traumaCenterCriteria || !traumaTriageCriteria) {
        throw new Error("Select Yes or No for Trauma Center and Trauma Triage criteria.");
      }
      const traumaCallTime = splitInputDateTime(traumaCallDateTime).time;
      if (!traumaCallTime || !isValidTime24(traumaCallTime)) {
        throw new Error("Enter call time in 24-hour format (HH:MM), e.g. 14:30.");
      }

      const response = await fetch(
        editingTraumaRunId ? `/api/runs/${encodeURIComponent(editingTraumaRunId)}` : "/api/runs",
        {
        method: editingTraumaRunId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runType: "trauma",
          primaryResponseTerritoryId: traumaPrimaryResponseTerritoryId,
          stationId: traumaPrimaryResponseTerritoryId,
          patientAge: traumaPatientAge.trim() ? Number(traumaPatientAge) : null,
          runNumber: incidentId,
          imageTrendIncidentLink: traumaImageTrendIncidentLink,
          shift: traumaShift,
          callDateTime: traumaCallDateTime,
          traumaCenterCriteriaSelected: traumaCenterCriteria === "yes",
          traumaTriageCriteriaSelected: traumaTriageCriteria === "yes",
          traumaProcedures: traumaProceduresPerformed,
          traumaProcedureOtherText: traumaProcedureOtherText,
          medicationsAdministered: traumaMedicationsAdministered,
          medicationOtherText: traumaMedicationOtherText,
          vascularAccess: traumaVascularAccess,
          rosc: false,
          defibrillationGiven: false,
          defibrillationCount: null,
          airwayAdjuncts: [],
          resqPumpUsed: false,
          resqPodUsed: false,
          qiIssuesIdentified: false,
          outcomeCategory: "needs-improvement",
          arrestWitnessing: null,
          patientAgeCategory: null,
          itemsUsed: [],
        }),
      },
      );

      const json = (await response.json()) as { error?: string; run?: RunRecord };
      if (!response.ok || !json.run) {
        throw new Error(json.error || "Failed to save trauma run.");
      }

      setRuns((prev) =>
        editingTraumaRunId
          ? prev.map((entry) => (entry.id === json.run!.id ? json.run! : entry))
          : [json.run!, ...prev],
      );
      resetTraumaForm();
      setSuccess(editingTraumaRunId ? "Trauma run updated successfully." : "Trauma run saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save trauma run.");
    } finally {
      setIsSavingTrauma(false);
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

  function addTraumaVascularAccess() {
    const location =
      traumaAccessTypeInput === "iv" && traumaAccessLocationInput === "other"
        ? traumaAccessLocationOtherInput.trim()
        : traumaAccessLocationInput.trim();
    const size = traumaAccessSizeInput.trim();
    if (!location || !size) {
      setError("Enter both vascular access location and size.");
      return;
    }
    setTraumaVascularAccess((prev) => [
      ...prev,
      { type: traumaAccessTypeInput, location, size },
    ]);
    setError("");
    setTraumaAccessLocationInput("");
    setTraumaAccessLocationOtherInput("");
    setTraumaAccessSizeInput("");
  }

  function removeTraumaVascularAccessAt(index: number) {
    setTraumaVascularAccess((prev) => prev.filter((_, i) => i !== index));
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

  function addTraumaMedication() {
    const medication = traumaMedicationOptions.find((m) => m.id === traumaSelectedMedicationId);
    if (!medication || !traumaSelectedMedicationDosage.trim()) {
      setError("Select a medication and enter a dosage.");
      return;
    }
    setError("");
    setTraumaMedicationsAdministered((prev) => [
      ...prev,
      {
        medicationId: medication.id,
        medicationName: medication.name,
        amount: traumaSelectedMedicationDosage.trim(),
        administrations: 1,
      },
    ]);
    setTraumaSelectedMedicationDosage("");
  }

  function removeTraumaMedicationAt(index: number) {
    setTraumaMedicationsAdministered((prev) => prev.filter((_, i) => i !== index));
  }

  function addTraumaProcedure() {
    const procedure = traumaProcedureOptions.find((p) => p.id === traumaSelectedProcedureId);
    if (!procedure) return;
    if (traumaProceduresPerformed.some((entry) => entry.procedureId === procedure.id)) {
      setError("That procedure is already added.");
      return;
    }
    setError("");
    setTraumaProceduresPerformed((prev) => [
      ...prev,
      { procedureId: procedure.id, procedureName: procedure.name },
    ]);
  }

  function removeTraumaProcedureAt(index: number) {
    setTraumaProceduresPerformed((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImportCsvFile(file: File, forModule: QAModule = activeModule) {
    const isTrauma = forModule === "trauma";
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

        const traumaCenterValue = getCsvCell(row, colIndex, [
          "trauma center",
          "trauma center criteria",
          "trauma center criteria selected",
        ]).trim();
        const traumaTriageValue = getCsvCell(row, colIndex, [
          "trauma triage",
          "trauma triage criteria",
          "trauma triage criteria selected",
        ]).trim();
        const traumaMedicationsValue = getCsvCell(row, colIndex, [
          "medications administered",
          "medications",
          "trauma medications",
        ]).trim();
        const traumaProceduresValue = getCsvCell(row, colIndex, [
          "procedures",
          "trauma procedures",
        ]).trim();

        const body = isTrauma
          ? {
              runType: "trauma" as const,
              primaryResponseTerritoryId: stationId,
              stationId,
              patientAge: patientAgeParsed,
              runNumber: incidentId,
              imageTrendIncidentLink: incidentLink,
              shift: shiftParsed,
              callDateTime: callIso,
              traumaCenterCriteriaSelected: parseCsvBoolean(traumaCenterValue),
              traumaTriageCriteriaSelected: parseCsvBoolean(traumaTriageValue),
              traumaMedicationsText: traumaMedicationsValue,
              traumaProceduresText: traumaProceduresValue,
              vascularAccess: [],
            }
          : {
          runType: "cardiac-arrest" as const,
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
      if (traumaImportInputRef.current) {
        traumaImportInputRef.current.value = "";
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

  function clearTraumaDashboardFilters() {
    setTraumaStationFilter("all");
    setTraumaBattalionFilter("all");
    setTraumaCenterFilter("all");
    setTraumaTriageFilter("all");
    setTraumaStartDate("");
    setTraumaEndDate("");
    setTraumaMedicationFilter("all");
    setTraumaProcedureFilter("all");
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
      return all
        .filter((s) => !b1to4.has(s.id))
        .sort((a, b) => stationNumberFromId(a.id) - stationNumberFromId(b.id));
    }

    // Keep explicit list order as provided (so station dropdown is in a predictable order).
    return explicitIds
      .map((id) => all.find((s) => s.id === id))
      .filter((s): s is Station => Boolean(s))
      .concat(all.filter((s) => explicitSet.has(s.id) === false && false));
  }, [battalion, stations]);

  const traumaStationsForSelectedBattalion = useMemo(() => {
    const all = stations;
    const explicitIds = battalionStationIds[traumaBattalion];

    if (traumaBattalion === "b5") {
      const b1to4 = new Set([
        ...battalionStationIds.b1,
        ...battalionStationIds.b2,
        ...battalionStationIds.b3,
        ...battalionStationIds.b4,
      ]);
      return all
        .filter((s) => !b1to4.has(s.id))
        .sort((a, b) => stationNumberFromId(a.id) - stationNumberFromId(b.id));
    }

    return explicitIds
      .map((id) => all.find((s) => s.id === id))
      .filter((s): s is Station => Boolean(s));
  }, [traumaBattalion, stations]);

  const stationsForBattalionFilter = useMemo(() => {
    if (battalionFilter === "all") return stations;
    if (battalionFilter === "b5") {
      const b1to4 = new Set([
        ...battalionStationIds.b1,
        ...battalionStationIds.b2,
        ...battalionStationIds.b3,
        ...battalionStationIds.b4,
      ]);
      return stations
        .filter((s) => !b1to4.has(s.id))
        .sort((a, b) => stationNumberFromId(a.id) - stationNumberFromId(b.id));
    }
    const ids = battalionStationIds[battalionFilter];
    return ids
      .map((id) => stations.find((s) => s.id === id))
      .filter((s): s is Station => Boolean(s));
  }, [battalionFilter, stations]);

  const traumaStationsForBattalionFilter = useMemo(() => {
    if (traumaBattalionFilter === "all") return stations;
    if (traumaBattalionFilter === "b5") {
      const b1to4 = new Set([
        ...battalionStationIds.b1,
        ...battalionStationIds.b2,
        ...battalionStationIds.b3,
        ...battalionStationIds.b4,
      ]);
      return stations
        .filter((s) => !b1to4.has(s.id))
        .sort((a, b) => stationNumberFromId(a.id) - stationNumberFromId(b.id));
    }
    const ids = battalionStationIds[traumaBattalionFilter];
    return ids
      .map((id) => stations.find((s) => s.id === id))
      .filter((s): s is Station => Boolean(s));
  }, [traumaBattalionFilter, stations]);

  useEffect(() => {
    if (traumaBattalionFilter === "all") return;
    if (traumaStationFilter === "all") return;
    const stillValid = traumaStationsForBattalionFilter.some((s) => s.id === traumaStationFilter);
    if (!stillValid) {
      setTraumaStationFilter("all");
    }
  }, [traumaBattalionFilter, traumaStationFilter, traumaStationsForBattalionFilter]);

  useEffect(() => {
    if (battalionFilter === "all") return;
    if (stationFilter === "all") return;
    const stillValid = stationsForBattalionFilter.some((s) => s.id === stationFilter);
    if (!stillValid) {
      setStationFilter("all");
    }
  }, [battalionFilter, stationFilter, stationsForBattalionFilter]);

  function resetCardiacForm() {
    setEditingCardiacRunId(null);
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
  }

  function resetTraumaForm() {
    setEditingTraumaRunId(null);
    setTraumaPatientAge("");
    setTraumaImageTrendIncidentLink("");
    setTraumaShift("A");
    setTraumaCallDateTime(toInputDateTime(new Date()));
    setTraumaCenterCriteria("");
    setTraumaTriageCriteria("");
    setTraumaMedicationsAdministered([]);
    setTraumaSelectedMedicationDosage("");
    setTraumaMedicationOtherText("");
    setTraumaProceduresPerformed([]);
    setTraumaProcedureOtherText("");
    setTraumaVascularAccess([]);
    setTraumaAccessTypeInput("iv");
    setTraumaAccessLocationInput("");
    setTraumaAccessLocationOtherInput("");
    setTraumaAccessSizeInput("");
  }

  function loadCardiacRunForEdit(run: RunRecord) {
    setError("");
    setSuccess("");
    setActiveModule("cardiac-arrest");
    setEditingCardiacRunId(run.id);
    setBattalion(getBattalionForStationId(run.primaryResponseTerritoryId));
    setPrimaryResponseTerritoryId(run.primaryResponseTerritoryId);
    setPatientAge(run.patientAge !== null ? String(run.patientAge) : "");
    setImageTrendIncidentLink(run.imageTrendIncidentLink);
    setShift(run.shift);
    setCallDateTime(toInputDateTime(new Date(run.callDateTime)));
    setPatientDisposition(run.patientDisposition);
    setArrestWitnessing(run.arrestWitnessing);
    setPatientAgeCategory(run.patientAgeCategory);
    setRosc(run.rosc);
    setDefibrillationGiven(run.defibrillationGiven);
    setDefibrillationCount(run.defibrillationCount !== null ? String(run.defibrillationCount) : "");
    const nextAdjuncts: Record<AirwayAdjunctType, boolean> = {
      bvm: false,
      npa: false,
      opa: false,
      "i-gel": false,
      ett: false,
    };
    const nextAdjunctSizes: Record<AirwayAdjunctType, string> = {
      bvm: "",
      npa: "",
      opa: "",
      "i-gel": "",
      ett: "",
    };
    for (const entry of run.airwayAdjuncts || []) {
      nextAdjuncts[entry.type] = true;
      if (entry.type !== "bvm" && entry.size) {
        nextAdjunctSizes[entry.type] = entry.size;
      }
    }
    setAirwayAdjuncts(nextAdjuncts);
    setAirwayAdjunctSizes(nextAdjunctSizes);
    setVascularAccess(run.vascularAccess || []);
    setResqPumpUsed(run.resqPumpUsed);
    setResqPodUsed(run.resqPodUsed);
    setMedicationsAdministered(run.medicationsAdministered || []);
    setMedicationOtherText(run.medicationOtherText || "");
    setIncidentSummary(run.incidentSummary || run.notes || "");
    setQiIssuesIdentified(run.qiIssuesIdentified);
    setQiIssueSummary(run.qiIssueSummary || "");
    setDefibPadsAppliedTime(run.defibPadsAppliedTime || "");
    setCompressionsStartedTime(run.compressionsStartedTime || "");
    setDefibrillationTime(run.defibrillationTime || "");
    setZollRecordLink(run.zollRecordLink || "");
    setRhythmStripImageDataUrl(run.rhythmStripImageDataUrl || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadTraumaRunForEdit(run: RunRecord) {
    setError("");
    setSuccess("");
    setActiveModule("trauma");
    setEditingTraumaRunId(run.id);
    setTraumaBattalion(getBattalionForStationId(run.primaryResponseTerritoryId));
    setTraumaPrimaryResponseTerritoryId(run.primaryResponseTerritoryId);
    setTraumaPatientAge(run.patientAge !== null ? String(run.patientAge) : "");
    setTraumaImageTrendIncidentLink(run.imageTrendIncidentLink);
    setTraumaShift(run.shift);
    setTraumaCallDateTime(toInputDateTime(new Date(run.callDateTime)));
    setTraumaCenterCriteria(
      run.traumaCenterCriteriaSelected === true
        ? "yes"
        : run.traumaCenterCriteriaSelected === false
          ? "no"
          : "",
    );
    setTraumaTriageCriteria(
      run.traumaTriageCriteriaSelected === true
        ? "yes"
        : run.traumaTriageCriteriaSelected === false
          ? "no"
          : "",
    );
    setTraumaMedicationsAdministered(run.medicationsAdministered || []);
    setTraumaMedicationOtherText(run.medicationOtherText || "");
    setTraumaProceduresPerformed(run.traumaProcedures || []);
    setTraumaProcedureOtherText(run.traumaProcedureOtherText || "");
    setTraumaVascularAccess(run.vascularAccess || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
      doc.text(`Generated: ${formatDateTime24(generatedAt)}`, 40, 60);
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

  async function handleExportTraumaPdf() {
    setError("");
    setSuccess("");
    setIsExportingPdf(true);

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      const generatedAt = new Date();
      const battalionLabel = traumaBattalionFilter === "all"
        ? "All Battalions"
        : `Battalion ${traumaBattalionFilter}`;
      const stationLabel = traumaStationFilter === "all"
        ? "All Units"
        : stations.find((station) => station.id === traumaStationFilter)?.name || traumaStationFilter;
      const centerLabel = traumaCenterFilter === "all"
        ? "All"
        : traumaCenterFilter === "yes"
          ? "Yes"
          : "No";
      const triageLabel = traumaTriageFilter === "all"
        ? "All"
        : traumaTriageFilter === "yes"
          ? "Yes"
          : "No";
      const dateLabel = traumaStartDate || traumaEndDate
        ? `${traumaStartDate || "Any"} to ${traumaEndDate || "Any"}`
        : "Any Date";

      doc.setFontSize(16);
      doc.text("EMS Trauma QA Report", 40, 40);
      doc.setFontSize(10);
      doc.text(`Generated: ${formatDateTime24(generatedAt)}`, 40, 60);
      doc.text(
        `Filters: Battalion=${battalionLabel} | Unit=${stationLabel} | Trauma Center=${centerLabel} | Trauma Triage=${triageLabel} | Date=${dateLabel}`,
        40,
        76,
      );
      doc.text(
        `Summary: Total Trauma Cases=${filteredTraumaRuns.length}, Trauma Center=${traumaCenterCount}, Trauma Triage=${traumaTriageCount}`,
        40,
        92,
      );
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(
        "Legend — Green: Trauma Center criteria met | Yellow: Neither criteria | Red: Trauma Triage criteria met",
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
            "Call Date/Time",
            "Station / Shift",
            "ImageTrend Incident #",
            "Age",
            "Trauma Center",
            "Trauma Triage",
            "Medications",
            "Procedures",
            "IV/IO Access",
          ],
        ],
        body: sortedTraumaRuns.map((run) => [
          formatDateTime24(run.callDateTime),
          `${run.primaryResponseTerritoryName} / ${run.shift}`,
          run.runNumber,
          run.patientAge ?? "-",
          formatYesNo(run.traumaCenterCriteriaSelected),
          formatYesNo(run.traumaTriageCriteriaSelected),
          formatTextCell(formatTraumaMedications(run)),
          formatTextCell(formatTraumaProcedures(run)),
          formatVascularAccess(run.vascularAccess),
        ]),
        columnStyles: {
          0: { cellWidth: 72 },
          1: { cellWidth: 70 },
          2: { cellWidth: 42 },
          3: { cellWidth: 22 },
          4: { cellWidth: 36 },
          5: { cellWidth: 36 },
          6: { cellWidth: 90 },
          7: { cellWidth: 90 },
          8: { cellWidth: 72 },
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const run = sortedTraumaRuns[data.row.index];
          if (!run) return;
          if (run.traumaTriageCriteriaSelected) {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [127, 29, 29];
            return;
          }
          if (run.traumaCenterCriteriaSelected) {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.textColor = [6, 78, 59];
            return;
          }
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        },
      });

      const filename = `ems-trauma-report-${toFileDate(generatedAt)}.pdf`;
      doc.save(filename);
      setSuccess("Trauma PDF report generated from current filters.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to generate trauma PDF report.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  async function handleExportTraumaCsv() {
    setError("");
    setSuccess("");
    setIsExportingCsv(true);

    try {
      const headers = [
        "Call Date/Time",
        "Station / Shift",
        "ImageTrend Incident #",
        "Age",
        "Trauma Center",
        "Trauma Triage",
        "Medications",
        "Procedures",
        "IV/IO Access",
      ];

      const rows = sortedTraumaRuns.map((run) => [
        formatDateTime24(run.callDateTime),
        `${run.primaryResponseTerritoryName} / ${run.shift}`,
        run.runNumber,
        run.patientAge ?? "",
        formatYesNo(run.traumaCenterCriteriaSelected),
        formatYesNo(run.traumaTriageCriteriaSelected),
        formatTraumaMedications(run),
        formatTraumaProcedures(run),
        formatVascularAccess(run.vascularAccess),
      ]);

      downloadCsv(
        `ems-trauma-report-${toFileDate(new Date())}.csv`,
        [headers, ...rows],
      );
      setSuccess("Trauma CSV exported from current filters.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export trauma CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  }

  async function handleExportTraumaUsageCsv() {
    setError("");
    setSuccess("");
    setIsExportingCsv(true);

    try {
      const medicationCounts = new Map<string, number>();
      const procedureCounts = new Map<string, number>();

      for (const run of traumaBaseFilteredRuns) {
        for (const med of run.medicationsAdministered || []) {
          const label = med.medicationName?.trim();
          if (!label) continue;
          const administrations = Number.isFinite(med.administrations) ? med.administrations : 1;
          medicationCounts.set(label, (medicationCounts.get(label) ?? 0) + administrations);
        }
        if (run.medicationOtherText?.trim()) {
          const label = `Other: ${run.medicationOtherText.trim()}`;
          medicationCounts.set(label, (medicationCounts.get(label) ?? 0) + 1);
        }
        for (const proc of run.traumaProcedures || []) {
          const label = proc.procedureName?.trim();
          if (!label) continue;
          procedureCounts.set(label, (procedureCounts.get(label) ?? 0) + 1);
        }
        if (run.traumaProcedureOtherText?.trim()) {
          const label = `Other: ${run.traumaProcedureOtherText.trim()}`;
          procedureCounts.set(label, (procedureCounts.get(label) ?? 0) + 1);
        }
      }

      const medicationRows = [...medicationCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => [name, count]);
      const procedureRows = [...procedureCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => [name, count]);

      downloadCsv(`ems-trauma-usage-${toFileDate(new Date())}.csv`, [
        ["Medication", "Times Used"],
        ...medicationRows,
        [],
        ["Procedure", "Times Used"],
        ...procedureRows,
      ]);
      setSuccess("Trauma medication/procedure usage CSV exported from current filters.");
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "Failed to export trauma usage CSV.",
      );
    } finally {
      setIsExportingCsv(false);
    }
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className="app-page p-4 sm:p-6 text-zinc-900">
      <div className="app-container mb-4 sm:mb-6">
        <AppHeader
          activeModule={activeModule}
          moduleOptions={moduleOptions}
          onModuleChange={setActiveModule}
          stats={headerStats}
          onSignOut={() => void handleSignOut()}
        />
      </div>

      {(error || success) ? (
        <div className="app-container mb-4 space-y-2">
          {error ? (
            <StatusBanner type="error" message={error} onDismiss={() => setError("")} />
          ) : null}
          {success ? (
            <StatusBanner type="success" message={success} onDismiss={() => setSuccess("")} />
          ) : null}
        </div>
      ) : null}

      {activeModule === "cardiac-arrest" ? (
      <div className="app-container grid gap-4 sm:gap-6 lg:grid-cols-3">
        <section className="card card-form-scroll lg:col-span-1">
          <h2 className="card-title">{editingCardiacRunId ? "Edit EMS Run" : "New EMS Run"}</h2>
          <p className="card-description">
            {editingCardiacRunId
              ? "Update the saved run entry, then click Save Changes."
              : "Manual entry by station, run number, shift, outcome category, ROSC, and items used."}
          </p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <label className="field-label">
              Battalion
              <select
                className="field-input"
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

            <label className="field-label">
              Primary Response Territory
              <select
                className="field-input"
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

            <label className="field-label">
              Shift
              <select
                className="field-input"
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

            <label className="field-label">
              ImageTrend Incident Link
              <input
                className="field-input"
                value={imageTrendIncidentLink}
                onChange={(e) => setImageTrendIncidentLink(e.target.value)}
                placeholder="Paste full ImageTrend incident link"
                required
              />
            </label>

            <div className="field-label">
              Call Date/Time
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  className="field-input"
                  type="date"
                  value={splitInputDateTime(callDateTime).date}
                  onChange={(e) =>
                    setCallDateTime(
                      combineInputDateTime(e.target.value, splitInputDateTime(callDateTime).time),
                    )
                  }
                  required
                />
                <TimeSelect24
                  value={splitInputDateTime(callDateTime).time}
                  onChange={(time) =>
                    setCallDateTime(
                      combineInputDateTime(splitInputDateTime(callDateTime).date, time),
                    )
                  }
                  required
                  aria-label="Call time (24-hour)"
                />
              </div>
              <p className="form-panel-hint">24-hour clock — select hour (00–23) and minute.</p>
            </div>

            <label className="field-label">
              Patient Age
              <input
                className="field-input"
                type="number"
                min={0}
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                placeholder="Example: 67"
              />
            </label>

            <div className="form-panel">
              <p className="form-panel-title">Arrest witnessed?</p>
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
              <p className="form-panel-hint">Check one or leave both unchecked.</p>
            </div>

            <div className="form-panel">
              <p className="form-panel-title">Patient disposition</p>
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
              <p className="form-panel-hint">Check one or leave all unchecked.</p>
            </div>

            <div className="form-panel">
              <p className="form-panel-title">Patient age group</p>
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
              <p className="form-panel-hint">Check one or leave all unchecked.</p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rosc} onChange={(e) => setRosc(e.target.checked)} />
              ROSC achieved
            </label>

            <div className="form-panel">
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
                    className="field-input"
                    type="number"
                    min={1}
                    value={defibrillationCount}
                    onChange={(e) => setDefibrillationCount(e.target.value)}
                  />
                </label>
              )}
            </div>

            <div className="form-panel">
              <p className="form-panel-title">Airway adjunct</p>
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
                    <label key={`${option.value}-size`} className="field-label">
                      {option.label} size
                      <input
                        className="field-input"
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

            <div className="form-panel">
              <p className="form-panel-title">IV or IO access</p>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <select
                  className="field-input-sm"
                  value={accessTypeInput}
                  onChange={(e) => setAccessTypeInput(e.target.value as "iv" | "io")}
                >
                  <option value="iv">IV</option>
                  <option value="io">IO</option>
                </select>
                <select
                  className="field-input-sm"
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
                    className="field-input-sm"
                    value={accessLocationOtherInput}
                    onChange={(e) => setAccessLocationOtherInput(e.target.value)}
                    placeholder="Enter location"
                  />
                ) : (
                  <select
                    className="field-input-sm"
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
                    className="field-input-sm"
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
                  className="btn-toolbar-primary text-sm"
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
                      className="btn-action"
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

            <div className="form-panel">
              <p className="form-panel-title">Medications administered</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  className="field-input-sm min-w-40 flex-1"
                  value={selectedMedicationId}
                  onChange={(e) => setSelectedMedicationId(e.target.value)}
                >
                  {medicationOptions.map((med) => (
                    <option key={med.id} value={med.id}>{med.name}</option>
                  ))}
                </select>
                <input
                  className="field-input-sm min-w-28 flex-1"
                  value={selectedMedicationAmount}
                  onChange={(e) => setSelectedMedicationAmount(e.target.value)}
                  placeholder="Dosage (e.g. 1 mg)"
                />
                <input
                  className="field-input-sm w-24"
                  type="number"
                  min={1}
                  value={selectedMedicationAdministrations}
                  onChange={(e) => setSelectedMedicationAdministrations(Number(e.target.value))}
                  title="Number of administrations"
                />
                <button className="btn-toolbar-primary text-sm" type="button" onClick={addMedication}>
                  Add Med
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {medicationsAdministered.map((entry, index) => (
                  <li key={`${entry.medicationId}-${index}`} className="flex justify-between gap-2">
                    <span>{entry.medicationName}: {entry.amount} (x{entry.administrations})</span>
                    <button
                      type="button"
                      className="btn-action"
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
                  className="field-input"
                  value={medicationOtherText}
                  onChange={(e) => setMedicationOtherText(e.target.value)}
                  placeholder="Anything outside preset list"
                />
              </label>
            </div>

            <div className="form-panel">
              <p className="form-panel-title">Critical intervention times</p>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <label className="text-sm">
                  Time of defib pads applied
                  <TimeSelect24
                    className="mt-1"
                    value={defibPadsAppliedTime}
                    onChange={setDefibPadsAppliedTime}
                    aria-label="Time of defib pads applied (24-hour)"
                  />
                </label>
                <label className="text-sm">
                  Time to compressions
                  <TimeSelect24
                    className="mt-1"
                    value={compressionsStartedTime}
                    onChange={setCompressionsStartedTime}
                    aria-label="Time to compressions (24-hour)"
                  />
                </label>
                <label className="text-sm">
                  Time to defibrillation
                  <TimeSelect24
                    className="mt-1"
                    value={defibrillationTime}
                    onChange={setDefibrillationTime}
                    aria-label="Time to defibrillation (24-hour)"
                  />
                </label>
              </div>
            </div>

            <div className="form-panel">
              <p className="form-panel-title">ZOLL record / rhythm strip</p>
              <label className="mt-2 block text-sm">
                ZOLL EKG record link
                <input
                  className="field-input"
                  type="url"
                  value={zollRecordLink}
                  onChange={(e) => setZollRecordLink(e.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label className="mt-2 block text-sm">
                Upload rhythm strip image
                <input
                  className="field-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleRhythmStripUpload(e.target.files?.[0] ?? null)}
                />
              </label>
              {rhythmStripImageDataUrl && (
                <img src={rhythmStripImageDataUrl} alt="Rhythm strip preview" className="mt-2 max-h-32 rounded border border-zinc-200" />
              )}
            </div>

            <label className="field-label">
              Written incident summary
              <textarea
                className="field-input"
                rows={4}
                value={incidentSummary}
                onChange={(e) => setIncidentSummary(e.target.value)}
              />
            </label>

            <div className="form-panel">
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
                    className="field-input"
                    rows={3}
                    value={qiIssueSummary}
                    onChange={(e) => setQiIssueSummary(e.target.value)}
                  />
                </label>
              )}
            </div>


            <div className="flex flex-wrap gap-2">
              {editingCardiacRunId ? (
                <button
                  className="btn-toolbar flex-1"
                  type="button"
                  onClick={resetCardiacForm}
                  disabled={isSaving}
                >
                  Cancel Edit
                </button>
              ) : null}
              <button
                className="btn-submit flex-1"
                type="submit"
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : editingCardiacRunId
                    ? "Save Changes"
                    : "Save Run"}
              </button>
            </div>
          </form>
        </section>

        <section className="card lg:col-span-2">
          <h2 className="card-title">Unit Dashboard</h2>
          <p className="card-description">Review, filter, and export QA records for your organization.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            <label className="field-label-filter">
              Battalion Filter
              <select
                className="field-input"
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

            <label className="field-label-filter">
              Unit Filter
              <select
                className="field-input"
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

            <label className="field-label-filter">
              ROSC Filter
              <select
                className="field-input"
                value={roscFilter}
                onChange={(e) => setRoscFilter(e.target.value as RoscFilter)}
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="field-label-filter">
              Start Date
              <input
                className="field-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label className="field-label-filter">
              End Date
              <input
                className="field-input"
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
                className="btn-toolbar-secondary"
                onClick={clearDashboardFilters}
              >
                Clear Filters
              </button>
              <button
                type="button"
                className="btn-toolbar-primary"
                onClick={() => importInputRef.current?.click()}
                disabled={isImportingCsv || isExportingPdf || isExportingCsv}
                title="Import runs from a CSV exported from Excel"
              >
                {isImportingCsv ? "Importing…" : "Import CSV"}
              </button>
              <div className="relative">
                <button
                  type="button"
                  className="btn-toolbar-primary"
                  onClick={() => setIsExportMenuOpen((prev) => !prev)}
                  disabled={isExportingPdf || isExportingCsv}
                  aria-haspopup="menu"
                  aria-expanded={isExportMenuOpen}
                >
                  {isExportingPdf || isExportingCsv ? "Exporting…" : "Export"}
                </button>

                {isExportMenuOpen ? (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      role="presentation"
                      onClick={() => setIsExportMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      aria-label="Export options"
                      className="export-menu"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="export-menu-item"
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
                        className="export-menu-item"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          void handleExportCsv();
                        }}
                      >
                        Export CSV (Excel)
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            {importProgressText ? (
              <p className="mt-2 text-xs text-zinc-600">{importProgressText}</p>
            ) : null}
          </div>

          <div className="mt-4 w-full overflow-x-auto">
            <table className="data-table">
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
                    <td className="p-2">{formatDateTime24(run.callDateTime)}</td>
                    <td className="hidden p-2 sm:table-cell">{run.primaryResponseTerritoryName}</td>
                    <td className="p-2" onClick={(event) => event.stopPropagation()}>
                      {getImageTrendHref(run.runNumber, run.imageTrendIncidentLink) ? (
                        <a
                          href={getImageTrendHref(run.runNumber, run.imageTrendIncidentLink)!}
                          target="_blank"
                          rel="noreferrer"
                          className="link-incident"
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
                          className="btn-action"
                          onClick={() => loadCardiacRunForEdit(run)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-action"
                          onClick={() => setNotesRun(run)}
                        >
                          Notes
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-action-danger disabled:opacity-50"
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
      ) : (
      <div className="app-container grid gap-4 sm:gap-6 lg:grid-cols-3">
        <section className="card card-form-scroll lg:col-span-1">
          <h2 className="card-title">{editingTraumaRunId ? "Edit Trauma Run" : "New Trauma Run"}</h2>
          <p className="card-description">
            {editingTraumaRunId
              ? "Update the saved trauma entry, then click Save Changes."
              : "Document trauma encounters with triage criteria, treatments, and vascular access."}
          </p>

          <form className="mt-4 space-y-3" onSubmit={handleTraumaSubmit}>
            <label className="field-label">
              Battalion
              <select
                className="field-input"
                value={traumaBattalion}
                onChange={(e) => {
                  const next = e.target.value as Battalion;
                  setTraumaBattalion(next);
                  const nextStations =
                    next === "b5"
                      ? traumaStationsForSelectedBattalion
                      : battalionStationIds[next]
                          .map((id) => stations.find((s) => s.id === id))
                          .filter((s): s is Station => Boolean(s));
                  setTraumaPrimaryResponseTerritoryId(nextStations[0]?.id ?? stations[0]?.id ?? "");
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

            <label className="field-label">
              Primary Response Territory
              <select
                className="field-input"
                value={traumaPrimaryResponseTerritoryId}
                onChange={(e) => setTraumaPrimaryResponseTerritoryId(e.target.value)}
                required
              >
                {traumaStationsForSelectedBattalion.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Shift
              <select
                className="field-input"
                value={traumaShift}
                onChange={(e) => setTraumaShift(e.target.value as Shift)}
              >
                {shifts.map((shiftOption) => (
                  <option key={shiftOption} value={shiftOption}>
                    {shiftOption}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              ImageTrend Incident Link
              <input
                className="field-input"
                value={traumaImageTrendIncidentLink}
                onChange={(e) => setTraumaImageTrendIncidentLink(e.target.value)}
                placeholder="Paste full ImageTrend incident link"
                required
              />
            </label>

            <div className="field-label">
              Call Date/Time
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  className="field-input"
                  type="date"
                  value={splitInputDateTime(traumaCallDateTime).date}
                  onChange={(e) =>
                    setTraumaCallDateTime(
                      combineInputDateTime(
                        e.target.value,
                        splitInputDateTime(traumaCallDateTime).time,
                      ),
                    )
                  }
                  required
                />
                <TimeSelect24
                  value={splitInputDateTime(traumaCallDateTime).time}
                  onChange={(time) =>
                    setTraumaCallDateTime(
                      combineInputDateTime(splitInputDateTime(traumaCallDateTime).date, time),
                    )
                  }
                  required
                  aria-label="Call time (24-hour)"
                />
              </div>
              <p className="form-panel-hint">24-hour clock — select hour (00–23) and minute.</p>
            </div>

            <label className="field-label">
              Patient Age
              <input
                className="field-input"
                type="number"
                min={0}
                value={traumaPatientAge}
                onChange={(e) => setTraumaPatientAge(e.target.value)}
                placeholder="Example: 67"
              />
            </label>

            <div className="form-panel">
              <p className="form-panel-title">Trauma criteria</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="field-label">
                  Trauma Center
                  <select
                    className="field-input"
                    value={traumaCenterCriteria}
                    onChange={(e) => setTraumaCenterCriteria(e.target.value as "" | "yes" | "no")}
                    required
                  >
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className="field-label">
                  Trauma Triage
                  <select
                    className="field-input"
                    value={traumaTriageCriteria}
                    onChange={(e) => setTraumaTriageCriteria(e.target.value as "" | "yes" | "no")}
                    required
                  >
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="form-panel">
              <p className="form-panel-title">Medications administered</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  className="field-input-sm min-w-40 flex-1"
                  value={traumaSelectedMedicationId}
                  onChange={(e) => setTraumaSelectedMedicationId(e.target.value)}
                >
                  {traumaMedicationOptions.map((med) => (
                    <option key={med.id} value={med.id}>{med.name}</option>
                  ))}
                </select>
                <input
                  className="field-input-sm min-w-28 flex-1"
                  value={traumaSelectedMedicationDosage}
                  onChange={(e) => setTraumaSelectedMedicationDosage(e.target.value)}
                  placeholder="Dosage (e.g. 1 g, 2 units)"
                />
                <button
                  className="btn-toolbar-primary text-sm"
                  type="button"
                  onClick={addTraumaMedication}
                >
                  Add Med
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {traumaMedicationsAdministered.map((entry, index) => (
                  <li key={`${entry.medicationId}-${index}`} className="flex justify-between gap-2">
                    <span>{entry.medicationName}: {entry.amount}</span>
                    <button
                      type="button"
                      className="btn-action"
                      onClick={() => removeTraumaMedicationAt(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <label className="mt-2 block text-sm">
                Other medication/details
                <input
                  className="field-input"
                  value={traumaMedicationOtherText}
                  onChange={(e) => setTraumaMedicationOtherText(e.target.value)}
                  placeholder="Anything outside preset list"
                />
              </label>
            </div>

            <div className="form-panel">
              <p className="form-panel-title">Procedures</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  className="field-input-sm min-w-48 flex-1"
                  value={traumaSelectedProcedureId}
                  onChange={(e) => setTraumaSelectedProcedureId(e.target.value)}
                >
                  {traumaProcedureOptions.map((proc) => (
                    <option key={proc.id} value={proc.id}>{proc.name}</option>
                  ))}
                </select>
                <button
                  className="btn-toolbar-primary text-sm"
                  type="button"
                  onClick={addTraumaProcedure}
                >
                  Add Procedure
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {traumaProceduresPerformed.map((entry, index) => (
                  <li key={`${entry.procedureId}-${index}`} className="flex justify-between gap-2">
                    <span>{entry.procedureName}</span>
                    <button
                      type="button"
                      className="btn-action"
                      onClick={() => removeTraumaProcedureAt(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <label className="mt-2 block text-sm">
                Other procedure/details
                <input
                  className="field-input"
                  value={traumaProcedureOtherText}
                  onChange={(e) => setTraumaProcedureOtherText(e.target.value)}
                  placeholder="Anything outside preset list"
                />
              </label>
            </div>

            <div className="form-panel">
              <p className="form-panel-title">IV or IO access</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select
                  className="field-input-sm"
                  value={traumaAccessTypeInput}
                  onChange={(e) => setTraumaAccessTypeInput(e.target.value as "iv" | "io")}
                >
                  <option value="iv">IV</option>
                  <option value="io">IO</option>
                </select>
                <select
                  className="field-input-sm"
                  value={traumaAccessLocationInput}
                  onChange={(e) => setTraumaAccessLocationInput(e.target.value)}
                >
                  <option value="">Location</option>
                  {traumaAccessTypeInput === "iv" ? (
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
                {traumaAccessTypeInput === "iv" && traumaAccessLocationInput === "other" ? (
                  <input
                    className="field-input-sm"
                    value={traumaAccessLocationOtherInput}
                    onChange={(e) => setTraumaAccessLocationOtherInput(e.target.value)}
                    placeholder="Enter location"
                  />
                ) : (
                  <select
                    className="field-input-sm"
                    value={traumaAccessSizeInput}
                    onChange={(e) => setTraumaAccessSizeInput(e.target.value)}
                  >
                    <option value="">Size</option>
                    {traumaAccessTypeInput === "iv" ? (
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
                {traumaAccessTypeInput === "iv" && traumaAccessLocationInput === "other" ? (
                  <select
                    className="field-input-sm"
                    value={traumaAccessSizeInput}
                    onChange={(e) => setTraumaAccessSizeInput(e.target.value)}
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
                  className="btn-toolbar-primary text-sm"
                  type="button"
                  onClick={addTraumaVascularAccess}
                >
                  Add Access
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {traumaVascularAccess.map((entry, index) => (
                  <li key={`${entry.type}-${entry.location}-${entry.size}-${index}`} className="flex justify-between gap-2">
                    <span>{entry.type.toUpperCase()} - {entry.location} ({entry.size})</span>
                    <button
                      type="button"
                      className="btn-action"
                      onClick={() => removeTraumaVascularAccessAt(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>


            <div className="flex flex-wrap gap-2">
              {editingTraumaRunId ? (
                <button
                  className="btn-toolbar flex-1"
                  type="button"
                  onClick={resetTraumaForm}
                  disabled={isSavingTrauma}
                >
                  Cancel Edit
                </button>
              ) : null}
              <button
                className="btn-submit flex-1"
                type="submit"
                disabled={isSavingTrauma}
              >
                {isSavingTrauma
                  ? "Saving..."
                  : editingTraumaRunId
                    ? "Save Changes"
                    : "Save Trauma Run"}
              </button>
            </div>
          </form>
        </section>

        <section className="card lg:col-span-2">
          <h2 className="card-title">Unit Dashboard</h2>
          <p className="card-description">Review, filter, and export QA records for your organization.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            <label className="field-label-filter">
              Battalion Filter
              <select
                className="field-input"
                value={traumaBattalionFilter}
                onChange={(e) => setTraumaBattalionFilter(e.target.value as "all" | Battalion)}
              >
                <option value="all">All Battalions</option>
                {battalionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label-filter">
              Unit Filter
              <select
                className="field-input"
                value={traumaStationFilter}
                onChange={(e) => setTraumaStationFilter(e.target.value)}
              >
                <option value="all">All Units</option>
                {traumaStationsForBattalionFilter.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-label-filter">
              <span className="block">Criteria Filters</span>
              <div className="filter-criteria-grid">
                <select
                  className="field-input-compact"
                  value={traumaCenterFilter}
                  onChange={(e) => setTraumaCenterFilter(e.target.value as RoscFilter)}
                  aria-label="Trauma Center Filter"
                >
                  <option value="all">Center: All</option>
                  <option value="yes">Center: Yes</option>
                  <option value="no">Center: No</option>
                </select>
                <select
                  className="field-input-compact"
                  value={traumaTriageFilter}
                  onChange={(e) => setTraumaTriageFilter(e.target.value as RoscFilter)}
                  aria-label="Trauma Triage Filter"
                >
                  <option value="all">Triage: All</option>
                  <option value="yes">Triage: Yes</option>
                  <option value="no">Triage: No</option>
                </select>
              </div>
            </div>

            <label className="field-label-filter">
              Start Date
              <input
                className="field-input"
                type="date"
                value={traumaStartDate}
                onChange={(e) => setTraumaStartDate(e.target.value)}
              />
            </label>

            <label className="field-label-filter">
              End Date
              <input
                className="field-input"
                type="date"
                value={traumaEndDate}
                onChange={(e) => setTraumaEndDate(e.target.value)}
              />
            </label>

            <label className="field-label-filter">
              Medication Filter
              <select
                className="field-input"
                value={traumaMedicationFilter}
                onChange={(e) => setTraumaMedicationFilter(e.target.value)}
              >
                <option value="all">All Medications</option>
                {traumaMedicationOptions.map((med) => {
                  const usage = traumaMedicationUsageById.get(med.id);
                  const countLabel = usage ? ` (${usage.administrations})` : "";
                  return (
                    <option key={med.id} value={med.id}>
                      {med.name}
                      {countLabel}
                    </option>
                  );
                })}
                {traumaMedicationUsageById.has("__other__") ? (
                  <option value="__other__">
                    Other ({traumaMedicationUsageById.get("__other__")!.administrations})
                  </option>
                ) : null}
              </select>
            </label>

            <div className="field-label-filter md:col-span-2 xl:col-span-2">
              Procedure Filter
              <div className="mt-1.5 flex flex-wrap items-stretch gap-2">
                <select
                  className="field-input min-w-0 flex-1"
                  value={traumaProcedureFilter}
                  onChange={(e) => setTraumaProcedureFilter(e.target.value)}
                >
                  <option value="all">All Procedures</option>
                  {traumaProcedureOptions.map((proc) => {
                    const usage = traumaProcedureUsageById.get(proc.id);
                    const countLabel = usage ? ` (${usage.count})` : "";
                    return (
                      <option key={proc.id} value={proc.id}>
                        {proc.name}
                        {countLabel}
                      </option>
                    );
                  })}
                  {traumaProcedureUsageById.has("__other__") ? (
                    <option value="__other__">
                      Other ({traumaProcedureUsageById.get("__other__")!.count})
                    </option>
                  ) : null}
                </select>
                <input
                  ref={traumaImportInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file) void handleImportCsvFile(file, "trauma");
                  }}
                />
                <button
                  type="button"
                  className="btn-toolbar-primary shrink-0"
                  onClick={() => traumaImportInputRef.current?.click()}
                  disabled={isImportingCsv || isExportingPdf || isExportingCsv}
                  title="Import trauma runs from a CSV exported from Excel"
                >
                  {isImportingCsv ? "Importing…" : "Import CSV"}
                </button>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    className="btn-toolbar-primary"
                    onClick={() => setIsTraumaExportMenuOpen((prev) => !prev)}
                    disabled={isExportingPdf || isExportingCsv}
                    aria-haspopup="menu"
                    aria-expanded={isTraumaExportMenuOpen}
                  >
                    {isExportingPdf || isExportingCsv ? "Exporting…" : "Export"}
                  </button>

                  {isTraumaExportMenuOpen ? (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        role="presentation"
                        onClick={() => setIsTraumaExportMenuOpen(false)}
                      />
                      <div
                        role="menu"
                        aria-label="Trauma export options"
                        className="export-menu"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="export-menu-item"
                          onClick={() => {
                            setIsTraumaExportMenuOpen(false);
                            void handleExportTraumaPdf();
                          }}
                        >
                          Export PDF
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="export-menu-item"
                          onClick={() => {
                            setIsTraumaExportMenuOpen(false);
                            void handleExportTraumaUsageCsv();
                          }}
                        >
                          Export Usage Summary CSV
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="export-menu-item"
                          onClick={() => {
                            setIsTraumaExportMenuOpen(false);
                            void handleExportTraumaCsv();
                          }}
                        >
                          Export CSV (Excel)
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            <button
              type="button"
              className="btn-toolbar-secondary"
              onClick={clearTraumaDashboardFilters}
            >
              Clear Filters
            </button>
          </div>

          {importProgressText && activeModule === "trauma" ? (
            <p className="mt-2 text-center text-xs text-zinc-600">{importProgressText}</p>
          ) : null}

          {selectedTraumaMedicationUsage || selectedTraumaProcedureUsage ? (
            <p className="mt-3 text-center text-sm text-zinc-700">
              {selectedTraumaMedicationUsage ? (
                <span>
                  <span className="font-medium">{selectedTraumaMedicationUsage.label}</span>
                  {": "}
                  {selectedTraumaMedicationUsage.administrations} administration
                  {selectedTraumaMedicationUsage.administrations === 1 ? "" : "s"} across{" "}
                  {selectedTraumaMedicationUsage.runs} run
                  {selectedTraumaMedicationUsage.runs === 1 ? "" : "s"}
                </span>
              ) : null}
              {selectedTraumaMedicationUsage && selectedTraumaProcedureUsage ? (
                <span className="mx-2 text-zinc-400">·</span>
              ) : null}
              {selectedTraumaProcedureUsage ? (
                <span>
                  <span className="font-medium">{selectedTraumaProcedureUsage.label}</span>
                  {": "}
                  {selectedTraumaProcedureUsage.count} time
                  {selectedTraumaProcedureUsage.count === 1 ? "" : "s"} across{" "}
                  {selectedTraumaProcedureUsage.runs} run
                  {selectedTraumaProcedureUsage.runs === 1 ? "" : "s"}
                </span>
              ) : null}
              {(traumaStartDate || traumaEndDate) ? (
                <span className="text-zinc-500">
                  {" "}
                  (within selected date range)
                </span>
              ) : null}
            </p>
          ) : null}

          <div className="mt-4 w-full overflow-x-auto">
            <table className="data-table data-table-centered">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="p-2">Date/Time</th>
                  <th className="hidden p-2 sm:table-cell">Primary Territory</th>
                  <th className="p-2">ImageTrend Incident #</th>
                  <th className="hidden p-2 md:table-cell">Patient Age</th>
                  <th className="hidden p-2 md:table-cell">Shift</th>
                  <th className="hidden p-2 lg:table-cell">Center Det.</th>
                  <th className="hidden p-2 lg:table-cell">Triage Det.</th>
                  <th className="hidden p-2 xl:table-cell">Medications</th>
                  <th className="hidden p-2 xl:table-cell">Procedures</th>
                  <th className="hidden p-2 sm:table-cell">Category</th>
                  <th className="p-2">Center</th>
                  <th className="hidden p-2 sm:table-cell">Triage</th>
                  <th className="p-2 min-w-[9.5rem]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTraumaRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50/90"
                    onClick={() => setNotesRun(run)}
                  >
                    <td className="p-2">{formatDateTime24(run.callDateTime)}</td>
                    <td className="hidden p-2 sm:table-cell">{run.primaryResponseTerritoryName}</td>
                    <td className="p-2" onClick={(event) => event.stopPropagation()}>
                      {getImageTrendHref(run.runNumber, run.imageTrendIncidentLink) ? (
                        <a
                          href={getImageTrendHref(run.runNumber, run.imageTrendIncidentLink)!}
                          target="_blank"
                          rel="noreferrer"
                          className="link-incident"
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
                    <td className="hidden p-2 text-zinc-700 lg:table-cell">
                      {formatYesNo(run.traumaCenterCriteriaSelected)}
                    </td>
                    <td className="hidden p-2 text-zinc-700 lg:table-cell">
                      {formatYesNo(run.traumaTriageCriteriaSelected)}
                    </td>
                    <td className="hidden p-2 text-zinc-700 xl:table-cell">
                      {formatTraumaMedications(run) || "—"}
                    </td>
                    <td className="hidden p-2 text-zinc-700 xl:table-cell">
                      {formatTraumaProcedures(run) || "—"}
                    </td>
                    <td className="hidden p-2 sm:table-cell">
                      <Badge tone="amber">Trauma</Badge>
                    </td>
                    <td className="p-2">
                      <span
                        className={
                          run.traumaCenterCriteriaSelected
                            ? "rounded-md bg-emerald-100 px-2 py-1 text-emerald-700"
                            : "rounded-md bg-red-100 px-2 py-1 text-red-700"
                        }
                      >
                        {run.traumaCenterCriteriaSelected ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="hidden p-2 sm:table-cell">
                      <span
                        className={
                          run.traumaTriageCriteriaSelected
                            ? "rounded-md bg-red-100 px-2 py-1 text-red-700"
                            : "rounded-md px-2 py-1 text-zinc-600"
                        }
                      >
                        {run.traumaTriageCriteriaSelected ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="p-2" onClick={(event) => event.stopPropagation()}>
                      <div className="data-table-actions">
                        <button
                          type="button"
                          className="btn-action"
                          onClick={() => loadTraumaRunForEdit(run)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-action"
                          onClick={() => setNotesRun(run)}
                        >
                          Notes
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-action-danger disabled:opacity-50"
                          disabled={deletingId === run.id}
                          onClick={() => void handleDeleteRun(run)}
                        >
                          {deletingId === run.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedTraumaRuns.length === 0 && (
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
      )}

      {notesRun && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setNotesRun(null)}
        >
          <div
            className="modal-panel max-h-[min(80vh,28rem)] max-w-lg overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="run-notes-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 id="run-notes-title" className="text-base font-semibold text-slate-900">
                Incident details
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {notesRun.primaryResponseTerritoryName} · Incident {notesRun.runNumber} ·{" "}
                {formatDateTime24(notesRun.callDateTime)}
              </p>
            </div>
            <div className="max-h-[min(60vh,20rem)] space-y-4 overflow-y-auto px-4 py-3">
              {notesRun.runType === "trauma" ? (
                <>
                  <div className="text-sm">
                    <p className="font-medium text-zinc-700">Trauma</p>
                    <p className="mt-1 text-zinc-800">
                      Territory: {notesRun.primaryResponseTerritoryName} · Shift: {notesRun.shift} ·
                      Patient age: {notesRun.patientAge ?? "—"}
                    </p>
                    <p className="mt-1 text-zinc-800">
                      Trauma Center criteria: {formatYesNo(notesRun.traumaCenterCriteriaSelected)} ·
                      Trauma Triage criteria: {formatYesNo(notesRun.traumaTriageCriteriaSelected)}
                    </p>
                  </div>
                  {(notesRun.medicationsAdministered?.length > 0 || !!notesRun.traumaMedicationsText?.trim()) && (
                    <div className="text-sm">
                      <p className="font-medium text-zinc-700">Medications administered</p>
                      {notesRun.medicationsAdministered?.length > 0 ? (
                        <ul className="mt-1 list-inside list-disc text-zinc-800">
                          {notesRun.medicationsAdministered.map((med, idx) => (
                            <li key={`${med.medicationId}-${idx}`}>
                              {med.medicationName}: {med.amount}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-zinc-800">
                          {notesRun.traumaMedicationsText}
                        </p>
                      )}
                      {!!notesRun.medicationOtherText && (
                        <p className="mt-1 text-zinc-800">
                          Other: {notesRun.medicationOtherText}
                        </p>
                      )}
                    </div>
                  )}
                  {((notesRun.traumaProcedures?.length ?? 0) > 0 || !!notesRun.traumaProceduresText?.trim()) && (
                    <div className="text-sm">
                      <p className="font-medium text-zinc-700">Procedures</p>
                      {(notesRun.traumaProcedures?.length ?? 0) > 0 ? (
                        <ul className="mt-1 list-inside list-disc text-zinc-800">
                          {(notesRun.traumaProcedures ?? []).map((proc, idx) => (
                            <li key={`${proc.procedureId}-${idx}`}>{proc.procedureName}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-zinc-800">
                          {notesRun.traumaProceduresText}
                        </p>
                      )}
                      {!!notesRun.traumaProcedureOtherText && (
                        <p className="mt-1 text-zinc-800">
                          Other: {notesRun.traumaProcedureOtherText}
                        </p>
                      )}
                    </div>
                  )}
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
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                className="btn-toolbar-primary"
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

function formatYesNo(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
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

function formatTraumaProcedures(run: RunRecord): string {
  const items = run.traumaProcedures?.map((entry) => entry.procedureName) ?? [];
  const parts = [...items];
  if (run.traumaProcedureOtherText?.trim()) {
    parts.push(`Other: ${run.traumaProcedureOtherText.trim()}`);
  }
  if (parts.length) return parts.join("; ");
  return run.traumaProceduresText?.trim() || "";
}

function formatTraumaMedications(run: RunRecord): string {
  if (run.medicationsAdministered?.length) {
    return formatMedications(run.medicationsAdministered);
  }
  return run.traumaMedicationsText?.trim() || "";
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

type TraumaMedicationUsage = {
  label: string;
  administrations: number;
  runs: number;
};

type TraumaProcedureUsage = {
  label: string;
  count: number;
  runs: number;
};

function buildTraumaMedicationUsageMap(
  runs: RunRecord[],
): Map<string, TraumaMedicationUsage> {
  const usage = new Map<string, TraumaMedicationUsage>();

  for (const run of runs) {
    const seenInRun = new Set<string>();
    for (const med of run.medicationsAdministered ?? []) {
      if (!med.medicationId) continue;
      const administrations = Number.isFinite(med.administrations) ? med.administrations : 1;
      const existing = usage.get(med.medicationId);
      if (existing) {
        existing.administrations += administrations;
        if (!seenInRun.has(med.medicationId)) {
          existing.runs += 1;
          seenInRun.add(med.medicationId);
        }
      } else {
        usage.set(med.medicationId, {
          label: med.medicationName,
          administrations,
          runs: 1,
        });
        seenInRun.add(med.medicationId);
      }
    }

    if (run.medicationOtherText?.trim()) {
      const existing = usage.get("__other__");
      if (existing) {
        existing.administrations += 1;
        existing.runs += 1;
      } else {
        usage.set("__other__", {
          label: "Other",
          administrations: 1,
          runs: 1,
        });
      }
    }
  }

  return usage;
}

function buildTraumaProcedureUsageMap(runs: RunRecord[]): Map<string, TraumaProcedureUsage> {
  const usage = new Map<string, TraumaProcedureUsage>();

  for (const run of runs) {
    const seenInRun = new Set<string>();
    for (const proc of run.traumaProcedures ?? []) {
      if (!proc.procedureId) continue;
      const existing = usage.get(proc.procedureId);
      if (existing) {
        existing.count += 1;
        if (!seenInRun.has(proc.procedureId)) {
          existing.runs += 1;
          seenInRun.add(proc.procedureId);
        }
      } else {
        usage.set(proc.procedureId, {
          label: proc.procedureName,
          count: 1,
          runs: 1,
        });
        seenInRun.add(proc.procedureId);
      }
    }

    if (run.traumaProcedureOtherText?.trim()) {
      const existing = usage.get("__other__");
      if (existing) {
        existing.count += 1;
        existing.runs += 1;
      } else {
        usage.set("__other__", {
          label: "Other",
          count: 1,
          runs: 1,
        });
      }
    }
  }

  return usage;
}

function runMatchesTraumaMedicationFilter(run: RunRecord, medicationId: string): boolean {
  if (medicationId === "__other__") {
    return Boolean(run.medicationOtherText?.trim());
  }
  return (run.medicationsAdministered ?? []).some((med) => med.medicationId === medicationId);
}

function runMatchesTraumaProcedureFilter(run: RunRecord, procedureId: string): boolean {
  if (procedureId === "__other__") {
    return Boolean(run.traumaProcedureOtherText?.trim());
  }
  return (run.traumaProcedures ?? []).some((proc) => proc.procedureId === procedureId);
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

function splitInputDateTime(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date, timePart] = value.split("T");
  return { date: date ?? "", time: (timePart ?? "").slice(0, 5) };
}

function combineInputDateTime(date: string, time: string): string {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

function formatDateTime24(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(
      value.getHours(),
    )}:${pad(value.getMinutes())}`;
  }

  const trimmed = value.trim();
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(trimmed);
  if (localMatch) {
    return `${localMatch[1]}-${localMatch[2]}-${localMatch[3]} ${localMatch[4]}:${localMatch[5]}`;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
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
