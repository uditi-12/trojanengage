import { handle, ok } from "@/lib/api";
import { approveRecord, serializeRecord } from "@/lib/services/records";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const r = await approveRecord(params.id);
  return ok({ record: serializeRecord(r) });
});
