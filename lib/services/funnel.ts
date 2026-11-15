import { prisma } from "../db";

export type Funnel = {
  rightSwipes: number;
  leftSwipes: number;
  preRegistered: number;
  registered: number;
  checkedIn: number;
  capacity: number;
  avgRating: number;
  feedbackCount: number;
  reasons: Record<string, number>;
};

/** Funnel counts for many events at once (grouped queries, no N+1). */
export async function getFunnels(eventIds: string[]): Promise<Record<string, Funnel>> {
  if (!eventIds.length) return {};
  const [swipes, regs, checks, fb, events] = await Promise.all([
    prisma.swipe.groupBy({ by: ["eventId", "direction", "reason"], where: { eventId: { in: eventIds } }, _count: { _all: true } }),
    prisma.registration.groupBy({ by: ["eventId", "status"], where: { eventId: { in: eventIds } }, _count: { _all: true } }),
    prisma.checkIn.groupBy({ by: ["eventId"], where: { eventId: { in: eventIds } }, _count: { _all: true } }),
    prisma.feedback.groupBy({ by: ["eventId"], where: { eventId: { in: eventIds } }, _count: { _all: true }, _avg: { rating: true } }),
    prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, capacity: true } }),
  ]);
  const out: Record<string, Funnel> = {};
  for (const e of events) out[e.id] = { rightSwipes: 0, leftSwipes: 0, preRegistered: 0, registered: 0, checkedIn: 0, capacity: e.capacity, avgRating: 0, feedbackCount: 0, reasons: {} };
  for (const s of swipes) {
    const f = out[s.eventId];
    if (!f) continue;
    if (s.direction === "right") f.rightSwipes += s._count._all;
    else {
      f.leftSwipes += s._count._all;
      if (s.reason) f.reasons[s.reason] = (f.reasons[s.reason] ?? 0) + s._count._all;
    }
  }
  for (const r of regs) {
    const f = out[r.eventId];
    if (!f || r.status === "cancelled") continue;
    f.preRegistered += r._count._all; // everyone who reached at least pre-registration
    if (r.status === "registered") f.registered += r._count._all;
  }
  for (const c of checks) if (out[c.eventId]) out[c.eventId].checkedIn = c._count._all;
  for (const x of fb) if (out[x.eventId]) {
    out[x.eventId].feedbackCount = x._count._all;
    out[x.eventId].avgRating = Math.round((x._avg.rating ?? 0) * 10) / 10;
  }
  return out;
}

export async function getFunnel(eventId: string): Promise<Funnel> {
  const all = await getFunnels([eventId]);
  return all[eventId] ?? { rightSwipes: 0, leftSwipes: 0, preRegistered: 0, registered: 0, checkedIn: 0, capacity: 0, avgRating: 0, feedbackCount: 0, reasons: {} };
}
