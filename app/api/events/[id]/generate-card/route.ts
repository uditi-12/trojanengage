import { handle, ok } from "@/lib/api";
import { generateCardForEvent } from "@/lib/services/events";
import { publicEvent } from "@/lib/services/serialize";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const res = await generateCardForEvent(params.id);
  return ok({ event: publicEvent(res.event), card: res.card, usedFallback: res.usedFallback });
});
