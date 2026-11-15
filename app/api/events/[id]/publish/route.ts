import { handle, ok } from "@/lib/api";
import { publishEvent } from "@/lib/services/events";
import { publicEvent } from "@/lib/services/serialize";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const e = await publishEvent(params.id);
  return ok({ event: publicEvent(e) });
});
