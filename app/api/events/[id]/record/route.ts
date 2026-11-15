import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { generateRecordForEvent, serializeRecord } from "@/lib/services/records";

export const dynamic = "force-dynamic";

// Fetch the record for an event; generate one if the event is closed but has none yet.
export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: params.id }, select: { id: true, title: true, orgId: true, date: true, status: true } });
  let r = await prisma.eventRecord.findUnique({ where: { eventId: params.id } });
  if (!r && event.status === "closed") r = (await generateRecordForEvent(params.id)).record;
  return ok({ event, record: r ? serializeRecord(r) : null });
});

// Regenerate the draft record.
export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const { record } = await generateRecordForEvent(params.id);
  return ok({ record: serializeRecord(record) });
});
