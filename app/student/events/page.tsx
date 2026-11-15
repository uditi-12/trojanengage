"use client";
import { CalendarCheck, CalendarClock, CheckCircle2, Clock, MessageSquare, Pencil, QrCode, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { EventRow } from "@/components/event-row";
import { useRegister } from "@/components/register-flow";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekCalendar, type CalEvent } from "@/components/week-calendar";
import { api } from "@/lib/client";
import type { ConflictItem, EventView, ScheduleBlockView } from "@/lib/types";

type Reg = { id: string; status: string; hasConflict: boolean; conflictNote: string | null; conflicts: ConflictItem[]; checkedIn: boolean; gaveFeedback: boolean; event: EventView };
type Schedule = { importedAt: string | null; blocks: ScheduleBlockView[]; freeSlots: { day: number; start: string; end: string }[] };

function MyEvents({ id }: { id: string }) {
  const [regs, setRegs] = React.useState<Reg[] | null>(null);
  const [sched, setSched] = React.useState<Schedule | null>(null);
  const load = React.useCallback(async () => {
    const [r, s] = await Promise.all([api<{ registrations: Reg[] }>(`/api/students/${id}/events`), api<Schedule>(`/api/students/${id}/schedule`)]);
    setRegs(r.registrations);
    setSched(s);
  }, [id]);
  React.useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);
  const { register, busy, dialog } = useRegister(() => load());

  const cancel = async (r: Reg) => {
    await api(`/api/registrations/${r.id}`, { method: "DELETE" });
    toast(r.status === "pre-registered" ? "Removed from saved" : "Registration cancelled");
    load();
  };

  const active = regs?.filter((r) => r.event.status !== "closed") ?? [];
  const live = active.filter((r) => r.event.status === "live" && (r.status === "registered" || r.status === "pre-registered"));
  const saved = active.filter((r) => r.status === "pre-registered");
  const registered = active.filter((r) => r.status === "registered" || r.status === "waitlisted");
  const past = regs?.filter((r) => r.event.status === "closed") ?? [];
  const calEvents: CalEvent[] = active.map((r) => ({
    id: r.event.id,
    title: r.event.flyerHeadline || r.event.title,
    date: r.event.date,
    endDate: r.event.endDate,
    startTime: r.event.startTime,
    endTime: r.event.endTime,
    status: r.status === "registered" ? "registered" : r.status === "waitlisted" ? "waitlisted" : "saved",
    hasConflict: r.hasConflict,
    live: r.event.status === "live",
  }));

  const Clash = ({ r }: { r: Reg }) =>
    r.hasConflict ? (
      <div className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{r.conflicts.length ? r.conflicts.map((c) => `${c.kind === "class" ? "Class: " : c.kind === "event" ? "Event: " : ""}${c.title}${c.when ? ` (${c.when})` : ""}`).join(" · ") : r.conflictNote}</span>
      </div>
    ) : null;

  return (
    <div className="space-y-5 px-4 pt-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My Events</h1>
          <p className="text-xs text-muted-foreground">Your USC classes, your own busy time and your events, all in one week view.</p>
        </div>
        <Link href="/student/schedule">
          <Button size="sm" variant="outline">
            <Pencil /> Schedule
          </Button>
        </Link>
      </div>

      {!sched || !regs ? (
        <Skeleton className="h-[520px]" />
      ) : (
        <WeekCalendar blocks={sched.blocks} events={calEvents} freeSlots={sched.freeSlots} />
      )}
      {sched?.importedAt && (
        <p className="-mt-3 text-[11px] text-muted-foreground">
          <CalendarClock className="mr-1 inline h-3 w-3" /> Classes imported from your USC schedule · {new Date(sched.importedAt).toLocaleDateString()}
        </p>
      )}

      {live.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-red-600">Live now ({live.length})</h2>
          <div className="space-y-2">
            {live.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.event.flyerHeadline || r.event.title}</div>
                  <div className="text-xs text-muted-foreground">{r.event.location}</div>
                </div>
                {r.checkedIn ? (
                  <span className="text-xs font-semibold text-emerald-700">Checked in ✓</span>
                ) : (
                  <Link href={`/event/${r.event.id}`}>
                    <Button size="sm" variant="gold">
                      <QrCode /> I&apos;m here
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {regs && active.length === 0 && past.length === 0 && (
        <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="Nothing saved yet" body="Swipe right on events in your feed to save them here, then register." action={<Link href="/student/feed"><Button>Go to feed</Button></Link>} />
      )}

      {saved.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Saved <span className="text-foreground">({saved.length})</span>
          </h2>
          <p className="mb-2 text-xs text-muted-foreground">Dashed on the calendar. Register to lock them in — we&apos;ll warn you about clashes.</p>
          <div className="space-y-3">
            {saved.map((r) => (
              <div key={r.id} className="space-y-1.5">
                <EventRow e={r.event} />
                <Clash r={r} />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" loading={busy} onClick={() => register(`/api/registrations/${r.id}/confirm`, r.event.flyerHeadline || r.event.title)}>
                    <CheckCircle2 /> Register
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cancel(r)}>
                    <X /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {registered.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Registered <span className="text-foreground">({registered.length})</span>
          </h2>
          <div className="space-y-3">
            {registered.map((r) => (
              <div key={r.id} className="space-y-1.5">
                <EventRow e={r.event} right={r.status === "waitlisted" ? <span className="self-start rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">WAITLIST</span> : undefined} />
                <Clash r={r} />
                <div className="flex gap-2">
                  {r.checkedIn && !r.gaveFeedback && (
                    <Link href={`/feedback/${r.event.id}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full">
                        <MessageSquare /> Give feedback
                      </Button>
                    </Link>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => cancel(r)}>
                    <X /> Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <Clock className="mr-1 inline h-3.5 w-3.5" /> Past ({past.length})
          </h2>
          <div className="space-y-2">
            {past.map((r) => (
              <div key={r.id} className="space-y-1.5">
                <EventRow e={r.event} />
                {r.checkedIn && r.status === "registered" && !r.gaveFeedback && (
                  <Link href={`/feedback/${r.event.id}`}>
                    <Button size="sm" variant="outline" className="w-full">
                      <MessageSquare /> Give feedback
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {dialog}
    </div>
  );
}

export default function Page() {
  return <RoleGate role="student">{(id) => <MyEvents id={id} />}</RoleGate>;
}
