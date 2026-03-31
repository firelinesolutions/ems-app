import "server-only";

import type { EMSDatabase, RunRecord, SupplyItem, Station } from "@/lib/types";
import { cardiacSupplyCatalog } from "@/lib/store";
import { sql } from "@/lib/db";

const stationDefaults: Station[] = [
  ...Array.from({ length: 28 }, (_, idx) => ({
    id: `st-${idx + 1}`,
    name: `Station ${idx + 1}`,
  })),
  { id: "st-30", name: "Station 30" },
];

export async function ensureDbSchema(): Promise<void> {
  await sql`
    create table if not exists stations (
      id text primary key,
      name text not null
    );
  `;
  await sql`
    create table if not exists items (
      id text primary key,
      name text not null
    );
  `;
  await sql`
    create table if not exists runs (
      id text primary key,
      call_date_time timestamptz not null,
      created_at timestamptz not null,
      run jsonb not null
    );
  `;
}

export async function ensureDbSeed(): Promise<void> {
  await ensureDbSchema();

  const stationsCount = await sql<{ count: string }>`select count(*) as count from stations;`;
  if (Number(stationsCount[0]?.count ?? 0) === 0) {
    for (const st of stationDefaults) {
      await sql`insert into stations (id, name) values (${st.id}, ${st.name});`;
    }
  }

  const itemsCount = await sql<{ count: string }>`select count(*) as count from items;`;
  if (Number(itemsCount[0]?.count ?? 0) === 0) {
    for (const item of cardiacSupplyCatalog) {
      await sql`insert into items (id, name) values (${item.id}, ${item.name});`;
    }
  }
}

export async function dbGetOptions(): Promise<{ stations: Station[]; items: SupplyItem[] }> {
  await ensureDbSeed();
  const stations = await sql<Station>`select id, name from stations order by id asc;`;
  const items = await sql<SupplyItem>`select id, name from items order by id asc;`;
  return { stations, items };
}

export async function dbGetRuns(): Promise<RunRecord[]> {
  await ensureDbSeed();
  const rows = await sql<{ run: RunRecord }>`select run from runs order by call_date_time desc;`;
  return rows.map((r) => r.run);
}

export async function dbInsertRun(run: RunRecord): Promise<void> {
  await ensureDbSeed();
  await sql`
    insert into runs (id, call_date_time, created_at, run)
    values (${run.id}, ${run.callDateTime}, ${run.createdAt}, ${run as unknown as object})
  `;
}

export async function dbDeleteRun(id: string): Promise<boolean> {
  await ensureDbSeed();
  const before = await sql<{ count: string }>`select count(*) as count from runs where id = ${id};`;
  const existed = Number(before[0]?.count ?? 0) > 0;
  if (!existed) return false;
  await sql`delete from runs where id = ${id};`;
  return true;
}

export async function dbReadAsJsonDb(): Promise<EMSDatabase> {
  const { stations, items } = await dbGetOptions();
  const runs = await dbGetRuns();
  return { stations, items, runs };
}

