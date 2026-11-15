import { handle, ok } from "@/lib/api";
import { getEventSummary } from "@/lib/services/events";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => ok(await getEventSummary(params.id)));
