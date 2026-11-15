// Hybrid feed ranking (spec §4E). No LLM per request — pure math over stored vectors + weights.
import type { Event, Org, ScheduleBlock, Student, Venue } from "@prisma/client";
import { prisma } from "../db";
import { parseJSON, parseNumbers, parseStrings, parseWeights } from "../json";
import { similarity } from "../ai/localEmbed";
import { DAYS, TAG_LABELS } from "../taxonomy";
import { dayOfWeek, freeSlotFit, isPast, timeBucket, type FreeSlot } from "../time";
import { clamp, round } from "../utils";
import { conflictBetween } from "./conflicts";
import { blockClashes, eventSegments } from "./schedule";
import { profileText } from "./preferences";
import { eventText, publicEvent, type PublicEvent } from "./serialize";

export const WEIGHTS = { cosine: 0.35, tags: 0.25, goals: 0.15, slot: 0.15, friends: 0.1 } as const;

export type Factors = { cosine: number; tags: number; goals: number; slot: number; friends: number; penalty: number; fresh: number; slotPref: number; typePref: number };
export type FriendLite = { id: string; name: string; avatarUrl: string };
export type RankedEvent = PublicEvent & {
  score: number;
  why: string;
  factors: Factors;
  friendsGoing: FriendLite[];
  conflict: { title: string } | null;
  conflicts: { kind: string; title: string; when: string }[];
  isNew: boolean;
  matchPct: number;
  rankPos: number;
};

/**
 * Interest match % shown to students ("87% match"). Independent of time/friends: it answers
 * "how much is this my kind of thing?" from topic weights, profile similarity, goals and type preference.
 */
export function interestMatch(cos: number, weights: Record<string, number>, tags: string[], goal: number, typePref: number): number {
  const topical = tags.filter((t) => !GENERIC_TAGS.has(t));
  const use = topical.length ? topical : tags;
  const tagPos = use.length ? use.reduce((s, t) => s + Math.min(Math.max(weights[t] ?? 0, 0), 1.5) / 1.5, 0) / Math.min(3, use.length) : 0;
  const cosNorm = clamp(cos / 0.45, 0, 1);
  const raw = 0.45 * clamp(tagPos, 0, 1) + 0.3 * cosNorm + 0.15 * goal + 0.1 * clamp(0.5 + typePref / 2, 0, 1);
  return Math.round(clamp(raw, 0, 0.99) * 100);
}

// Format/perk tags make weak "why" explanations ("Matches your Food interest"); prefer topics.
const GENERIC_TAGS = new Set(["food", "hands-on", "beginner-friendly", "social", "talk", "festival"]);

export function tagWeightMatch(weights: Record<string, number>, tags: string[]): { value: number; best: string | null } {
  if (!tags.length) return { value: 0, best: null };
  const pos = Object.values(weights);
  const norm = Math.sqrt(pos.reduce((s, w) => s + w * w, 0)) || 1;
  let dot = 0;
  let best: string | null = null;
  let bestScore = 0;
  for (const t of tags) {
    const w = weights[t] ?? 0;
    dot += w;
    const sc = GENERIC_TAGS.has(t) ? w * 0.4 : w;
    if (w > 0 && sc > bestScore) {
      bestScore = sc;
      best = t;
    }
  }
  return { value: clamp(dot / (norm * Math.sqrt(tags.length)), -1, 1), best };
}

export function goalMatch(goals: string[], e: Pick<Event, "foodType" | "eventType">, tags: string[]): { value: number; hit: string | null } {
  if (!goals.length) return { value: 0, hit: null };
  const hits: string[] = [];
  for (const g of goals) {
    if (g === "free-food" && e.foodType === "free") hits.push(g);
    else if (g === "career" && (["career", "fair", "info-session"].includes(e.eventType) || tags.includes("career"))) hits.push(g);
    else if (g === "network" && (tags.includes("networking") || ["career", "social", "fair", "conference"].includes(e.eventType))) hits.push(g);
    else if (g === "learn-skills" && (["workshop", "hackathon", "academic", "conference"].includes(e.eventType) || tags.includes("hands-on"))) hits.push(g);
    else if (g === "make-friends" && (["social", "watch-party", "trip", "sports", "general-meeting"].includes(e.eventType) || tags.includes("social"))) hits.push(g);
    else if (g === "culture" && (["cultural", "performance", "exhibition", "screening", "faith"].includes(e.eventType) || tags.includes("culture"))) hits.push(g);
  }
  return { value: clamp(hits.length / Math.min(2, goals.length), 0, 1), hit: hits[0] ?? null };
}

const GOAL_WHY: Record<string, string> = {
  "free-food": "Free food 🍕",
  career: "Good for your career goal",
  network: "Great for networking",
  "learn-skills": "You'll learn a skill",
  "make-friends": "Easy place to make friends",
  culture: "Matches your culture goal",
};

export function buildWhy(f: Factors, ctx: { bestTag: string | null; goalHit: string | null; date: string; startTime: string; friendNames: string[] }): string {
  const parts: { v: number; text: string }[] = [
    { v: WEIGHTS.cosine * f.cosine, text: "Close to what you're into" },
    { v: WEIGHTS.tags * Math.max(0, f.tags), text: ctx.bestTag ? `Matches your ${TAG_LABELS[ctx.bestTag] ?? ctx.bestTag} interest` : "Matches your interests" },
    { v: WEIGHTS.goals * f.goals, text: ctx.goalHit ? GOAL_WHY[ctx.goalHit] : "Fits your goals" },
    { v: WEIGHTS.slot * f.slot, text: `${f.slot === 1 ? "Fits" : "Partly fits"} your ${DAYS[dayOfWeek(ctx.date)]} ${timeBucket(ctx.startTime) === "late" ? "night" : timeBucket(ctx.startTime)}` },
    { v: WEIGHTS.friends * f.friends, text: ctx.friendNames.length === 1 ? `${ctx.friendNames[0]} is interested` : `${ctx.friendNames.length} friends interested` },
  ];
  // If tag match and cosine both rank, prefer the more specific tag text.
  const top = parts.filter((p) => p.v > 0.005).sort((a, b) => b.v - a.v);
  const picked: string[] = [];
  for (const p of top) {
    if (picked.length === 2) break;
    if (picked.includes(p.text)) continue;
    if (p.text.startsWith("Close to") && top.some((q) => q.text.startsWith("Matches your") && q.v > 0.02) && !picked.length) {
      continue; // the tag line is more informative than the generic cosine line
    }
    picked.push(p.text);
  }
  if (!picked.length) return f.fresh ? "Just posted — be one of the first" : "Something new to try";
  return picked.map((t, i) => (i === 0 ? t : t.charAt(0).toLowerCase() + t.slice(1))).join(" · ");
}

type FeedInput = {
  student: Student;
  events: (Event & { org: Org; venue: Venue | null })[];
  swipedIds: Set<string>;
  friendRight: Map<string, FriendLite[]>; // eventId -> friends who swiped right
  activeRegs: Pick<Event, "id" | "date" | "startTime" | "endTime" | "title">[];
  costSensitive: boolean;
  includePast?: boolean;
  blocks?: Pick<ScheduleBlock, "id" | "kind" | "title" | "day" | "start" | "end">[];
  now?: Date;
};

export function scoreEvents(input: FeedInput): RankedEvent[] {
  const { student } = input;
  const now = input.now ?? new Date();
  const profileVec = parseNumbers(student.profileEmbedding);
  const pText = profileText(student);
  const weights = parseWeights(student.tagWeights);
  const goals = parseStrings(student.goals);
  const slots = parseJSON<FreeSlot[]>(student.freeSlots, []);
  const slotW = parseWeights(student.slotWeights);
  const typeW = parseWeights(student.typeWeights);
  const out: RankedEvent[] = [];
  for (const e of input.events) {
    if (input.swipedIds.has(e.id)) continue;
    if (!input.includePast && isPast(e.endDate ?? e.date, e.endTime, now) && e.status !== "live") continue;
    const tags = parseStrings(e.tags);
    const cos = clamp(similarity(profileVec, parseNumbers(e.embedding), pText, eventText(e)), 0, 1);
    const tm = tagWeightMatch(weights, tags);
    const gm = goalMatch(goals, e, tags);
    const slot = freeSlotFit(slots, e.date, e.startTime, e.endTime);
    const friends = input.friendRight.get(e.id) ?? [];
    const fr = Math.min(friends.length / 3, 1);
    const conflictWith = input.activeRegs.find((r) => r.id !== e.id && conflictBetween(r, e));
    const clashes = blockClashes(input.blocks ?? [], eventSegments(e));
    let penalty = 0;
    if (conflictWith) penalty += 0.15;
    if (clashes.some((c) => c.kind === "class")) penalty += 0.12;
    else if (clashes.length) penalty += 0.06;
    const slotKey = `${dayOfWeek(e.date)}-${timeBucket(e.startTime)}`;
    const slotPref = clamp((slotW[slotKey] ?? 0) * 0.05, -0.1, 0.05);
    const typePref = clamp((typeW[e.eventType] ?? 0) * 0.05, -0.08, 0.06);
    if (input.costSensitive && e.ticketCost > 0) penalty += 0.05;
    const ageH = (now.getTime() - e.createdAt.getTime()) / 3_600_000;
    const isNew = ageH >= 0 && ageH < 24;
    const fresh = isNew ? 0.05 : 0;
    const factors: Factors = { cosine: round(cos, 3), tags: round(tm.value, 3), goals: round(gm.value, 3), slot, friends: round(fr, 3), penalty: round(penalty, 3), fresh, slotPref: round(slotPref, 3), typePref: round(typePref, 3) };
    const score = WEIGHTS.cosine * cos + WEIGHTS.tags * tm.value + WEIGHTS.goals * gm.value + WEIGHTS.slot * slot + WEIGHTS.friends * fr - penalty + fresh + slotPref + typePref;
    const conflicts = [
      ...clashes.map((c) => ({ kind: c.kind, title: c.title, when: c.when })),
      ...(conflictWith ? [{ kind: "event", title: conflictWith.title, when: "" }] : []),
    ];
    out.push({
      ...publicEvent(e),
      score: round(score, 4),
      factors,
      why: buildWhy(factors, { bestTag: tm.best, goalHit: gm.hit, date: e.date, startTime: e.startTime, friendNames: friends.map((f) => f.name.split(" ")[0]) }),
      friendsGoing: friends,
      conflict: conflicts[0] ? { title: conflicts[0].title } : null,
      conflicts,
      isNew,
      matchPct: interestMatch(cos, weights, tags, gm.value, typeW[e.eventType] ?? 0),
      rankPos: 0,
    });
  }
  out.sort((a, b) => b.score - a.score);
  out.forEach((e, i) => (e.rankPos = i));
  return out;
}

export async function rankFeed(studentId: string, opts: { includeSwiped?: boolean; includePast?: boolean } = {}): Promise<RankedEvent[]> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  const [events, swipes, friendships, regs, blocks] = await Promise.all([
    prisma.event.findMany({ where: { status: { in: opts.includePast ? ["published", "live", "closed"] : ["published", "live"] } }, include: { org: true, venue: true } }),
    prisma.swipe.findMany({ where: { studentId }, select: { eventId: true, direction: true, reason: true } }),
    prisma.friendship.findMany({ where: { OR: [{ studentId }, { friendId: studentId }] } }),
    prisma.registration.findMany({ where: { studentId, status: { in: ["pre-registered", "registered", "waitlisted"] } }, include: { event: true } }),
    prisma.scheduleBlock.findMany({ where: { studentId } }),
  ]);
  const friendIds = Array.from(new Set(friendships.map((f) => (f.studentId === studentId ? f.friendId : f.studentId))));
  const [friends, friendSwipes] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: friendIds } }, select: { id: true, name: true, avatarUrl: true } }),
    prisma.swipe.findMany({ where: { studentId: { in: friendIds }, direction: "right" }, select: { studentId: true, eventId: true } }),
  ]);
  const friendById = new Map<string, FriendLite>(friends.map((f: FriendLite) => [f.id, f] as [string, FriendLite]));
  const friendRight = new Map<string, FriendLite[]>();
  for (const s of friendSwipes) {
    const f = friendById.get(s.studentId);
    if (!f) continue;
    if (!friendRight.has(s.eventId)) friendRight.set(s.eventId, []);
    friendRight.get(s.eventId)!.push(f);
  }
  const costReasons = swipes.filter((s) => s.direction === "left" && s.reason === "cost").length;
  return scoreEvents({
    student,
    events,
    swipedIds: opts.includeSwiped ? new Set() : new Set(swipes.map((s) => s.eventId)),
    friendRight,
    activeRegs: regs.map((r) => r.event),
    costSensitive: costReasons >= 1,
    blocks,
    includePast: opts.includePast,
  });
}

/** Score one event for one student (event detail page / search): match %, why line, conflicts. */
export async function scoreOne(studentId: string, eventId: string): Promise<RankedEvent | null> {
  const all = await rankFeed(studentId, { includeSwiped: true, includePast: true });
  return all.find((e) => e.id === eventId) ?? null;
}
