"use client";
import { Download } from "lucide-react";
import * as React from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registers the service worker and offers an "Install app" button where the browser supports it. */
export function PwaInstall() {
  const [deferred, setDeferred] = React.useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = React.useState(false);
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        // Dev chunk URLs aren't content-hashed, so a cache-first SW would serve stale code after edits.
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
        if ("caches" in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios && !standalone && !localStorage.getItem("trojanengage-ios-hint")) setIosHint(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (deferred)
    return (
      <button
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
        className="flex items-center gap-1.5 rounded-xl border bg-card px-2.5 py-1.5 text-sm font-medium hover:bg-muted"
      >
        <Download className="h-4 w-4 text-cardinal" /> <span className="hidden sm:inline">Install app</span>
      </button>
    );
  if (iosHint)
    return (
      <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl bg-foreground p-3 text-sm text-background shadow-2xl">
        <b>Install TrojanEngage:</b> tap the Share button, then <b>Add to Home Screen</b>.
        <button
          className="ml-2 underline"
          onClick={() => {
            try {
              localStorage.setItem("trojanengage-ios-hint", "1");
            } catch {
              /* ignore */
            }
            setIosHint(false);
          }}
        >
          Got it
        </button>
      </div>
    );
  return null;
}
