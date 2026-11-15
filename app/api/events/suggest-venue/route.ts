import { body, handle, ok } from "@/lib/api";
import { suggestVenues } from "@/lib/services/events";
import { VenueSuggestSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const { budget, capacity, hours } = await body(req, VenueSuggestSchema);
  return ok(await suggestVenues(budget, capacity, hours));
});
