import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { refreshConflicts } from "@/lib/services/conflicts";
import { publicEvent } from "@/lib/services/serialize";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  requireStudent(params.id);
  const refreshed = await refreshConflicts(params.id);
  const conflictsById = new Map(refreshed.map((r) => [r.id, r.conflicts]));
  const regs = await prisma.registration.findMany({
    where: { studentId: params.id, status: { in: ["pre-registered", "registered", "waitlisted"] } },
    include: { event: { include: { org: true, venue: true } } },
  });
  const [checkIns, feedback] = await Promise.all([
    prisma.checkIn.findMany({ where: { studentId: params.id }, select: { eventId: true } }),
    prisma.feedback.findMany({ where: { studentId: params.id }, select: { eventId: true } }),
  ]);
  const checked = new Set(checkIns.map((c) => c.eventId));
  const gave = new Set(feedback.map((f) => f.eventId));
  const items = regs
    .map((r) => ({
      id: r.id,
      status: r.status,
      hasConflict: r.hasConflict,
      conflictNote: r.conflictNote,
      conflicts: conflictsById.get(r.id) ?? [],
      checkedIn: checked.has(r.eventId),
      gaveFeedback: gave.has(r.eventId),
      event: publicEvent(r.event),
    }))
    .sort((a, b) => (a.event.date + a.event.startTime).localeCompare(b.event.date + b.event.startTime));
  return ok({ registrations: items });
});
