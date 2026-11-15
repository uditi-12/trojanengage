import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/session-provider";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrojanEngage — every event makes the next one better",
  description: "Students swipe, orgs learn, and every event makes the next one better. An AI-powered event platform for USC student orgs.",
  applicationName: "TrojanEngage",
  appleWebApp: { capable: true, title: "TrojanEngage", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#990000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <TopBar />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </SessionProvider>
      </body>
    </html>
  );
}
