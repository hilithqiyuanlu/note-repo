import { listNotebooks } from "@/lib/db/queries";
import { NotebookLibrary } from "@/components/notebook-library";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const notebooks = listNotebooks();

  return <NotebookLibrary initialNotebooks={notebooks} />;
}
