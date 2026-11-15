import { handle, ok } from "@/lib/api";
import { getProfile } from "@/lib/services/preferences";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: { params: { id: string } }) => {
  requireStudent(params.id);
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  return ok(await getProfile(params.id, { forceRefresh: refresh }));
});
