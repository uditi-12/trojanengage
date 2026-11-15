import { body, handle, ok } from "@/lib/api";
import { addBlock, getSchedule } from "@/lib/services/schedule";
import { requireStudent } from "@/lib/session";
import { BlockSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  requireStudent(params.id);
  return ok(await getSchedule(params.id));
});

/** Add a work/personal block (classes come from the USC import and can't be added by hand). */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  requireStudent(params.id);
  const block = await addBlock(params.id, await body(req, BlockSchema));
  return ok({ block }, 201);
});
