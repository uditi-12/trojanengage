// Online, deterministic preference learning (spec §4F) + profile sentence caching (§4G).
import { prisma } from "../db";
import { parseJSON, parseNumbers, parseStrings, parseWeights, toJSON } from "../json";
import { embedOne } from "../ai/client";
import { normalize, localEmbed } from "../ai/localEmbed";
import { explainProfile, type ProfileContext } from "../ai/features";
import { TAG_LABELS } from "../taxonomy";
import { dayOfWeek, timeBucket } from "../time";
import { round } from "../utils";
import { findConflict } from "./conflicts";
import { eventText } from "./serialize";

export const GOAL_TAGS: Record<string, string[]> = {
  network: ["networking", "career"],
  "learn-skills": ["hands-on", "coding"],
  "make-friends": ["social"],
  "free-food": [], // handled by goalMatch (foodType === "free"), not by topic weights
  career: ["career"],
  culture: ["culture", "festival"],
};

export const PROFILE_REFRESH_EVERY = 5;

export function initialTagWeights(interests: string[], goals: string[]): Record<string, number> {
  const w: Record<string, number> = {};
  for (const t of interests) w[t] = round((w[t] ?? 0) + 1);
  for (const g of goals) for (const t of GOAL_TAGS[g] ?? []) w[t] = round((w[t] ?? 0) + 0.5);
  return w;
}

export function applySwipeWeights(weights: Record<string, number>, tags: string[], direction: "right" | "left", reason?: string | null) {
  const w = { ...weights };
  if (direction === "right") for (const t of tags) w[t] = round((w[t] ?? 0) + 0.3);
  else if (reason === "topic" || reason === "not-for-me") for (const t of tags) w[t] = round((w[t] ?? 0) - 0.2);
  // time / cost / vague: no topic penalty — those are tracked as slot/cost dislikes from the swipe log.
  return w;
}

/** Time-slot + event-type preferences, learned alongside topic weights. */
export function slotKey(date: string, startTime: string) {
  return `${dayOfWeek(date)}-${timeBucket(startTime)}`;
}
export function applySwipeContext(
  slot: Record<string, number>,
  type: Record<string, number>,
  e: { date: string; startTime: string; eventType: string },
  direction: "right" | "left",
  reason?: string | null,
) {
  const s = { ...slot };
  const t = { ...type };
  const k = slotKey(e.date, e.startTime);
  if (direction === "right") {
    s[k] = round((s[k] ?? 0) + 0.2);
    t[e.eventType] = round((t[e.eventType] ?? 0) + 0.2);
  } else if (reason === "time") s[k] = round((s[k] ?? 0) - 0.3);
  else if (reason === "topic" || reason === "not-for-me") t[e.eventType] = round((t[e.eventType] ?? 0) - 0.2);
  return { slot: s, type: t };
}

export function applyFeedbackWeights(weights: Record<string, number>, tags: string[], rating: number) {
  const w = { ...weights };
  const delta = rating >= 4 ? 0.2 : rating <= 2 ? -0.1 : 0;
  if (delta) for (const t of tags) w[t] = round((w[t] ?? 0) + delta);
  return w;
}

export function blendProfile(old: number[], ev: number[], oldText: string, evText: string): number[] {
  let a = old;
  let b = ev;
  if (!a.length) return normalize(b.length ? b : localEmbed(evText));
  if (!b.length || a.length !== b.length) {
    a = localEmbed(oldText);
    b = localEmbed(evText);
  }
  return normalize(a.map((x, i) => 0.7 * x + 0.3 * b[i]));
}

export function topTags(weights: Record<string, number>, n = 5) {
  return Object.entries(weights)
    .filter(([t, w]) => w > 0 && TAG_LABELS[t])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export function profileText(s: { interests: string; goals: string; tagWeights: string }): string {
  const interests = parseStrings(s.interests);
  const goals = parseStrings(s.goals);
  const top = topTags(parseWeights(s.tagWeights), 6).map(([t]) => t);
  return `Interests: ${interests.join(" ")}. Goals: ${goals.join(" ")}. Likes: ${top.join(" ")}.`;
}

export async function computeProfileEmbedding(s: { interests: string; goals: string; tagWeights: string }) {
  return embedOne(profileText(s), "profileEmbedding");
}

export async function recordSwipe(input: {
  studentId: string;
  eventId: string;
  direction: "right" | "left";
  reason?: string | null;
  matchPct?: number | null;
  rankPos?: number | null;
  dwellMs?: number | null;
  source?: string | null;
}) {
  const { studentId, eventId, direction } = input;
  const signals = { matchPct: input.matchPct ?? null, rankPos: input.rankPos ?? null, dwellMs: input.dwellMs ?? null, source: input.source ?? "feed" };
  const reason = direction === "left" ? input.reason ?? null : null;
  const [student, event] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id: studentId } }),
    prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
  ]);
  const swipe = await prisma.swipe.upsert({
    where: { studentId_eventId: { studentId, eventId } },
    create: { studentId, eventId, direction, reason, ...signals },
    update: { direction, reason, ...signals, createdAt: new Date() },
  });
  const tags = parseStrings(event.tags);
  const weights = applySwipeWeights(parseWeights(student.tagWeights), tags, direction, reason);
  const ctx = applySwipeContext(parseWeights(student.slotWeights), parseWeights(student.typeWeights), event, direction, reason);
  const data: { tagWeights: string; slotWeights: string; typeWeights: string; profileEmbedding?: string } = {
    tagWeights: toJSON(weights),
    slotWeights: toJSON(ctx.slot),
    typeWeights: toJSON(ctx.type),
  };
  if (direction === "right") {
    const blended = blendProfile(parseNumbers(student.profileEmbedding), parseNumbers(event.embedding), profileText(student), eventText(event));
    data.profileEmbedding = toJSON(blended.map((x) => round(x, 5)));
  }
  await prisma.student.update({ where: { id: studentId }, data });

  let registration = null;
  let conflict: Awaited<ReturnType<typeof findConflict>> = null;
  if (direction === "right") {
    conflict = await findConflict(studentId, event);
    registration = await prisma.registration.upsert({
      where: { studentId_eventId: { studentId, eventId } },
      create: { studentId, eventId, status: "pre-registered", hasConflict: !!conflict, conflictNote: conflict?.note ?? null },
      update: { status: "pre-registered", hasConflict: !!conflict, conflictNote: conflict?.note ?? null },
    });
  } else {
    // Swiping left on something you'd pre-registered for cancels it.
    await prisma.registration.updateMany({ where: { studentId, eventId, status: "pre-registered" }, data: { status: "cancelled" } });
  }

  const swipeCount = await prisma.swipe.count({ where: { studentId } });
  let smarter: { sentence: string } | null = null;
  if (swipeCount > 0 && swipeCount % PROFILE_REFRESH_EVERY === 0) {
    const p = await getProfile(studentId, { forceRefresh: true });
    smarter = { sentence: p.sentence };
  }
  return { swipe, registration, conflict, swipeCount, smarter };
}

export async function getProfile(studentId: string, opts: { forceRefresh?: boolean } = {}) {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  const swipeCount = await prisma.swipe.count({ where: { studentId } });
  const weights = parseWeights(student.tagWeights);
  let sentence = student.profileSentence;
  const stale = !sentence || swipeCount - student.profileSwipeMark >= PROFILE_REFRESH_EVERY;
  let refreshed = false;
  if (opts.forceRefresh || stale) {
    const swipes = await prisma.swipe.findMany({ where: { studentId }, include: { event: true }, orderBy: { createdAt: "desc" }, take: 30 });
    const reasons: Record<string, number> = {};
    for (const s of swipes) if (s.direction === "left" && s.reason) reasons[s.reason] = (reasons[s.reason] ?? 0) + 1;
    const ctx: ProfileContext = {
      tagWeights: weights,
      goals: parseStrings(student.goals),
      rightSwipes: swipes.filter((s) => s.direction === "right").map((s) => ({ title: s.event.title, date: s.event.date, startTime: s.event.startTime, foodType: s.event.foodType, eventType: s.event.eventType, capacity: s.event.capacity })),
      reasons,
    };
    const res = await explainProfile(ctx);
    sentence = res.data.sentence;
    refreshed = true;
    await prisma.student.update({ where: { id: studentId }, data: { profileSentence: sentence, profileSwipeMark: swipeCount } });
  }
  return {
    student: {
      id: student.id,
      name: student.name,
      avatarUrl: student.avatarUrl,
      major: student.major,
      year: student.year,
      interests: parseStrings(student.interests),
      goals: parseStrings(student.goals),
      freeSlots: parseJSON(student.freeSlots, [] as { day: number; start: string; end: string }[]),
      onboarded: student.onboarded,
    },
    tagWeights: weights,
    topTags: topTags(weights, 8).map(([tag, weight]) => ({ tag, label: TAG_LABELS[tag] ?? tag, weight })),
    sentence: sentence ?? "",
    swipeCount,
    refreshed,
    nextRefreshIn: PROFILE_REFRESH_EVERY - (swipeCount % PROFILE_REFRESH_EVERY),
  };
}
