import { NextResponse } from "next/server";

import { isDatabaseEnabled } from "@/lib/db";
import { dbGetOptions } from "@/lib/db-store";
import { readDb } from "@/lib/store";

export async function GET() {
  if (isDatabaseEnabled()) {
    const { stations, items } = await dbGetOptions();
    return NextResponse.json({ stations, items });
  }

  const db = await readDb();
  return NextResponse.json({
    stations: db.stations,
    items: db.items,
  });
}
