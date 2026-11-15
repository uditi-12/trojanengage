import { handle, ok } from "@/lib/api";
import { getOrgInsights } from "@/lib/services/insights";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  return ok(await getOrgInsights(params.id, { refresh }));
});
