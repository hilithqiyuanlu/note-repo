import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { SettingsForm } from "@/components/settings-form";
import { getSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await searchParams;
  const settings = getSettings();
  const backHref = back?.startsWith("/") ? back : "/";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">设置</h1>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-accent hover:text-accent"
          href={backHref}
        >
          <ChevronLeft className="h-4 w-4" />
          {backHref === "/" ? "返回豆花" : "返回工作台"}
        </Link>
      </div>

      <SettingsForm initialSettings={settings} />
    </main>
  );
}
