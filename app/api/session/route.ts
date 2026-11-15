import { prisma } from "@/lib/db";
import { body, handle, ok } from "@/lib/api";
import { getSession, setSessionCookie } from "@/lib/session";
import { SessionSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

async function describe() {
  const session = getSession();
  const orgs = await prisma.org.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, logoUrl: true, category: true } });
  let current: unknown = null;
  if (session?.role === "student")
    current = await prisma.student.findUnique({ where: { id: session.id }, select: { id: true, name: true, email: true, avatarUrl: true, major: true, year: true, onboarded: true } });
  if (session?.role === "org") current = orgs.find((o) => o.id === session.id) ?? null;
  return { session: current ? session : null, current, orgs };
}

export const GET = handle(async () => ok(await describe()));

/** Demo org switcher only. Students must log in via /api/auth/login. */
export const POST = handle(async (req: Request) => {
  const input = await body(req, SessionSchema);
  const org = await prisma.org.findUnique({ where: { id: input.id } });
  if (!org) return ok({ error: "Unknown org" }, 404);
  setSessionCookie(input);
  return ok({ session: input, current: org });
});
