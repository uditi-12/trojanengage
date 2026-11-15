// Schedule conflicts for students: imported classes, work/personal blocks, and other registered events.
// Conflicts WARN — students always keep the authority to register anyway.
import type { Event } from "@prisma/client";
import { prisma } from "../db";
import { fmt12, overlaps } from "../time";
import { blockClashes, eventSegments, segmentsOverlap } from "./schedule";

type EvTime = Pick<Event, "date" | "startTime" | "endTime"> & { endDate?: string | null };
export type ConflictItem = { kind: "class" | "work" | "personal" | "other" | "event"; title: string; when: string; eventId?: string };
export type Conflict = { eventId: string; title: string; note: string; items: ConflictItem[] };

export function conflictBetween(a: EvTime, b: EvTime) {
  if (!a.endDate && !b.endDate) return a.date === b.date && overlaps(a.startTime, a.endTime, b.startTime, b.endTime);
  return segmentsOverlap(eventSegments(a), eventSegments(b));
}

export function describeConflicts(items: ConflictItem[]): string | null {
  if (!items.length) return null;
  const first = items[0];
  const label = first.kind === "event" ? `Overlaps with "${first.title}"` : first.kind === "class" ? `Clashes with your class ${first.title}` : `Clashes with ${first.title}`;
  return `${label} (${first.when})${items.length > 1 ? ` + ${items.length - 1} more` : ""}`;
}

/** Everything on the student's calendar that collides with this event. */
export async function findConflicts(studentId: string, event: Pick<Event, "id"> & EvTime): Promise<ConflictItem[]> {
  const segs = eventSegments(event);
  const [blocks, regs] = await Promise.all([
    prisma.scheduleBlock.findMany({ where: { studentId } }),
    prisma.registration.findMany({ where: { studentId, status: { in: ["pre-registered", "registered", "waitlisted"] }, eventId: { not: event.id } }, include: { event: true } }),
  ]);
  const items: ConflictItem[] = blockClashes(blocks, segs).map((b) => ({ kind: b.kind as ConflictItem["kind"], title: b.title, when: b.when }));
  for (const r of regs) {
    if (r.event.status === "closed") continue;
    if (conflictBetween(r.event, event)) items.push({ kind: "event", title: r.event.title, when: `${fmt12(r.event.startTime)}–${fmt12(r.event.endTime)}`, eventId: r.eventId });
  }
  return items;
}

/** Back-compat single-conflict shape used by swipe responses. */
export async function findConflict(studentId: string, event: Pick<Event, "id"> & EvTime): Promise<Conflict | null> {
  const items = await findConflicts(studentId, event);
  if (!items.length) return null;
  return { eventId: items[0].eventId ?? "", title: items[0].title, note: describeConflicts(items)!, items };
}

/** Recompute conflict flags for all of a student's active registrations (used by My Events). */
export async function refreshConflicts(studentId: string) {
  const regs = await prisma.registration.findMany({ where: { studentId, status: { in: ["pre-registered", "registered", "waitlisted"] } }, include: { event: true } });
  const out: (typeof regs[number] & { conflicts: ConflictItem[] })[] = [];
  for (const r of regs) {
    const items = r.event.status === "closed" ? [] : await findConflicts(studentId, r.event);
    const note = describeConflicts(items);
    if (r.hasConflict !== !!items.length || r.conflictNote !== note) {
      await prisma.registration.update({ where: { id: r.id }, data: { hasConflict: !!items.length, conflictNote: note } });
      r.hasConflict = !!items.length;
      r.conflictNote = note;
    }
    out.push({ ...r, conflicts: items });
  }
  return out;
}
