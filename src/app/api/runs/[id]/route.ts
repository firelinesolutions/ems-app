import { NextResponse } from "next/server";

import { readDb, writeDb } from "@/lib/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Run id is required." }, { status: 400 });
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
