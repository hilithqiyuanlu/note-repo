import { NextResponse } from "next/server";
import { z } from "zod";

import { getSettings, updateSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  chatProvider: z.string().min(1),
  chatBaseUrl: z.string().nullable(),
  chatApiKey: z.string().nullable(),
  chatModel: z.string().min(1),
  embeddingProvider: z.string().min(1),
  embeddingBaseUrl: z.string().nullable(),
  embeddingApiKey: z.string().nullable(),
  embeddingModel: z.string().min(1),
  tavilyApiKey: z.string().nullable(),
  exportDir: z.string().nullable(),
});

export async function GET() {
  return NextResponse.json({ settings: getSettings() });
}

export async function POST(request: Request) {
  const payload = settingsSchema.parse(await request.json());
  const settings = updateSettings(payload);
  return NextResponse.json({ settings });
}
