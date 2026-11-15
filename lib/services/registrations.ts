// Saved → registered, with clash warnings the student can override, and capacity-aware waitlisting.
import { prisma } from "../db";
import { HttpError } from "../errors";
import { parseStrings, parseWeights, toJSON } from "../json";
import { round } from "../utils";
import { describeConflicts, findConflicts, type ConflictItem } from "./conflicts";

export type RegisterResult =
  | { ok: false; needsConfirmation: true; conflicts: ConflictItem[]; note: string }
  | { ok: true; status: "registered" | "waitlisted"; registrationId: string; conflicts: ConflictItem[]; note: string | null };

/**
 * Register a student for an event. If it clashes with classes, work/personal blocks or other events,
 * returns needsConfirmation unless `force` — the student always has the final say.
 */
export async function registerForEvent(studentId: string, eventId: string, force = false): Promise<RegisterResult> {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  if (event.status === "closed") throw new HttpError(409, "This event has already ended.");
  if (event.status === "draft") throw new HttpError(409, "This event isn't published yet.");
  const conflicts = await findConflicts(studentId, event);
  const note = describeConflicts(conflicts);
  if (conflicts.length && !force) return { ok: false, needsConfirmation: true, conflicts, note: note! };
  const existing = await prisma.registration.findUnique({ where: { studentId_eventId: { studentId, eventId } } });
  const registeredCount = await prisma.registration.count({ where: { eventId, status: "registered", NOT: { studentId } } });
  const full = registeredCount >= event.capacity;
  const status: "registered" | "waitlisted" = full && event.waitlistEnabled ? "waitlisted" : "registered";
  if (full && !event.waitlistEnabled) throw new HttpError(409, "This event is full.");
  const reg = await prisma.registration.upsert({
    where: { studentId_eventId: { studentId, eventId } },
    create: { studentId, eventId, status, hasConflict: !!conflicts.length, conflictNote: note },
    update: { status, hasConflict: !!conflicts.length, conflictNote: note },
  });
  if (existing?.status !== "registered" && status === "registered") {
    // Confirming is a stronger signal than a swipe: +0.1 interest boost on the event's tags.
    const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    const w = parseWeights(student.tagWeights);
    for (const t of parseStrings(event.tags)) w[t] = round((w[t] ?? 0) + 0.1);
    await prisma.student.update({ where: { id: studentId }, data: { tagWeights: toJSON(w) } });
  }
  return { ok: true, status, registrationId: reg.id, conflicts, note };
}

/** Save for later (= pre-register) without a swipe, e.g. from search or the event page. */
export async function saveEvent(studentId: string, eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const conflicts = await findConflicts(studentId, event);
  const note = describeConflicts(conflicts);
  return prisma.registration.upsert({
    where: { studentId_eventId: { studentId, eventId } },
    create: { studentId, eventId, status: "pre-registered", hasConflict: !!conflicts.length, conflictNote: note },
    update: { status: "pre-registered", hasConflict: !!conflicts.length, conflictNote: note },
  });
}
