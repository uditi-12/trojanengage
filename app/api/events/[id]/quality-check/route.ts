import { handle, ok } from "@/lib/api";
import { runQualityCheck } from "@/lib/services/events";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const res = await runQualityCheck(params.id);
  return ok({ issues: res.data.issues, usedFallback: res.usedFallback });
});
