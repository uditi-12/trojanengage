import type { Event, Org, Venue } from "@prisma/client";
import { parseJSON, parseStrings } from "../json";

export type PublicEvent = Omit<Event, "embedding" | "tags" | "createdAt" | "restrictions" | "coHosts" | "agenda" | "detailedSummary"> & {
  tags: string[];
  restrictions: string[];
  coHosts: string[];
  agenda: { time: string; title: string; day?: string }[];
  createdAt: string;
  org?: { id: string; name: string; logoUrl: string; category: string } | null;
  venue?: { id: string; name: string; capacity: number; accessible: boolean; costPerHour: number } | null;
};

export function publicEvent(e: Event & { org?: Org | null; venue?: Venue | null }): PublicEvent {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { embedding, tags, org, venue, createdAt, restrictions, coHosts, agenda, detailedSummary, ...rest } = e;
  return {
    ...rest,
    tags: parseStrings(tags),
    restrictions: parseStrings(restrictions),
    coHosts: parseStrings(coHosts),
    agenda: parseJSON(agenda, [] as { time: string; title: string; day?: string }[]),
    createdAt: createdAt.toISOString(),
    org: org ? { id: org.id, name: org.name, logoUrl: org.logoUrl, category: org.category } : null,
    venue: venue ? { id: venue.id, name: venue.name, capacity: venue.capacity, accessible: venue.accessible, costPerHour: venue.costPerHour } : null,
  };
}

export function eventText(e: { title: string; description: string; tags: string | string[]; eventType: string }): string {
  const tags = Array.isArray(e.tags) ? e.tags : parseStrings(e.tags);
  return `${e.title}. ${e.description} Tags: ${tags.join(" ")}. Type: ${e.eventType}.`;
}
