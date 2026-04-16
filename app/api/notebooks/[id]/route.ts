import { NextResponse } from "next/server";

import { deleteNotebook, getNotebookSnapshot } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const snapshot = getNotebookSnapshot(id);

  if (!snapshot) {
    return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteNotebook(id);
  return NextResponse.json({ ok: true });
}
