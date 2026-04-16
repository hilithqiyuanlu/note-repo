import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteNotebook, getNotebookSnapshot, updateNotebook } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const updateNotebookSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(280).nullable().optional(),
});

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = updateNotebookSchema.parse(await request.json());
  const snapshot = updateNotebook(id, payload);

  if (!snapshot) {
    return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}
