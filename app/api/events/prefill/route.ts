import { body, handle, ok } from "@/lib/api";
import { prefillFromHistory } from "@/lib/services/events";
import { PrefillSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const { orgId, draft } = await body(req, PrefillSchema);
  return ok(await prefillFromHistory(orgId, draft));
});
