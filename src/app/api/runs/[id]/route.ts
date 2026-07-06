import { NextResponse } from "next/server";

import { buildRunFromPayload, type CreateRunPayload } from "@/lib/build-run-from-payload";
import { isDatabaseEnabled } from "@/lib/db";
import { dbDeleteRun, dbGetOptions, dbGetRuns, dbUpdateRun } from "@/lib/db-store";
import { readDb, writeDb } from "@/lib/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Run id is required." }, { status: 400 });
  }

  if (isDatabaseEnabled()) {
    const ok = await dbDeleteRun(id);
    if (!ok) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const db = await readDb();
  const index = db.runs.findIndex((run) => run.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  db.runs.splice(index, 1);
  await writeDb(db);

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Run id is required." }, { status: 400 });
  }

  const payload = (await request.json()) as CreateRunPayload;
  const db = isDatabaseEnabled() ? await dbReadCompat() : await readDb();
  const existingRun = db.runs.find((run) => run.id === id);
  if (!existingRun) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  const payloadWithItems: CreateRunPayload = {
    ...payload,
    itemsUsed:
      payload.itemsUsed?.length > 0
        ? payload.itemsUsed
        : (existingRun.itemsUsed || []).map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            size: item.size,
          })),
  };

  const result = buildRunFromPayload(payloadWithItems, db, existingRun);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (isDatabaseEnabled()) {
    const ok = await dbUpdateRun(result.run);
    if (!ok) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  } else {
    const index = db.runs.findIndex((run) => run.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }
    db.runs[index] = result.run;
    await writeDb(db);
  }

  return NextResponse.json({ run: result.run });
}

async function dbReadCompat() {
  const { stations, items } = await dbGetOptions();
  const runs = await dbGetRuns();
  return { stations, items, runs };
}
