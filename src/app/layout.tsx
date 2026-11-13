import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "我的厨房",
  description: "个人菜谱、每周饭菜和采购清单。",
  appleWebApp: { capable: true, title: "我的厨房", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#d46a52",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-full bg-paper pb-24 antialiased">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
