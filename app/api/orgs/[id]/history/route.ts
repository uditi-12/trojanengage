import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { getFunnels } from "@/lib/services/funnel";
import { publicEvent } from "@/lib/services/serialize";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const events = await prisma.event.findMany({
    where: { orgId: params.id },
    include: { org: true, venue: true, record: { select: { id: true, approved: true } } },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });
  const funnels = await getFunnels(events.map((e) => e.id));
  return ok({
    events: events.map((e) => ({ ...publicEvent(e), funnel: funnels[e.id], record: e.record ? { id: e.record.id, approved: e.record.approved } : null })),
  });
});
