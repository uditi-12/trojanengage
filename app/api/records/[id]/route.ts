import { prisma } from "@/lib/db";
import { body, handle, ok } from "@/lib/api";
import { serializeRecord } from "@/lib/services/records";
import { RecordPatchSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const r = await prisma.eventRecord.findUniqueOrThrow({ where: { id: params.id }, include: { event: { select: { id: true, title: true, orgId: true, date: true } } } });
  return ok({ record: serializeRecord(r), event: r.event });
});

export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { markdown } = await body(req, RecordPatchSchema);
  const r = await prisma.eventRecord.update({ where: { id: params.id }, data: { markdown } });
  return ok({ record: serializeRecord(r) });
});
