import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { getUploadsRoot } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const targetPath = path.join(getUploadsRoot(), ...slug);

  try {
    const data = await fs.readFile(targetPath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
