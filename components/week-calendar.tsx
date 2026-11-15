"use client";
import { ChevronLeft, ChevronRight, Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { DAYS } from "@/lib/taxonomy";
import { addDays, dayOfWeek, fmt12, todayISO, toMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ScheduleBlockView } from "@/lib/types";

export type CalEvent = {
  id: string;
  title: string;
  date: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  status: "registered" | "saved" | "waitlisted";
  hasConflict: boolean;
  live?: boolean;
};

const START_H = 8;
const END_H = 22;
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function mondayOf(date: string) {
  let d = date;
  while (dayOfWeek(d) !== 1) d = addDays(d, -1);
  return d;
}

type Item = { key: string; kind: "class" | "work" | "personal" | "other" | "event"; title: string; sub: string; start: number; end: number; ev?: CalEvent; locked?: boolean };

function segmentsFor(e: CalEvent, date: string): { start: string; end: string } | null {
  const endDate = e.endDate && e.endDate > e.date ? e.endDate : e.date;
  if (date < e.date || date > endDate) return null;
  return { start: date === e.date ? e.startTime : "08:00", end: date === endDate ? e.endTime : "22:00" };
}

export function WeekCalendar({ blocks, events, freeSlots, initialWeek }: { blocks: ScheduleBlockView[]; events: CalEvent[]; freeSlots: { day: number; start: string; end: string }[]; initialWeek?: string }) {
  const [week, setWeek] = React.useState(initialWeek ?? mondayOf(todayISO()));
  const [selected, setSelected] = React.useState<Item | null>(null);
  const hourPx = 34;
  const top = (m: number) => ((Math.max(m, START_H * 60) - START_H * 60) / 60) * hourPx;
  const height = (a: number, b: number) => Math.max(14, ((Math.min(b, END_H * 60) - Math.max(a, START_H * 60)) / 60) * hourPx);
  const today = todayISO();

  const days = ORDER.map((dow, i) => {
    const date = addDays(week, i);
    const items: Item[] = [];
    for (const b of blocks.filter((x) => x.day === dow))
      items.push({ key: b.id, kind: b.kind as Item["kind"], title: b.title.split(" · ")[0], sub: `${b.title}${b.location ? ` · ${b.location}` : ""}`, start: toMinutes(b.start), end: toMinutes(b.end), locked: !b.editable });
    for (const e of events) {
      const seg = segmentsFor(e, date);
      if (seg) items.push({ key: `${e.id}-${date}`, kind: "event", title: e.title, sub: `${fmt12(seg.start)}–${fmt12(seg.end)}`, start: toMinutes(seg.start), end: toMinutes(seg.end), ev: e });
    }
    return { dow, date, items, free: freeSlots.filter((f) => f.day === dow) };
  });

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setWeek(addDays(week, -7))} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Previous week">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold">
          Week of {new Date(week + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {week !== mondayOf(today) && (
            <button onClick={() => setWeek(mondayOf(today))} className="ml-2 text-xs font-medium text-cardinal underline">
              Today
            </button>
          )}
        </div>
        <button onClick={() => setWeek(addDays(week, 7))} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Next week">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "28px repeat(7, minmax(0, 1fr))" }}>
        <div />
        {days.map((d) => (
          <div key={d.date} className={cn("pb-1 text-center text-[10px] font-semibold", d.date === today ? "text-cardinal" : "text-muted-foreground")}>
            {DAYS[d.dow]}
            <div className={cn("mx-auto mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px]", d.date === today && "bg-cardinal text-white")}>{Number(d.date.slice(8))}</div>
          </div>
        ))}
        <div className="relative" style={{ height: (END_H - START_H) * hourPx }}>
          {Array.from({ length: END_H - START_H }, (_, i) => (
            <div key={i} className="absolute right-1 text-[9px] text-muted-foreground" style={{ top: i * hourPx - 5 }}>
              {(START_H + i) % 12 || 12}
              {START_H + i < 12 ? "a" : "p"}
            </div>
          ))}
        </div>
        {days.map((d) => (
          <div key={d.date} className="relative border-l" style={{ height: (END_H - START_H) * hourPx }}>
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <div key={i} className="absolute inset-x-0 border-t border-dashed border-border/60" style={{ top: i * hourPx }} />
            ))}
            {d.free.map((f, i) => (
              <div key={i} className="absolute inset-x-0 bg-emerald-50" style={{ top: top(toMinutes(f.start)), height: height(toMinutes(f.start), toMinutes(f.end)) }} />
            ))}
            {d.items.map((it) => {
              const isEv = it.kind === "event";
              const ev = it.ev;
              return (
                <button
                  key={it.key}
                  onClick={() => setSelected(it)}
                  className={cn(
                    "absolute overflow-hidden rounded-md px-0.5 text-left text-[9px] font-semibold leading-tight",
                    !isEv && it.kind === "class" && "inset-x-0.5 bg-slate-300/80 text-slate-800",
                    !isEv && it.kind === "work" && "inset-x-0.5 bg-sky-300/80 text-sky-950",
                    !isEv && (it.kind === "personal" || it.kind === "other") && "inset-x-0.5 bg-violet-300/80 text-violet-950",
                    isEv && "left-1.5 right-0 z-10 shadow-sm",
                    isEv && ev?.status === "registered" && "bg-cardinal text-white",
                    isEv && ev?.status === "waitlisted" && "bg-cardinal/50 text-white",
                    isEv && ev?.status === "saved" && "border border-dashed border-gold-700 bg-gold-100 text-neutral-900",
                    isEv && ev?.hasConflict && "ring-2 ring-amber-500",
                    selected?.key === it.key && "outline outline-2 outline-offset-1 outline-foreground",
                  )}
                  style={{ top: top(it.start), height: height(it.start, it.end) }}
                  title={it.sub}
                >
                  {it.title}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <Legend className="bg-slate-300" label="Class (USC)" />
        <Legend className="bg-sky-300" label="Work" />
        <Legend className="bg-violet-300" label="Personal" />
        <Legend className="bg-cardinal" label="Registered" />
        <Legend className="border border-dashed border-gold-700 bg-gold-100" label="Saved" />
        <Legend className="bg-emerald-100" label="Free" />
      </div>
      {selected && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-muted/60 p-2.5 text-xs">
          {selected.locked && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          {selected.ev?.hasConflict && <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
          <div className="flex-1">
            <div className="font-semibold">{selected.kind === "event" ? selected.title : selected.sub}</div>
            <div className="text-muted-foreground">
              {selected.kind === "event" ? `${selected.ev?.status === "saved" ? "Saved" : selected.ev?.status === "waitlisted" ? "Waitlisted" : "Registered"} · ${selected.sub}` : `${fmt12(String(Math.floor(selected.start / 60)).padStart(2, "0") + ":" + String(selected.start % 60).padStart(2, "0"))}–${fmt12(String(Math.floor(selected.end / 60)).padStart(2, "0") + ":" + String(selected.end % 60).padStart(2, "0"))}${selected.locked ? " · imported from USC" : ""}`}
            </div>
          </div>
          {selected.ev && (
            <Link href={`/event/${selected.ev.id}`} className="font-semibold text-cardinal">
              Open
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("h-2.5 w-2.5 rounded-sm", className)} /> {label}
    </span>
  );
}
