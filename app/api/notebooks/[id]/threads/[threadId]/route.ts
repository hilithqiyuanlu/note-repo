import { NextResponse } from "next/server";

import { getThreadMessages, listThreadSummaries } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; threadId: string }> },
) {
  const { id, threadId } = await params;
  const thread = listThreadSummaries(id).find((item) => item.id === threadId);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({
    threadId,
    messages: getThreadMessages(threadId),
  });
}
