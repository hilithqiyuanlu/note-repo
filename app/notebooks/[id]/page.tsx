import { notFound } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell";
import { buildInitialModelCatalog } from "@/lib/ai/provider";
import { getSettings, getThreadMessages, getNotebookSnapshot, listThreadSummaries } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function NotebookWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snapshot = getNotebookSnapshot(id);

  if (!snapshot) {
    notFound();
  }

  const threadSummaries = listThreadSummaries(id);
  const activeThreadId = threadSummaries[0]?.id ?? null;
  const activeThreadMessages = activeThreadId ? getThreadMessages(activeThreadId) : [];
  const settings = getSettings();

  return (
    <WorkspaceShell
      initialActiveThreadId={activeThreadId}
      initialActiveThreadMessages={activeThreadMessages}
      initialModelCatalog={buildInitialModelCatalog(settings)}
      initialSettings={settings}
      initialSnapshot={snapshot}
      initialThreadSummaries={threadSummaries}
    />
  );
}
