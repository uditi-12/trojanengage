import { handle, ok } from "@/lib/api";
import { getSchedule, importUscSchedule } from "@/lib/services/schedule";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Re-sync classes from USC (simulated registrar feed). Personal blocks are untouched. */
export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  requireStudent(params.id);
  await importUscSchedule(params.id);
  return ok(await getSchedule(params.id));
});
