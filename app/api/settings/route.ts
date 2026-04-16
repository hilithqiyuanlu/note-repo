import { NextResponse } from "next/server";
import { z } from "zod";

import { getSettings, updateSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  chatProvider: z.string().min(1),
  chatBaseUrl: z.string().nullable(),
  chatApiKey: z.string().nullable(),
  chatModel: z.string().min(1),
  localChatEnabled: z.boolean(),
  localChatBaseUrl: z.string().nullable(),
  localChatModel: z.string().nullable(),
  localChatLabel: z.string().nullable(),
  embeddingProvider: z.string().min(1),
  embeddingBaseUrl: z.string().nullable(),
  embeddingApiKey: z.string().nullable(),
  embeddingModel: z.string().min(1),
  proxyEnabled: z.boolean(),
  proxyProtocol: z.enum(["http", "https"]),
  proxyHost: z.string().nullable(),
  proxyPort: z.number().int().nullable(),
  proxyBypassHosts: z.string().nullable(),
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
