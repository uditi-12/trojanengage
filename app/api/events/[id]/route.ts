import { prisma } from "@/lib/db";
import { body, handle, ok } from "@/lib/api";
import { getFunnel } from "@/lib/services/funnel";
import { updateEvent } from "@/lib/services/events";
import { publicEvent } from "@/lib/services/serialize";
import { getSession } from "@/lib/session";
import { scoreOne } from "@/lib/services/ranking";
import { findConflicts } from "@/lib/services/conflicts";
import { EventPatchSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const e = await prisma.event.findUniqueOrThrow({ where: { id: params.id }, include: { org: true, venue: true, record: { select: { id: true, approved: true } } } });
  const session = getSession();
  let me: {
    registration: unknown;
    checkedIn: boolean;
    gaveFeedback: boolean;
    swipe: string | null;
    matchPct: number | null;
    why: string | null;
    conflicts: Awaited<ReturnType<typeof findConflicts>>;
  } | null = null;
  if (session?.role === "student") {
    const [registration, checkIn, fb, swipe] = await Promise.all([
      prisma.registration.findUnique({ where: { studentId_eventId: { studentId: session.id, eventId: e.id } } }),
      prisma.checkIn.findUnique({ where: { studentId_eventId: { studentId: session.id, eventId: e.id } } }),
      prisma.feedback.findFirst({ where: { studentId: session.id, eventId: e.id } }),
      prisma.swipe.findUnique({ where: { studentId_eventId: { studentId: session.id, eventId: e.id } } }),
    ]);
    const [scored, conflicts] = await Promise.all([scoreOne(session.id, e.id), findConflicts(session.id, e)]);
    me = { registration, checkedIn: !!checkIn, gaveFeedback: !!fb, swipe: swipe?.direction ?? null, matchPct: scored?.matchPct ?? null, why: scored?.why ?? null, conflicts };
  }
  return ok({ event: publicEvent(e), record: e.record, funnel: await getFunnel(e.id), me });
});

export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const patch = await body(req, EventPatchSchema);
  const e = await updateEvent(params.id, patch);
  return ok({ event: publicEvent(e) });
});
