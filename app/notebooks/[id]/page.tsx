import { notFound } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell";
import { getNotebookSnapshot, getSettings, listThreads } from "@/lib/db/queries";
import { listModels } from "@/lib/ai/provider";

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

  const [threads, models] = await Promise.all([Promise.resolve(listThreads(id)), listModels()]);
  const settings = getSettings();

  return (
    <WorkspaceShell
      initialModels={models}
      initialSettings={settings}
      initialSnapshot={snapshot}
      initialThreads={threads}
    />
  );
}
