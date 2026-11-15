import { handle, ok } from "@/lib/api";
import { rankFeed } from "@/lib/services/ranking";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  requireStudent(params.id);
  const events = await rankFeed(params.id);
  return ok({ events });
});
