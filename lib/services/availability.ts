// Org-side scheduling help: clashes with other campus events, venue double-booking, and how many
// interested students are actually free (from imported class schedules + work/personal blocks + registrations).
import { prisma } from "../db";
import { parseStrings, parseWeights } from "../json";
import { DAYS_LONG } from "../taxonomy";
import { addDays, dayOfWeek, fmt12, fromMinutes, isPast, toMinutes } from "../time";
import { pct } from "../utils";
import { conflictBetween } from "./conflicts";
import { blockClashes, eventSegments } from "./schedule";

export type AvailabilityInput = {
  orgId: string;
  date: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  venueId?: string | null;
  tags?: string[];
  excludeEventId?: string | null;
};

type Pop = { id: string; blocks: { id: string; kind: string; title: string; day: number; start: string; end: string }[]; regs: { date: string; endDate: string | null; startTime: string; endTime: string }[] };

function busyReason(p: Pop, e: { date: string; endDate?: string | null; startTime: string; endTime: string }): "class" | "work" | "personal" | "event" | null {
  const clash = blockClashes(p.blocks, eventSegments(e));
  if (clash.some((c) => c.kind === "class")) return "class";
  if (clash.some((c) => c.kind === "work")) return "work";
  if (clash.length) return "personal";
  if (p.regs.some((r) => conflictBetween(r, e))) return "event";
  return null;
}

function measure(pop: Pop[], e: { date: string; endDate?: string | null; startTime: string; endTime: string }) {
  const reasons: Record<string, number> = { class: 0, work: 0, personal: 0, event: 0 };
  let free = 0;
  for (const p of pop) {
    const r = busyReason(p, e);
    if (r) reasons[r]++;
    else free++;
  }
  return { free, total: pop.length, pctFree: pct(free, pop.length), busy: reasons };
}

export async function checkAvailability(input: AvailabilityInput) {
  const draft = { date: input.date, endDate: input.endDate ?? null, startTime: input.startTime, endTime: input.endTime };
  const tags = input.tags ?? [];

  // 1) Other events at the same time (any org), and venue double-booking.
  const others = await prisma.event.findMany({
    where: { status: { in: ["published", "live"] }, ...(input.excludeEventId ? { id: { not: input.excludeEventId } } : {}) },
    include: { org: true, venue: true },
  });
  const clashes = others
    .filter((o) => conflictBetween(o, draft))
    .map((o) => {
      const sharedTags = parseStrings(o.tags).filter((t) => tags.includes(t));
      return {
        id: o.id,
        title: o.title,
        orgName: o.org.name,
        sameOrg: o.orgId === input.orgId,
        sameVenue: !!input.venueId && o.venueId === input.venueId,
        sharedTags,
        when: `${fmt12(o.startTime)}–${fmt12(o.endTime)}`,
        venue: o.venue?.name ?? o.location,
      };
    })
    .sort((a, b) => Number(b.sameVenue) - Number(a.sameVenue) || Number(b.sameOrg) - Number(a.sameOrg) || b.sharedTags.length - a.sharedTags.length);
  const venueClash = clashes.find((c) => c.sameVenue) ?? null;

  // 2) Audience availability: students whose learned interests overlap this event's tags.
  const students = await prisma.student.findMany({
    where: { onboarded: true },
    select: { id: true, tagWeights: true, schedule: { select: { id: true, kind: true, title: true, day: true, start: true, end: true } }, registrations: { where: { status: { in: ["registered", "pre-registered"] } }, select: { event: { select: { date: true, endDate: true, startTime: true, endTime: true, status: true } } } } },
  });
  const toPop = (s: (typeof students)[number]): Pop => ({ id: s.id, blocks: s.schedule, regs: s.registrations.map((r) => r.event).filter((e) => e.status !== "closed") });
  const withSchedule = students.filter((s) => s.schedule.length > 0);
  const interested = tags.length ? withSchedule.filter((s) => tags.some((t) => (parseWeights(s.tagWeights)[t] ?? 0) > 0.3)) : withSchedule;
  const audience = (interested.length >= 5 ? interested : withSchedule).map(toPop);
  const now = measure(audience, draft);

  // 3) Better slots in the same week (same duration), ranked by % of the audience free.
  const dur = Math.max(30, toMinutes(input.endTime) - toMinutes(input.startTime));
  let monday = input.date;
  while (dayOfWeek(monday) !== 1) monday = addDays(monday, -1);
  const candidates: { date: string; startTime: string; endTime: string; label: string; pctFree: number; venueFree: boolean }[] = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(monday, d);
    for (let h = 11; h <= 20; h++) {
      const startTime = fromMinutes(h * 60);
      const endTime = fromMinutes(Math.min(h * 60 + dur, 23 * 60 + 30));
      if (date === input.date && startTime === input.startTime) continue;
      if (isPast(date, startTime)) continue;
      const slot = { date, endDate: null, startTime, endTime };
      const venueFree = !input.venueId || !others.some((o) => o.venueId === input.venueId && conflictBetween(o, slot));
      candidates.push({ date, startTime, endTime, label: `${DAYS_LONG[dayOfWeek(date)]} ${fmt12(startTime)}`, pctFree: measure(audience, slot).pctFree, venueFree });
    }
  }
  const better = candidates
    .filter((c) => c.venueFree && c.pctFree > now.pctFree)
    .sort((a, b) => b.pctFree - a.pctFree)
    .slice(0, 3);

  return {
    clashes,
    venueClash,
    audience: { basis: interested.length >= 5 && tags.length ? "interested" : "all", size: audience.length, tags },
    availability: now,
    betterSlots: better,
  };
}
