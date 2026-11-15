"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Lock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Progress } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { DAYS, GOAL_LABELS, GOALS, TAG_LABELS, TAGS } from "@/lib/taxonomy";
import type { ScheduleBlockView } from "@/lib/types";
import { fmt12 } from "@/lib/time";

const INTEREST_CHIPS = TAGS.filter((t) => !["talk", "festival", "hands-on", "beginner-friendly"].includes(t));

function Setup({ id }: { id: string }) {
  const router = useRouter();
  const { refresh, current } = useSession();
  const [step, setStep] = React.useState(0);
  const [interests, setInterests] = React.useState<string[]>([]);
  const [goals, setGoals] = React.useState<string[]>([]);
  const [schedule, setSchedule] = React.useState<{ blocks: ScheduleBlockView[] } | null>(null);
  React.useEffect(() => {
    api<{ blocks: ScheduleBlockView[] }>(`/api/students/${id}/schedule`)
      .then(setSchedule)
      .catch(() => setSchedule({ blocks: [] }));
  }, [id]);
  const [saving, setSaving] = React.useState(false);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const canNext = step === 0 ? interests.length >= 1 : step === 1 ? goals.length >= 1 : !!schedule;

  async function finish() {
    setSaving(true);
    try {
      await api(`/api/students/${id}/setup`, { body: { interests, goals } });
      await refresh();
      toast.success("You're all set — here's your feed");
      router.push("/student/feed");
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  const steps = [
    {
      title: "What are you into?",
      sub: "Pick a few — this seeds your feed.",
      body: (
        <div className="flex flex-wrap gap-2">
          {INTEREST_CHIPS.map((t) => (
            <Chip key={t} active={interests.includes(t)} onClick={() => toggle(interests, setInterests, t)}>
              {TAG_LABELS[t]}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: "What do you want out of events?",
      sub: "We'll prioritize events that deliver.",
      body: (
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <Chip key={g} className="justify-center py-3" active={goals.includes(g)} onClick={() => toggle(goals, setGoals, g)}>
              {GOAL_LABELS[g]}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: "Your USC schedule is in",
      sub: "We imported your classes when you logged in with your USC ID. Events are ranked around them.",
      body: (
        <div className="space-y-3">
          {!schedule && <div className="skeleton h-32" />}
          {schedule && (
            <div className="space-y-2">
              {Array.from(new Map(schedule.blocks.filter((b) => b.kind === "class").map((b) => [b.title, b])).values()).map((b) => {
                const days = schedule.blocks.filter((x) => x.title === b.title).map((x) => DAYS[x.day]).join("/");
                return (
                  <div key={b.title} className="flex items-center gap-3 rounded-xl bg-slate-100 p-3 text-sm">
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{b.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {days} · {fmt12(b.start)}–{fmt12(b.end)}
                        {b.location ? ` · ${b.location}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Work on or off campus? Add those hours any time under <b>My Events → Schedule</b>. Classes can&apos;t be edited.
              </p>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="px-5 pt-6">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>Step {step + 1} of 3</span>
        <span>~30 seconds</span>
      </div>
      <Progress value={((step + (canNext ? 1 : 0.4)) / 3) * 100} />
      <div className="mt-6 flex items-center gap-2 text-sm font-medium text-cardinal">
        <Sparkles className="h-4 w-4" /> Hi {current?.name.split(" ")[0] ?? "there"}!
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{steps[step].title}</h1>
          <p className="mb-5 text-sm text-muted-foreground">{steps[step].sub}</p>
          {steps[step].body}
        </motion.div>
      </AnimatePresence>
      <div className="sticky bottom-0 mt-8 flex gap-3 bg-gradient-to-t from-background via-background pb-6 pt-4">
        {step > 0 && (
          <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>
            <ArrowLeft />
          </Button>
        )}
        <Button size="lg" className="flex-1" disabled={!canNext} loading={saving} onClick={() => (step < 2 ? setStep(step + 1) : finish())}>
          {step < 2 ? "Next" : "Build my feed"} <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

export default function Page() {
  return <RoleGate role="student">{(id) => <Setup id={id} />}</RoleGate>;
}
