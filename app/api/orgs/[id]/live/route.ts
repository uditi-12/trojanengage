import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { getFunnels } from "@/lib/services/funnel";

export const dynamic = "force-dynamic";

/** All of an org's live events (orgs can run several at once). */
export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const events = await prisma.event.findMany({ where: { orgId: params.id, status: "live" }, orderBy: [{ date: "asc" }, { startTime: "asc" }], select: { id: true, title: true, flyerHeadline: true, startTime: true, endTime: true, location: true, capacity: true } });
  const f = await getFunnels(events.map((e) => e.id));
  return ok({ live: events.map((e) => ({ ...e, checkedIn: f[e.id]?.checkedIn ?? 0, registered: f[e.id]?.registered ?? 0 })) });
});
