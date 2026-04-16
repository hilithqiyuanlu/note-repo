import { listNotebooks, getSettings } from "@/lib/db/queries";
import { NotebookLibrary } from "@/components/notebook-library";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const notebooks = listNotebooks();
  const settings = getSettings();

  return <NotebookLibrary initialNotebooks={notebooks} initialSettings={settings} />;
}
