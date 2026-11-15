import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export const DELETE = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const reg = await prisma.registration.findUniqueOrThrow({ where: { id: params.id } });
  requireStudent(reg.studentId);
  const updated = await prisma.registration.update({ where: { id: params.id }, data: { status: "cancelled", hasConflict: false, conflictNote: null } });
  return ok({ registration: updated });
});
