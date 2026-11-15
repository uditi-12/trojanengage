import { body, handle, ok } from "@/lib/api";
import { askOrgAssistant, clearChat, getChatHistory } from "@/lib/services/chat";
import { requireOrg } from "@/lib/session";
import { ChatSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  requireOrg(params.id);
  return ok({ messages: await getChatHistory(params.id) });
});

export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  requireOrg(params.id);
  const { message } = await body(req, ChatSchema);
  return ok(await askOrgAssistant(params.id, message));
});

export const DELETE = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  requireOrg(params.id);
  await clearChat(params.id);
  return ok({ ok: true });
});
