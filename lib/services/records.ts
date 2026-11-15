// Event records: generation on close (§4J + §4K), approval (embedding), and RAG retrieval for prefill (§4H).
import { prisma } from "../db";
import { parseJSON, parseNumbers, parseStrings, toJSON } from "../json";
import { embed, embedOne } from "../ai/client";
import { similarity } from "../ai/localEmbed";
import { clusterFeedback, generateRecord, type RetrievedRecord } from "../ai/features";
import type { Theme } from "../ai/schemas";
import { round } from "../utils";
import { getFunnel, getFunnels } from "./funnel";

export function recordEmbeddingText(title: string, markdown: string) {
  return `${title}. ${markdown.replace(/[#*|>-]/g, " ").replace(/\s+/g, " ").slice(0, 4000)}`;
}

export async function generateRecordForEvent(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { org: true, venue: true } });
  const [funnel, feedback] = await Promise.all([getFunnel(eventId), prisma.feedback.findMany({ where: { eventId } })]);
  const themesRes = await clusterFeedback(
    feedback.map((f) => ({ rating: f.rating, tag: f.tag, tags: parseStrings(f.tags), comment: f.comment })),
    event.title,
  );
  const themes = themesRes.data.themes;
  const rec = await generateRecord(
    {
      title: event.title,
      orgName: event.org.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      eventType: event.eventType,
      description: event.description,
      budget: event.budget,
      venueName: event.venue?.name ?? "",
      location: event.location,
      foodType: event.foodType,
      goodies: event.goodies,
      capacity: event.capacity,
      ticketCost: event.ticketCost,
    },
    { ...funnel },
    funnel.reasons,
    themes,
  );
  const stats = { ...funnel };
  const saved = await prisma.eventRecord.upsert({
    where: { eventId },
    create: {
      eventId,
      markdown: rec.data.markdown,
      stats: toJSON(stats),
      feedbackThemes: toJSON(themes),
      swipeInsights: toJSON(funnel.reasons),
      keepChange: toJSON({ keep: rec.data.keep, change: rec.data.change }),
      approved: false,
    },
    update: {
      markdown: rec.data.markdown,
      stats: toJSON(stats),
      feedbackThemes: toJSON(themes),
      swipeInsights: toJSON(funnel.reasons),
      keepChange: toJSON({ keep: rec.data.keep, change: rec.data.change }),
      approved: false,
    },
  });
  return { record: saved, usedFallback: rec.usedFallback };
}

export async function approveRecord(id: string) {
  const rec = await prisma.eventRecord.findUniqueOrThrow({ where: { id }, include: { event: true } });
  const vec = await embedOne(recordEmbeddingText(rec.event.title, rec.markdown), "recordEmbedding");
  return prisma.eventRecord.update({ where: { id }, data: { approved: true, embedding: toJSON(vec.map((x) => round(x, 5))) } });
}

export function serializeRecord(r: { id: string; eventId: string; markdown: string; stats: string; feedbackThemes: string; swipeInsights: string; keepChange: string; approved: boolean; createdAt: Date }) {
  return {
    id: r.id,
    eventId: r.eventId,
    markdown: r.markdown,
    stats: parseJSON<Record<string, unknown>>(r.stats, {}),
    feedbackThemes: parseJSON<Theme[]>(r.feedbackThemes, []),
    swipeInsights: parseJSON<Record<string, number>>(r.swipeInsights, {}),
    keepChange: parseJSON<{ keep: string[]; change: string[] }>(r.keepChange, { keep: [], change: [] }),
    approved: r.approved,
    createdAt: r.createdAt.toISOString(),
  };
}

/** RAG: top-k approved records of this org by embedding similarity to the draft text. */
export async function retrieveRecords(orgId: string, draftText: string, k = 3): Promise<RetrievedRecord[]> {
  const records = await prisma.eventRecord.findMany({
    where: { approved: true, event: { orgId } },
    include: { event: { include: { venue: true } } },
  });
  if (!records.length) return [];
  const [q] = await embed([draftText], { feature: "ragQueryEmbedding" });
  const scored = records
    .map((r) => ({ r, sim: similarity(q, parseNumbers(r.embedding), draftText, recordEmbeddingText(r.event.title, r.markdown)) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k);
  const funnels = await getFunnels(scored.map((s) => s.r.eventId));
  return scored.map(({ r, sim }) => {
    const f = funnels[r.eventId];
    const kc = parseJSON<{ keep: string[]; change: string[] }>(r.keepChange, { keep: [], change: [] });
    return {
      id: r.id,
      eventId: r.eventId,
      title: r.event.title,
      date: r.event.date,
      startTime: r.event.startTime,
      endTime: r.event.endTime,
      eventType: r.event.eventType,
      budget: r.event.budget,
      capacity: r.event.capacity,
      venueName: r.event.venue?.name ?? r.event.location,
      foodType: r.event.foodType,
      goodies: r.event.goodies,
      checkedIn: f?.checkedIn ?? 0,
      rightSwipes: f?.rightSwipes ?? 0,
      leftSwipes: f?.leftSwipes ?? 0,
      leftReasons: f?.reasons ?? {},
      avgRating: f?.avgRating ?? 0,
      keep: kc.keep ?? [],
      change: kc.change ?? [],
      themes: parseJSON<Theme[]>(r.feedbackThemes, []),
      similarity: round(sim, 3),
    };
  });
}
