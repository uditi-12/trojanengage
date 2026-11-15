import { prisma } from "@/lib/db";
import { body, handle, ok } from "@/lib/api";
import { importExtract } from "@/lib/services/events";
import { ImportSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  await prisma.org.findUniqueOrThrow({ where: { id: params.id } });
  const { text } = await body(req, ImportSchema);
  return ok(await importExtract(text));
});
