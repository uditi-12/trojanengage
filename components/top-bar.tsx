"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, Cpu, GraduationCap, LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { AiDrawer } from "./ai-drawer";
import { PwaInstall } from "./pwa";
import { Avatar, OrgLogo } from "./avatar";
import { studentHome, useSession } from "./session-provider";

export function TopBar() {
  const { session, current, orgs, switchToOrg, logout, loading } = useSession();
  const [open, setOpen] = React.useState(false);
  const [ai, setAi] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <header className="no-print sticky top-0 z-40 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cardinal text-xs font-black text-gold shadow-lift">TE</span>
          <span className="text-base font-bold tracking-tight sm:text-lg">
            TrojanEngage<span className="text-cardinal">.</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <PwaInstall />
          <button onClick={() => setAi(true)} className="hidden items-center gap-1.5 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted sm:flex">
            <Cpu className="h-4 w-4 text-cardinal" /> AI under the hood
          </button>
          <button onClick={() => setAi(true)} className="rounded-xl border bg-card p-2 sm:hidden" aria-label="AI under the hood">
            <Cpu className="h-4 w-4 text-cardinal" />
          </button>
          <div className="relative" ref={ref}>
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl border bg-card py-1 pl-1 pr-2 text-sm font-medium hover:bg-muted">
              {current && session?.role === "student" && <Avatar name={current.name} src={(current as { avatarUrl?: string }).avatarUrl} size={28} />}
              {current && session?.role === "org" && <OrgLogo org={current as { name: string; logoUrl: string }} size={28} />}
              {!current && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">?</span>}
              <span className="max-w-[9rem] truncate">{loading ? "…" : current ? current.name : "Log in"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 max-h-[75vh] w-72 overflow-y-auto rounded-2xl border bg-card p-2 shadow-2xl"
                >
                  <div className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5" /> Student
                  </div>
                  {session?.role === "student" && current ? (
                    <div className="space-y-1">
                      <Link href={studentHome(current as { onboarded: boolean })} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-muted">
                        <Avatar name={current.name} src={(current as { avatarUrl?: string }).avatarUrl} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{current.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{(current as { email?: string }).email}</span>
                        </span>
                      </Link>
                      <button
                        onClick={async () => {
                          setOpen(false);
                          await logout();
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-medium text-cardinal hover:bg-muted"
                      >
                        <LogOut className="h-4 w-4" /> Log out
                      </button>
                    </div>
                  ) : (
                    <Link href="/login" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-cardinal hover:bg-muted">
                      <LogIn className="h-4 w-4" /> Student log in / sign up
                    </Link>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 border-t px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> Orgs
                  </div>
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      onClick={async () => {
                        setOpen(false);
                        await switchToOrg(o.id, "/org/history");
                      }}
                      className={cn("flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted", session?.id === o.id && "bg-cardinal-50")}
                    >
                      <OrgLogo org={o} size={28} />
                      <span>
                        <span className="block font-medium">{o.name}</span>
                        <span className="block text-xs text-muted-foreground">{o.category}</span>
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <AiDrawer open={ai} onClose={() => setAi(false)} />
    </header>
  );
}
