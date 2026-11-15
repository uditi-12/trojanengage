import { prisma } from "@/lib/db";
import { body, handle, ok } from "@/lib/api";
import { registerForEvent } from "@/lib/services/registrations";
import { requireStudent } from "@/lib/session";
import { RegisterSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** Saved → registered. Returns 409 {needsConfirmation, conflicts} on a clash unless {force:true}. */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const reg = await prisma.registration.findUniqueOrThrow({ where: { id: params.id } });
  requireStudent(reg.studentId);
  const { force } = await body(req, RegisterSchema);
  const res = await registerForEvent(reg.studentId, reg.eventId, force);
  return ok(res, res.ok ? 200 : 409);
});
