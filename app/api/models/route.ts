import { NextResponse } from "next/server";

import { listModelCatalog } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await listModelCatalog();
  return NextResponse.json(catalog);
}
