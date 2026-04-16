import { NextResponse } from "next/server";
import fs from "node:fs";
import { z } from "zod";

import { deleteSource, getSourceDetail, updateSource } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const updateSourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = getSourceDetail(id);

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json(source);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = getSourceDetail(id);

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  source.assets.forEach((asset) => {
    if (!/^https?:\/\//.test(asset.filePath) && fs.existsSync(asset.filePath)) {
      fs.rmSync(asset.filePath, { force: true });
    }
  });

  deleteSource(id);
  return NextResponse.json({ ok: true, notebookId: source.notebookId });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = getSourceDetail(id);

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const payload = updateSourceSchema.parse(await request.json());
  updateSource(id, { title: payload.title });

  return NextResponse.json({ source: getSourceDetail(id) });
}
