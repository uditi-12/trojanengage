import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { generateRecordForEvent, serializeRecord } from "@/lib/services/records";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  await prisma.event.update({ where: { id: params.id }, data: { status: "closed" } });
  const { record, usedFallback } = await generateRecordForEvent(params.id);
  return ok({ record: serializeRecord(record), usedFallback });
});
