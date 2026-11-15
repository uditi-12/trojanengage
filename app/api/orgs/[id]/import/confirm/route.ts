import { body, handle, ok } from "@/lib/api";
import { importConfirm } from "@/lib/services/events";
import { ImportConfirmSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { rows } = await body(req, ImportConfirmSchema);
  return ok(await importConfirm(params.id, rows));
});
