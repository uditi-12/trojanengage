import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ok({ venues: await prisma.venue.findMany({ orderBy: { capacity: "asc" } }) }));
