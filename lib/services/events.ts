// Event lifecycle: create / update / publish / card generation / quality / venues / prefill /
// attendance (check-in, feedback) / simulation / import. Route handlers call into here.
import type { Event, Prisma, Venue } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { parseJSON, parseStrings, parseWeights, toJSON } from "../json";
import { embedOne, image } from "../ai/client";
import { extractPastEvents, generateCard, qualityCheck, suggestPlan, summarizeEvent, type EventDraft } from "../ai/features";
import type { EventSummary } from "../ai/schemas";
import { localEmbed } from "../ai/localEmbed";
import type { EventInput } from "../validators";
import { FEEDBACK_LABELS, keywordTags, normalizeTags } from "../taxonomy";
import { addDays, fmt12, formatDate, toMinutes, todayISO } from "../time";
import { pct, round } from "../utils";
import { applyFeedbackWeights, slotKey } from "./preferences";
import { computeOrgSwipeInsights } from "./insights";
import { recordEmbeddingText, retrieveRecords } from "./records";
import { eventText } from "./serialize";

export function toDraft(e: Partial<EventInput> & { title?: string }, venue?: Pick<Venue, "name" | "accessible"> | null): EventDraft {
  const today = todayISO();
  return {
    title: e.title ?? "",
    description: e.description ?? "",
    foodType: e.foodType ?? "none",
    goodies: e.goodies ?? "",
    date: e.date ?? addDays(today, 7),
    startTime: e.startTime ?? "18:00",
    endTime: e.endTime ?? "20:00",
    budget: e.budget ?? 0,
    capacity: e.capacity ?? 50,
    location: e.location ?? "",
    venueName: venue?.name ?? null,
    venueAccessible: venue ? venue.accessible : null,
    eventType: e.eventType ?? "other",
    audience: e.audience ?? "all",
    ticketCost: e.ticketCost ?? 0,
    tags: e.tags ?? [],
    accessibilityNotes: e.accessibilityNotes ?? "",
    websiteUrl: e.websiteUrl ?? null,
  };
}

export function eventToDraft(e: Event & { venue?: Venue | null }): EventDraft {
  return toDraft(
    {
      title: e.title,
      description: e.description,
      goodies: e.goodies,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      budget: e.budget,
      capacity: e.capacity,
      location: e.location,
      ticketCost: e.ticketCost,
      accessibilityNotes: e.accessibilityNotes,
      websiteUrl: e.websiteUrl,
      tags: parseStrings(e.tags),
      foodType: e.foodType as EventInput["foodType"],
      eventType: e.eventType as EventInput["eventType"],
      audience: e.audience as EventInput["audience"],
    },
    e.venue,
  );
}

/** Detailed student-facing summary (cached on the event; cleared when the org edits it). */
export async function getEventSummary(id: string) {
  const e = await prisma.event.findUniqueOrThrow({ where: { id }, include: { venue: true, org: true } });
  const cached = parseJSON<EventSummary | null>(e.detailedSummary, null);
  if (cached?.overview) return { summary: cached, cached: true };
  const registered = await prisma.registration.count({ where: { eventId: id, status: "registered" } });
  const res = await summarizeEvent({
    ...eventToDraft(e),
    orgName: e.org.name,
    endDate: e.endDate,
    campus: e.campus,
    format: e.format,
    virtualUrl: e.virtualUrl,
    restrictions: parseStrings(e.restrictions),
    coHosts: parseStrings(e.coHosts),
    agenda: parseJSON(e.agenda, [] as { time: string; title: string; day?: string }[]),
    capacity: e.capacity,
    spotsLeft: Math.max(0, e.capacity - registered),
  });
  await prisma.event.update({ where: { id }, data: { detailedSummary: toJSON(res.data) } });
  return { summary: res.data, cached: false };
}

function dataFromInput(input: Partial<EventInput> & { status?: string }): Prisma.EventUncheckedUpdateInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tags, orgId, venueId, restrictions, coHosts, agenda, ...rest } = input;
  const data: Prisma.EventUncheckedUpdateInput = { ...rest };
  if (tags) data.tags = toJSON(tags);
  if (restrictions) data.restrictions = toJSON(restrictions);
  if (coHosts) data.coHosts = toJSON(coHosts);
  if (agenda) data.agenda = toJSON(agenda);
  if ("venueId" in input) data.venueId = venueId || null;
  return data;
}

async function locationForVenue(venueId?: string | null) {
  if (!venueId) return null;
  return prisma.venue.findUnique({ where: { id: venueId } });
}

export async function createEvent(input: EventInput) {
  const venue = await locationForVenue(input.venueId);
  const { tags, venueId, websiteUrl, flyerImageUrl, restrictions, coHosts, agenda, endDate, virtualUrl, registrationUrl, ...rest } = input;
  return prisma.event.create({
    data: {
      ...rest,
      endDate: endDate ?? null,
      virtualUrl: virtualUrl ?? null,
      registrationUrl: registrationUrl ?? null,
      restrictions: toJSON(restrictions),
      coHosts: toJSON(coHosts),
      agenda: toJSON(agenda),
      tags: toJSON(tags),
      venueId: venueId || null,
      websiteUrl: websiteUrl ?? null,
      flyerImageUrl: flyerImageUrl ?? null,
      location: input.location || venue?.name || "",
      status: "draft",
    },
  });
}

export async function updateEvent(id: string, patch: Partial<EventInput> & { status?: string }) {
  const data = dataFromInput(patch);
  const contentChanged = Object.keys(patch).some((k) => !["status"].includes(k));
  if (contentChanged) data.detailedSummary = null; // regenerate the student summary after edits
  if (patch.venueId && !patch.location) {
    const v = await locationForVenue(patch.venueId);
    if (v) data.location = v.name;
  }
  const updated = await prisma.event.update({ where: { id }, data });
  // Published/live events stay in the feed — keep their embedding in sync with the edited content.
  if (contentChanged && (updated.status === "published" || updated.status === "live")) {
    return prisma.event.update({ where: { id }, data: { embedding: await computeEventEmbedding(updated) } });
  }
  return updated;
}

export async function computeEventEmbedding(e: { title: string; description: string; tags: string; eventType: string }) {
  const v = await embedOne(eventText(e), "eventEmbedding");
  return toJSON(v.map((x) => round(x, 5)));
}

export async function generateCardForEvent(id: string, opts: { withImage?: boolean } = {}) {
  const e = await prisma.event.findUniqueOrThrow({ where: { id }, include: { venue: true } });
  const res = await generateCard(eventToDraft(e));
  const card = res.data;
  const tags = normalizeTags([...card.tags, ...parseStrings(e.tags)]).slice(0, 6);
  let flyerImageUrl = e.flyerImageUrl;
  if (opts.withImage !== false && card.imagePrompt) {
    const url = await image(card.imagePrompt, e.id);
    if (url) flyerImageUrl = url;
  }
  const updated = await prisma.event.update({
    where: { id },
    data: { flyerHeadline: card.headline, flyerTagline: card.tagline, cardBlurb: card.blurb, flyerColor: card.color, tags: toJSON(tags), flyerImageUrl },
  });
  return { event: updated, card: { ...card, tags }, usedFallback: res.usedFallback };
}

export async function publishEvent(id: string) {
  let e = await prisma.event.findUniqueOrThrow({ where: { id } });
  if (!e.flyerHeadline || !e.cardBlurb) {
    e = (await generateCardForEvent(id, { withImage: false })).event;
  }
  if (parseStrings(e.tags).length === 0) {
    const t = keywordTags(`${e.title} ${e.description}`, 5);
    e = await prisma.event.update({ where: { id }, data: { tags: toJSON(t) } });
  }
  const embedding = await computeEventEmbedding(e);
  // Reset createdAt so the feed's "just posted" boost applies from the moment of publishing.
  return prisma.event.update({ where: { id }, data: { embedding, status: "published", createdAt: new Date() } });
}

export async function runQualityCheck(id: string) {
  const e = await prisma.event.findUniqueOrThrow({ where: { id }, include: { venue: true } });
  return qualityCheck(eventToDraft(e));
}

/** Budget → capacity → venue helper. */
export async function suggestVenues(budget: number, capacity?: number | null, hours = 2) {
  const venues = await prisma.venue.findMany();
  // Rough planning heuristic: ~$8 per attendee covers food + basics when capacity isn't given.
  const cap = capacity && capacity > 0 ? capacity : Math.max(15, Math.round(budget / 8 / 5) * 5);
  const venueBudget = budget * 0.4; // keep ≥60% of the budget for food, goodies and AV
  const ranked = venues
    .map((v) => {
      const cost = v.costPerHour * hours;
      const fitsCapacity = v.capacity >= cap;
      const fitsBudget = cost <= venueBudget;
      const sizeFit = fitsCapacity ? cap / v.capacity : v.capacity / cap; // 1 = perfect size
      const score = (fitsCapacity ? 0.5 : 0) + (fitsBudget ? 0.25 : 0) + (v.accessible ? 0.1 : 0) + 0.15 * sizeFit;
      const reasons = [
        fitsCapacity ? `Fits ${cap} (${pct(cap, v.capacity)}% full)` : `Only ${v.capacity} seats`,
        cost === 0 ? "Free to book" : fitsBudget ? `$${cost} for ${hours}h — within budget` : `$${cost} for ${hours}h — over venue budget`,
        v.accessible ? "Step-free access" : "Not step-free",
      ];
      return { ...v, totalCost: cost, fitsCapacity, fitsBudget, score: round(score, 3), reasons };
    })
    .sort((a, b) => b.score - a.score);
  return { capacity: cap, venueBudget: round(venueBudget), venues: ranked };
}

export async function prefillFromHistory(orgId: string, draftInput: Partial<EventInput> & { title?: string }) {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });
  const venue = await locationForVenue(draftInput.venueId);
  const draft = toDraft(draftInput, venue);
  const text = `${draft.title}. ${draft.description} ${(draft.tags ?? []).join(" ")} ${draft.eventType}`;
  const [records, insights, venues] = await Promise.all([retrieveRecords(orgId, text, 3), computeOrgSwipeInsights(orgId), prisma.venue.findMany()]);
  const res = await suggestPlan(draft, org.name, records, insights.swipeInsights, venues);
  // Validate venueId against real venues.
  const v = venues.find((x) => x.id === res.data.prefill.venueId) ?? venues.find((x) => x.name === res.data.prefill.venue);
  res.data.prefill.venueId = v?.id ?? null;
  if (v) res.data.prefill.venue = v.name;
  return { ...res.data, records: records.map((r) => ({ id: r.id, eventId: r.eventId, title: r.title, date: r.date, similarity: r.similarity })), usedFallback: res.usedFallback };
}

// ───────────── Attendance ─────────────
export async function checkIn(studentId: string, eventId: string) {
  const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  if (e.status !== "live") {
    return { ok: false as const, reason: e.status === "closed" ? "This event has ended." : "Check-in opens when the event goes live." };
  }
  const existing = await prisma.checkIn.findUnique({ where: { studentId_eventId: { studentId, eventId } } });
  if (existing) return { ok: true as const, already: true, checkIn: existing };
  // Only registered attendees can check in — saved (pre-registered), waitlisted or unregistered students can't.
  const reg = await prisma.registration.findUnique({ where: { studentId_eventId: { studentId, eventId } } });
  if (!reg || reg.status !== "registered") {
    return { ok: false as const, reason: reg?.status === "waitlisted" ? "You're on the waitlist — only registered attendees can check in." : "Register for this event before checking in." };
  }
  const checkInRow = await prisma.checkIn.create({ data: { studentId, eventId } });
  return { ok: true as const, already: false, checkIn: checkInRow };
}

/** Feedback is only collected from verified attendees: registered AND checked in. */
export async function feedbackEligibility(studentId: string, eventId: string) {
  const [reg, check] = await Promise.all([
    prisma.registration.findUnique({ where: { studentId_eventId: { studentId, eventId } } }),
    prisma.checkIn.findUnique({ where: { studentId_eventId: { studentId, eventId } } }),
  ]);
  if (!check) return { ok: false as const, reason: "Feedback opens after you check in at the event." };
  if (!reg || reg.status !== "registered") return { ok: false as const, reason: "Only registered attendees can leave feedback." };
  return { ok: true as const };
}

/** Events the student registered for and checked in to, but hasn't rated yet. */
export async function pendingFeedback(studentId: string) {
  const checks = await prisma.checkIn.findMany({ where: { studentId }, include: { event: { include: { org: true } } }, orderBy: { createdAt: "desc" } });
  if (!checks.length) return [];
  const [regs, given] = await Promise.all([
    prisma.registration.findMany({ where: { studentId, status: "registered", eventId: { in: checks.map((c) => c.eventId) } }, select: { eventId: true } }),
    prisma.feedback.findMany({ where: { studentId }, select: { eventId: true } }),
  ]);
  const registered = new Set(regs.map((r) => r.eventId));
  const done = new Set(given.map((g) => g.eventId));
  return checks
    .filter((c) => registered.has(c.eventId) && !done.has(c.eventId))
    .map((c) => ({ eventId: c.eventId, title: c.event.flyerHeadline || c.event.title, orgName: c.event.org.name, date: c.event.date, checkedInAt: c.createdAt.toISOString() }));
}

export async function submitFeedback(studentId: string, input: { eventId: string; rating: number; tag?: string; tags?: string[]; comment?: string | null }) {
  const tags = Array.from(new Set(input.tags?.length ? input.tags : input.tag ? [input.tag] : []));
  if (!tags.length) throw new HttpError(400, "Pick at least one tag.");
  const elig = await feedbackEligibility(studentId, input.eventId);
  if (!elig.ok) throw new HttpError(403, elig.reason);
  const [student, event] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id: studentId } }),
    prisma.event.findUniqueOrThrow({ where: { id: input.eventId } }),
  ]);
  const prior = await prisma.feedback.findFirst({ where: { studentId, eventId: input.eventId } });
  const data = { rating: input.rating, tag: tags[0], tags: toJSON(tags), comment: input.comment ?? null };
  const fb = prior
    ? await prisma.feedback.update({ where: { id: prior.id }, data })
    : await prisma.feedback.create({ data: { studentId, eventId: input.eventId, ...data } });
  if (!prior) {
    const w = applyFeedbackWeights(parseWeights(student.tagWeights), parseStrings(event.tags), input.rating);
    const slot = parseWeights(student.slotWeights);
    const type = parseWeights(student.typeWeights);
    const k = slotKey(event.date, event.startTime);
    if (input.rating >= 4) {
      slot[k] = round((slot[k] ?? 0) + 0.1);
      type[event.eventType] = round((type[event.eventType] ?? 0) + 0.2);
    } else if (input.rating <= 2) type[event.eventType] = round((type[event.eventType] ?? 0) - 0.1);
    if (tags.includes("bad-timing")) slot[k] = round((slot[k] ?? 0) - 0.2);
    await prisma.student.update({ where: { id: studentId }, data: { tagWeights: toJSON(w), slotWeights: toJSON(slot), typeWeights: toJSON(type) } });
  }
  return fb;
}

// ───────────── Demo simulation ─────────────
const FIRST = ["Aarav", "Sofia", "Jordan", "Mei", "Diego", "Fatima", "Noah", "Ananya", "Liam", "Zoe", "Kenji", "Isabella", "Omar", "Chloe", "Ravi", "Emma", "Tariq", "Grace", "Leo", "Nia", "Arjun", "Hana", "Mateo", "Ivy"];
const LAST = ["Patel", "Garcia", "Kim", "Nguyen", "Johnson", "Singh", "Chen", "Lopez", "Shah", "Williams", "Park", "Rao"];
const COMMENTS: Record<string, string[]> = {
  "great-food": ["The food was amazing, thank you!", "Loved the food", "Boba was a great touch", "Food went fast but it was so good"],
  "well-organized": ["Super smooth check-in", "Really well run, started on time", "Clear agenda, great volunteers"],
  "learned-a-lot": ["Learned so much, want a part 2", "The hands-on part was the best", "Finally understood how it works", "Great examples, very practical"],
  "too-long": ["A bit too long", "Could have been 30 min shorter", "Shorten the speeches"],
  "bad-timing": ["Start earlier please", "Clashed with my midterm week", "Late start made it hard to stay"],
  crowded: ["Room was packed", "Needed a bigger room", "Hard to find a seat"],
  boring: ["Slow first half", "Too much lecture, not enough doing"],
};

function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export async function simulateAttendees(eventId: string, n: number) {
  const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const rand = seededRandom(Date.now());
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const tags = parseStrings(e.tags);
  const tagPool = (tags.includes("hands-on") || e.eventType === "workshop"
    ? ["learned-a-lot", "learned-a-lot", "great-food", "well-organized", "too-long", "crowded"]
    : e.eventType === "cultural"
      ? ["great-food", "great-food", "well-organized", "too-long", "bad-timing", "crowded"]
      : ["well-organized", "great-food", "learned-a-lot", "boring", "bad-timing"]) as string[];
  const reasons = ["time", "time", "topic", "cost", "vague", "not-for-me"];
  let created = 0;
  for (let i = 0; i < n; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const student = await prisma.student.create({
      data: {
        id: `sim_${eventId.slice(-6)}_${Date.now().toString(36)}_${i}`,
        name,
        avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name + i)}`,
        major: pick(["Computer Science", "Data Science", "Business", "EE", "Cinema", "Biology"]),
        year: pick(["Freshman", "Sophomore", "Junior", "Senior", "Masters"]),
        onboarded: true,
      },
    });
    await prisma.swipe.create({ data: { studentId: student.id, eventId, direction: "right" } });
    await prisma.registration.create({ data: { studentId: student.id, eventId, status: "registered" } });
    await prisma.checkIn.create({ data: { studentId: student.id, eventId } });
    const tag = pick(tagPool);
    const positive = ["great-food", "well-organized", "learned-a-lot"].includes(tag);
    const rating = positive ? (rand() < 0.6 ? 5 : 4) : rand() < 0.5 ? 3 : 2;
    const extra = rand() < 0.45 ? pick(positive ? ["would-return", "made-friends", "great-speakers"] : ["hard-to-find", "too-long"]) : null;
    const fbTags = extra && extra !== tag ? [tag, extra] : [tag];
    await prisma.feedback.create({ data: { studentId: student.id, eventId, rating, tag, tags: toJSON(fbTags), comment: rand() < 0.75 ? pick(COMMENTS[tag] ?? [""]) : null } });
    // Some simulated passers-by swipe left with a reason, so the record has "why students passed".
    if (rand() < 0.4) {
      const passer = await prisma.student.create({
        data: { id: `sim_${eventId.slice(-6)}_${Date.now().toString(36)}_${i}_p`, name: `${pick(FIRST)} ${pick(LAST)}`, avatarUrl: "", major: "Undeclared", year: "Sophomore", onboarded: true },
      });
      await prisma.swipe.create({ data: { studentId: passer.id, eventId, direction: "left", reason: pick(reasons) } });
    }
    created++;
  }
  return { created };
}

// ───────────── Import past events ─────────────
export async function importExtract(text: string) {
  const res = await extractPastEvents(text);
  return { rows: res.data.events, usedFallback: res.usedFallback };
}

export async function importConfirm(
  orgId: string,
  rows: { title: string; date: string; startTime: string; endTime: string; eventType: string; description: string; location: string; foodType: string; budget: number; capacity: number; attendance: number; rating: number; tags: string[]; notes: string }[],
) {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });
  const created: string[] = [];
  for (const r of rows) {
    const tags = r.tags.length ? r.tags : keywordTags(`${r.title} ${r.description}`, 5);
    const base = { title: r.title, description: r.description, tags: toJSON(tags), eventType: r.eventType };
    const embedding = toJSON(localEmbed(eventText(base)).map((x) => round(x, 5)));
    const event = await prisma.event.create({
      data: {
        orgId,
        title: r.title,
        description: r.description || `Imported from ${org.name}'s past event notes.`,
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
        eventType: r.eventType,
        location: r.location,
        foodType: r.foodType,
        budget: r.budget,
        capacity: r.capacity,
        tags: toJSON(tags),
        flyerHeadline: r.title.slice(0, 50),
        cardBlurb: (r.description || r.title).slice(0, 140),
        embedding,
        status: "closed",
      },
    });
    const notes = r.notes.trim();
    const keep = notes && /(loved|great|worked|good|amazing|keep)/i.test(notes) ? [notes.split(/[.;]/)[0].trim()] : [];
    const change = notes && /(late|long|crowd|earlier|shorten|bad|fix|change|too)/i.test(notes) ? [notes.split(/[.;]/).find((s) => /(late|long|crowd|earlier|shorten|bad|fix|change|too)/i.test(s))?.trim() ?? notes] : [];
    const markdown = `# ${r.title} — Event Record (imported)

## Overview
Imported from past notes. Held ${formatDate(r.date)}, ${fmt12(r.startTime)}–${fmt12(r.endTime)}${r.location ? ` at ${r.location}` : ""}.${r.attendance ? ` About ${r.attendance} attended (${pct(r.attendance, r.capacity)}% of capacity ${r.capacity}).` : ""}${r.rating ? ` Rated ${r.rating}/5.` : ""}

## What was planned
| Item | Plan |
|---|---|
| Budget | $${r.budget} |
| Venue | ${r.location || "—"} |
| Capacity | ${r.capacity} |
| Food | ${r.foodType} |

## What students said
${notes || "No notes recorded."}

## Keep / Change next time
**Keep**
${(keep.length ? keep : ["—"]).map((k) => `- ${k}`).join("\n")}

**Change**
${(change.length ? change : ["—"]).map((c) => `- ${c}`).join("\n")}
`;
    await prisma.eventRecord.create({
      data: {
        eventId: event.id,
        markdown,
        stats: toJSON({ checkedIn: r.attendance, capacity: r.capacity, avgRating: r.rating, imported: true }),
        feedbackThemes: toJSON([]),
        swipeInsights: toJSON({}),
        keepChange: toJSON({ keep, change }),
        embedding: toJSON(localEmbed(recordEmbeddingText(r.title, markdown)).map((x) => round(x, 5))),
        approved: true,
      },
    });
    created.push(event.id);
  }
  return { created: created.length, eventIds: created };
}

export function feedbackLabel(tag: string) {
  return FEEDBACK_LABELS[tag] ?? tag;
}

export function durationHours(start: string, end: string) {
  return Math.max(0.5, (toMinutes(end) - toMinutes(start)) / 60);
}
