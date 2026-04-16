import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotebook, listNotebooks } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const createNotebookSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(200).optional(),
});

export async function GET() {
  return NextResponse.json({ notebooks: listNotebooks() });
}

export async function POST(request: Request) {
  const payload = createNotebookSchema.parse(await request.json());
  const snapshot = createNotebook(payload);
  return NextResponse.json({ notebook: snapshot }, { status: 201 });
}
