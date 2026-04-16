import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { getNotebookSnapshot, getSettings } from "@/lib/db/queries";
import { getExportsRoot } from "@/lib/storage";
import { slugify } from "@/lib/utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const snapshot = getNotebookSnapshot(id);

  if (!snapshot) {
    return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
  }

  const settings = getSettings();
  const exportDir = settings.exportDir || getExportsRoot();
  await fs.mkdir(exportDir, { recursive: true });
  const filePath = path.join(exportDir, `${slugify(snapshot.notebook.title || id)}.md`);
  await fs.writeFile(filePath, snapshot.note?.markdown || "", "utf8");

  return NextResponse.json({ filePath });
}
