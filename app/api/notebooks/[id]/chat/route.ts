import { NextResponse } from "next/server";
import { z } from "zod";

import { chatWithNotebook } from "@/lib/ai/provider";
import {
  appendMessage,
  createThread,
  getThreadMessages,
  listThreadSummaries,
  updateThreadTitle,
} from "@/lib/db/queries";
import { clampText } from "@/lib/utils";

const chatSchema = z.object({
  threadId: z.string().optional(),
  message: z.string().trim().min(1),
  useWebSearch: z.boolean().default(false),
  modelKey: z.string().optional(),
  sourceIds: z.array(z.string()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = chatSchema.parse(await request.json());
  const threadId =
    payload.threadId || createThread(id, clampText(payload.message, 32), payload.modelKey);

  appendMessage({
    threadId,
    role: "user",
    content: payload.message,
    usedWebSearch: payload.useWebSearch,
  });

  const result = await chatWithNotebook({
    notebookId: id,
    message: payload.message,
    useWebSearch: payload.useWebSearch,
    modelKey: payload.modelKey,
    sourceIds: payload.sourceIds,
  });

  appendMessage({
    threadId,
    role: "assistant",
    content: result.answer,
    citations: result.citations,
    usedWebSearch: result.usedWebSearch,
  });

  updateThreadTitle(threadId, clampText(payload.message, 40));

  return NextResponse.json({
    threadId,
    answer: result.answer,
    citations: result.citations,
    usedWebSearch: result.usedWebSearch,
    externalResults: result.externalResults,
    threadSummaries: listThreadSummaries(id),
    activeThreadMessages: getThreadMessages(threadId),
  });
}
