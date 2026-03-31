import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EMSDatabase, SupplyItem } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "ems-db.json");

const stationDefaults = [
  ...Array.from({ length: 28 }, (_, idx) => ({
    id: `st-${idx + 1}`,
    name: `Station ${idx + 1}`,
  })),
  { id: "st-30", name: "Station 30" },
];

export const cardiacSupplyCatalog: SupplyItem[] = [
  { id: "item-aed-pads", name: "AED pads" },
  { id: "item-req-pump", name: "RESQ Pump" },
  { id: "item-io", name: "IO" },
  { id: "item-intubation", name: "Intubation" },
  { id: "item-oxygen-mask", name: "Oxygen Mask" },
  { id: "item-iv-kit", name: "IV Kit" },
];

const defaultData: EMSDatabase = {
  stations: stationDefaults,
  items: [...cardiacSupplyCatalog],
  runs: [],
};

export async function readDb(): Promise<EMSDatabase> {
  await mkdir(dataDir, { recursive: true });

  try {
    const contents = await readFile(dbPath, "utf-8");
    const parsed = JSON.parse(contents) as EMSDatabase;

    // One-time migration from initial two-station seed data.
    if (parsed.stations.length <= 2) {
      parsed.stations = stationDefaults;
      await writeDb(parsed);
    }

    // Replace legacy supply list (e.g. gloves) with cardiac arrest catalog.
    const hasLegacyGloves = parsed.items.some((i) => i.id === "item-gloves");
    const hasNewCatalog = parsed.items.some((i) => i.id === "item-aed-pads");
    if (hasLegacyGloves || !hasNewCatalog) {
      parsed.items = [...cardiacSupplyCatalog];
      await writeDb(parsed);
    }

    // Rename display label Req pump → RESQ Pump (catalog + saved line item names).
    let renamedReqPump = false;
    for (const item of parsed.items) {
      if (item.id === "item-req-pump" && item.name === "Req pump") {
        item.name = "RESQ Pump";
        renamedReqPump = true;
      }
    }
    for (const run of parsed.runs) {
      for (const line of run.itemsUsed ?? []) {
        if (line.itemId === "item-req-pump" && line.itemName === "Req pump") {
          line.itemName = "RESQ Pump";
          renamedReqPump = true;
        }
      }
    }
    if (renamedReqPump) {
      await writeDb(parsed);
    }

    return parsed;
  } catch {
    await writeDb(defaultData);
    return defaultData;
  }
}

export async function writeDb(data: EMSDatabase): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(data, null, 2), "utf-8");
}
