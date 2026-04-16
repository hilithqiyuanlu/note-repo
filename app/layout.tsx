import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "NoteRepo",
  description: "本地优先的三栏知识工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
