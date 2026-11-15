import { body, handle, ok } from "@/lib/api";
import { checkAvailability } from "@/lib/services/availability";
import { AvailabilitySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** Org scheduling helper: campus event clashes, venue double-booking, % of interested students free, better slots. */
export const POST = handle(async (req: Request) => ok(await checkAvailability(await body(req, AvailabilitySchema))));
