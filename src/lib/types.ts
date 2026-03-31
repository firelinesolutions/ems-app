export type Shift = "A" | "B" | "C";
export type OutcomeCategory = "win" | "needs-improvement" | "negative";
export type ArrestWitnessing = "witnessed" | "unwitnessed";
export type PatientAgeCategory = "adult" | "pediatric";
export type PatientDisposition = "transport" | "rosc-transport" | "ceased-efforts";
export type AirwayAdjunctType = "bvm" | "npa" | "opa" | "i-gel" | "ett";
export type VascularAccessType = "iv" | "io";

/** IO, intubation, and IV kit lines require a size when added to a run. */
export const SUPPLY_ITEM_IDS_REQUIRING_SIZE = [
  "item-io",
  "item-intubation",
  "item-iv-kit",
] as const;

export function supplyItemRequiresSize(itemId: string): boolean {
  return (SUPPLY_ITEM_IDS_REQUIRING_SIZE as readonly string[]).includes(itemId);
}

export function supplyItemSizeFieldMeta(itemId: string): { label: string; placeholder: string } {
  switch (itemId) {
    case "item-io":
      return { label: "IO size", placeholder: "e.g. 15g, 45mm" };
    case "item-intubation":
      return { label: "Intubation size", placeholder: "e.g. 7.5 ETT, 6.5" };
    case "item-iv-kit":
      return { label: "IV size", placeholder: "e.g. 18g, 20g" };
    default:
      return { label: "Size", placeholder: "" };
  }
}

export type Station = {
  id: string;
  name: string;
};

export type SupplyItem = {
  id: string;
  name: string;
};

export type UsedItemInput = {
  itemId: string;
  quantity: number;
  /** Required for IO, intubation, and IV kit (see SUPPLY_ITEM_IDS_REQUIRING_SIZE). */
  size?: string;
};

export type UsedItemRecord = {
  itemId: string;
  itemName: string;
  quantity: number;
  /** Size for IO, intubation, or IV (gauge, ETT, etc.). */
  size?: string;
};

export type MedicationRecord = {
  medicationId: string;
  medicationName: string;
  amount: string;
  administrations: number;
};

export type AirwayAdjunctRecord = {
  type: AirwayAdjunctType;
  size?: string;
};

export type VascularAccessRecord = {
  type: VascularAccessType;
  location: string;
  size: string;
};

export type RunRecord = {
  id: string;
  primaryResponseTerritoryId: string;
  primaryResponseTerritoryName: string;
  stationId: string;
  stationName: string;
  patientAge: number | null;
  runNumber: string;
  imageTrendIncidentLink: string;
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
  medicationOtherText: string;
  incidentSummary: string;
  qiIssuesIdentified: boolean;
  qiIssueSummary: string;
  defibPadsAppliedTime: string;
  compressionsStartedTime: string;
  defibrillationTime: string;
  zollRecordLink: string;
  rhythmStripImageDataUrl: string;
  outcomeCategory: OutcomeCategory;
  /** Mutually exclusive with unwitnessed; null if not selected. */
  arrestWitnessing: ArrestWitnessing | null;
  /** Patient age group for the arrest. */
  patientAgeCategory: PatientAgeCategory | null;
  /** @deprecated Kept for backwards compatibility with older records. */
  notes: string;
  itemsUsed: UsedItemRecord[];
  createdAt: string;
};

export type EMSDatabase = {
  stations: Station[];
  items: SupplyItem[];
  runs: RunRecord[];
};
