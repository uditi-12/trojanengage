import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { chatModel, chatProvider, embeddingsProvider, imagesEnabled } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const logs = await prisma.aiLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const p = chatProvider();
  return ok({ config: { provider: p, model: chatModel(p), embeddings: embeddingsProvider(), images: imagesEnabled() }, logs });
});
