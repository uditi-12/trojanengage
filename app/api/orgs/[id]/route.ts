import { prisma } from "@/lib/db";
import { body, handle, ok } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: params.id } });
  const counts = await prisma.event.groupBy({ by: ["status"], where: { orgId: org.id }, _count: { _all: true } });
  const records = await prisma.eventRecord.count({ where: { event: { orgId: org.id }, approved: true } });
  return ok({ org, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])), approvedRecords: records });
});

const OrgPatch = z.object({ name: z.string().min(1).max(100).optional(), category: z.string().max(60).optional(), description: z.string().max(1000).optional(), logoUrl: z.string().optional() });
export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const input = await body(req, OrgPatch);
  const org = await prisma.org.update({ where: { id: params.id }, data: input });
  return ok({ org });
});
