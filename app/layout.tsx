import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
/** メンテナンス時は一般ユーザーにメンテ画面を表示（オーナー・スタッフは通過） */
import MaintenanceGate from "@/components/MaintenanceGate";
import BottomNav from "@/components/BottomNav";
/** 複数タブで開くことを防ぎ、1タブのみでプレイ可能にする */
import SingleTabGuard from "@/components/SingleTabGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HSTファンクラブ",
  description: "HSTesports ファンクラブ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="bg-black">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        <SingleTabGuard>
          <MaintenanceGate>
            <div className="pb-20">{children}</div>
            <BottomNav />
          </MaintenanceGate>
        </SingleTabGuard>
      </body>
    </html>
  );
}
