// Hybrid search: keyword match + embedding similarity, with filters.
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { parseNumbers, parseStrings } from "../json";
import { embedOne } from "../ai/client";
import { similarity, tokenize } from "../ai/localEmbed";
import { isPast } from "../time";
import { round } from "../utils";
import { eventText, publicEvent, type PublicEvent } from "./serialize";

export type SearchParams = { q?: string; type?: string; audience?: string; free?: boolean; food?: string; from?: string; to?: string };
export type SearchHit = PublicEvent & { score: number; keywordScore: number; semanticScore: number };

export function keywordScore(qTokens: string[], e: { title: string; description: string; tags: string[]; eventType: string; orgName?: string }) {
  if (!qTokens.length) return 0;
  const title = e.title.toLowerCase();
  const body = `${e.description} ${e.tags.join(" ")} ${e.eventType} ${e.orgName ?? ""}`.toLowerCase();
  let s = 0;
  for (const t of qTokens) {
    if (title.includes(t)) s += 2;
    else if (body.includes(t)) s += 1;
  }
  return s / (qTokens.length * 2);
}

export async function searchEvents(p: SearchParams): Promise<SearchHit[]> {
  const where: Prisma.EventWhereInput = { status: { in: ["published", "live"] } };
  if (p.type && p.type !== "any") where.eventType = p.type;
  if (p.audience && p.audience !== "any") where.audience = { in: [p.audience, "all"] };
  if (p.food && p.food !== "any") where.foodType = p.food;
  if (p.free) where.ticketCost = 0;
  if (p.from || p.to) where.date = { ...(p.from ? { gte: p.from } : {}), ...(p.to ? { lte: p.to } : {}) };
  const events = await prisma.event.findMany({ where, include: { org: true, venue: true }, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
  const upcoming = events.filter((e) => e.status === "live" || !isPast(e.date, e.endTime));
  const q = (p.q ?? "").trim();
  if (!q) return upcoming.map((e) => ({ ...publicEvent(e), score: 0, keywordScore: 0, semanticScore: 0 }));
  const qTokens = tokenize(q);
  const qVec = await embedOne(q, "searchEmbedding");
  const hits = upcoming.map((e) => {
    const tags = parseStrings(e.tags);
    const kw = keywordScore(qTokens, { title: e.title, description: e.description, tags, eventType: e.eventType, orgName: e.org.name });
    const sem = Math.max(0, similarity(qVec, parseNumbers(e.embedding), q, eventText(e)));
    return { ...publicEvent(e), keywordScore: round(kw, 3), semanticScore: round(sem, 3), score: round(0.5 * kw + 0.5 * sem, 4) };
  });
  return hits.filter((h) => h.keywordScore > 0 || h.semanticScore > 0.12).sort((a, b) => b.score - a.score);
}
