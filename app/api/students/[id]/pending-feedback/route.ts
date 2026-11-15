import { handle, ok } from "@/lib/api";
import { pendingFeedback } from "@/lib/services/events";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  requireStudent(params.id);
  return ok({ pending: await pendingFeedback(params.id) });
});
