"use client";
import { motion } from "framer-motion";
import { ArrowRight, Building2, FileText, GraduationCap, Heart, LogIn, QrCode, Sparkles, UserPlus, Wand2 } from "lucide-react";
import Link from "next/link";
import { Avatar, OrgLogo } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { studentHome, useSession } from "@/components/session-provider";
import { Skeleton } from "@/components/ui/skeleton";

const LOOP = [
  { icon: Wand2, title: "Org creates", body: "AI writes the swipe card + flyer" },
  { icon: Heart, title: "Students swipe", body: "Every left swipe captures a reason" },
  { icon: QrCode, title: "They show up", body: "Pre-register, QR check-in, 10-sec feedback" },
  { icon: FileText, title: "AI writes the record", body: "Funnel, reasons, themes, keep/change" },
  { icon: Sparkles, title: "Next event is smarter", body: "History pre-fills the next plan" },
];

export default function Home() {
  const { session, current, orgs, switchToOrg, loading } = useSession();
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-cardinal via-cardinal-800 to-cardinal-900 px-6 py-14 text-white shadow-lift sm:px-12">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[40px] border-gold/20" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-gold/10 blur-2xl" />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold">
            <Sparkles className="h-3.5 w-3.5" /> AI-powered events for USC
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Students swipe, orgs learn, and every event makes the <span className="text-gold">next one better.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/80">TrojanEngage turns every swipe, check-in and star rating into institutional memory, so next year&apos;s board doesn&apos;t start from zero.</p>
        </motion.div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {LOOP.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cardinal-50 text-xs font-bold text-cardinal">{i + 1}</span>
              <s.icon className="h-4 w-4 text-cardinal" />
            </div>
            <div className="font-semibold">{s.title}</div>
            <div className="text-sm text-muted-foreground">{s.body}</div>
          </motion.div>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-2 text-lg font-bold">
            <GraduationCap className="h-5 w-5 text-cardinal" /> Students
          </div>
          {session?.role === "student" && current ? (
            <Link href={studentHome(current as { onboarded: boolean })} className="group flex items-center gap-3 rounded-2xl border p-4 transition hover:border-cardinal/40 hover:bg-cardinal-50/50">
              <Avatar name={current.name} src={(current as { avatarUrl?: string }).avatarUrl} size={44} />
              <span className="flex-1">
                <span className="block font-semibold">Continue as {current.name}</span>
                <span className="block text-xs text-muted-foreground">You&apos;re logged in</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-cardinal" />
            </Link>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Log in with your USC email to get a personalized feed, pre-register with a swipe and check in by QR.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/login">
                  <Button size="lg">
                    <LogIn /> Log in
                  </Button>
                </Link>
                <Link href="/login?mode=signup">
                  <Button size="lg" variant="outline">
                    <UserPlus /> Sign up
                  </Button>
                </Link>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Demo: <b>alex@usc.edu</b> (new student) or <b>priya@usc.edu</b> · password <code className="rounded bg-card px-1">trojan123</code>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Building2 className="h-5 w-5 text-cardinal" /> Continue as an org
          </div>
          <div className="space-y-2">
            {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
            {orgs.map((o) => (
              <button key={o.id} onClick={() => switchToOrg(o.id, "/org/history")} className="group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-cardinal/40 hover:bg-cardinal-50/50">
                <OrgLogo org={o} size={44} />
                <span className="flex-1">
                  <span className="block font-semibold">{o.name}</span>
                  <span className="block text-xs text-muted-foreground">{o.category}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-cardinal" />
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Org accounts use the demo switcher (top bar) in this build; students log in.</p>
        </div>
      </section>
    </main>
  );
}
