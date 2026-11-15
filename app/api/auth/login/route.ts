import { prisma } from "@/lib/db";
import { body, handle, HttpError, ok } from "@/lib/api";
import { normalizeEmail, verifyPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { importUscSchedule } from "@/lib/services/schedule";
import { LoginSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const { email, password, remember } = await body(req, LoginSchema);
  const student = await prisma.student.findUnique({ where: { email: normalizeEmail(email) } });
  if (!student || !verifyPassword(password, student.passwordHash)) throw new HttpError(401, "Wrong email or password.");
  // First login with a USC account pulls in the class schedule (simulated registrar import).
  if (!student.scheduleImportedAt) await importUscSchedule(student.id);
  const token = setSessionCookie({ role: "student", id: student.id }, remember);
  return ok({ token, student: { id: student.id, name: student.name, onboarded: student.onboarded } });
});
