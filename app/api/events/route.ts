import { body, handle, ok } from "@/lib/api";
import { createEvent } from "@/lib/services/events";
import { publicEvent } from "@/lib/services/serialize";
import { EventInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const input = await body(req, EventInputSchema);
  const e = await createEvent(input);
  return ok({ event: publicEvent(e) }, 201);
});
