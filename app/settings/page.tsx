import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { SettingsForm } from "@/components/settings-form";
import { getSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = getSettings();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">设置</h1>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-accent hover:text-accent"
          href="/"
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </Link>
      </div>

      <SettingsForm initialSettings={settings} />
    </main>
  );
}
