import { NextResponse } from "next/server";
import { z } from "zod";

import { generateSummary } from "@/lib/ai/provider";
import { getNotebookSnapshot, getSettings, upsertNote } from "@/lib/db/queries";

const summarySchema = z.object({
  markdown: z.string().optional(),
  modelKey: z.string().optional(),
  sourceIds: z.array(z.string()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = summarySchema.parse(await request.json());
  const snapshot = getNotebookSnapshot(id);

  if (!snapshot) {
    return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
  }

  const settings = getSettings();
  const markdown =
    payload.markdown ??
    (await generateSummary(
      id,
      payload.modelKey ?? settings.chatModel,
      payload.sourceIds,
    ));

  upsertNote(id, markdown);
  return NextResponse.json({ markdown });
}
