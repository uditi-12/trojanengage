/* eslint-disable no-console */
// Adds (or re-dates to today) the live-until-11pm events without reseeding the database.
// Run: npx tsx prisma/add-live-today.ts
import { PrismaClient } from "@prisma/client";
import { embed } from "../lib/ai/client";
import { disableAiLogging } from "../lib/ai/log";
import { toJSON } from "../lib/json";
import { eventText } from "../lib/services/serialize";
import { dayOfWeek, fmt12, todayISO } from "../lib/time";
import { round } from "../lib/utils";
import { liveTodayEvents } from "./live-today";

const prisma = new PrismaClient();
disableAiLogging();

async function main() {
  const events = liveTodayEvents(todayISO());
  const venues = new Map((await prisma.venue.findMany()).map((v) => [v.id, v.name]));
  const vectors = await embed(events.map((e) => eventText({ ...e, tags: e.tags })), { log: false });
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const timing = { date: e.date, startTime: e.startTime, endTime: e.endTime, status: e.status };
    const data = {
      orgId: e.orgId,
      title: e.title,
      description: e.description,
      foodType: e.foodType,
      goodies: "goodies" in e ? e.goodies : "",
      ...timing,
      budget: e.budget,
      capacity: e.capacity,
      venueId: e.venueId,
      location: venues.get(e.venueId) ?? "",
      eventType: e.eventType,
      tags: toJSON(e.tags),
      accessibilityNotes: e.accessibilityNotes,
      flyerHeadline: e.title,
      flyerTagline: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek(e.date)]} ${fmt12(e.startTime)} · free food · free entry`,
      cardBlurb: e.description.split(/(?<=[.!?])\s/)[0].slice(0, 140),
      flyerColor: e.color,
      embedding: toJSON(vectors[i].map((x) => round(x, 5))),
    };
    await prisma.event.upsert({ where: { id: e.id }, create: { id: e.id, ...data }, update: timing });
    console.log(`✓ ${e.title} — ${e.date} ${e.startTime}–${e.endTime} (live)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
