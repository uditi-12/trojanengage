import { body, handle, ok } from "@/lib/api";
import { simulateAttendees } from "@/lib/services/events";
import { SimulateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const { n } = await body(req, SimulateSchema);
  return ok(await simulateAttendees(params.id, n));
});
