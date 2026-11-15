import { body, handle, ok } from "@/lib/api";
import { deleteBlock, updateBlock } from "@/lib/services/schedule";
import { requireStudent } from "@/lib/session";
import { BlockPatchSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, { params }: { params: { blockId: string } }) => {
  const studentId = requireStudent();
  return ok({ block: await updateBlock(studentId, params.blockId, await body(req, BlockPatchSchema)) });
});

export const DELETE = handle(async (_req: Request, { params }: { params: { blockId: string } }) => {
  const studentId = requireStudent();
  await deleteBlock(studentId, params.blockId);
  return ok({ ok: true });
});
