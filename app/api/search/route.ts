import { handle, ok } from "@/lib/api";
import { searchEvents } from "@/lib/services/search";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const results = await searchEvents({
    q: sp.get("q") ?? "",
    type: sp.get("type") ?? undefined,
    audience: sp.get("audience") ?? undefined,
    free: sp.get("free") === "1" || sp.get("free") === "true",
    food: sp.get("food") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  return ok({ results });
});
