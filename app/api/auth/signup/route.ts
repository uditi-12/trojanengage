import { prisma } from "@/lib/db";
import { body, handle, HttpError, ok } from "@/lib/api";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { importUscSchedule } from "@/lib/services/schedule";
import { SignupSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const input = await body(req, SignupSchema);
  const email = normalizeEmail(input.email);
  if (await prisma.student.findUnique({ where: { email } })) throw new HttpError(409, "An account with that email already exists — log in instead.");
  const student = await prisma.student.create({
    data: {
      name: input.name,
      email,
      passwordHash: hashPassword(input.password),
      major: input.major,
      year: input.year,
      avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(input.name)}`,
      onboarded: false,
    },
  });
  const classes = await importUscSchedule(student.id);
  const token = setSessionCookie({ role: "student", id: student.id });
  return ok({ token, importedClassBlocks: classes, student: { id: student.id, name: student.name, onboarded: false } }, 201);
});
