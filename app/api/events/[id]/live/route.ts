import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { getFunnel } from "@/lib/services/funnel";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const e = await prisma.event.findUniqueOrThrow({ where: { id: params.id }, select: { id: true, title: true, status: true, capacity: true } });
  const recent = await prisma.checkIn.findMany({ where: { eventId: e.id }, include: { student: { select: { name: true, avatarUrl: true } } }, orderBy: { createdAt: "desc" }, take: 8 });
  return ok({ event: e, funnel: await getFunnel(e.id), recent: recent.map((c) => ({ name: c.student.name, avatarUrl: c.student.avatarUrl, at: c.createdAt })) });
});
