// "Ask TrojanEngage": an org-side chatbot over the org's event history.
// Every prompt and answer is stored (ChatMessage). Answers are grounded in event records, funnels,
// left-swipe reasons and ONLY verified feedback (from students who registered AND checked in).
import { z } from "zod";
import { prisma } from "../db";
import { parseJSON, parseNumbers, parseStrings, toJSON } from "../json";
import { embedOne, runAI } from "../ai/client";
import { similarity, tokenize } from "../ai/localEmbed";
import { DAYS_LONG, FEEDBACK_LABELS, REASON_LABELS } from "../taxonomy";
import { dayOfWeek, fmt12, formatDate } from "../time";
import { pct, truncate } from "../utils";
import { getFunnels, type Funnel } from "./funnel";
import { computeOrgSwipeInsights } from "./insights";
import { recordEmbeddingText } from "./records";
import { eventText } from "./serialize";

export type ChatSource = { eventId: string; title: string; recordId: string | null };
export type ChatMessageView = { id: string; role: "user" | "assistant"; content: string; sources: ChatSource[]; usedFallback: boolean; createdAt: string };

const AnswerSchema = z.object({
  answer: z.string().min(1),
  sources: z.array(z.string()).max(6).default([]),
});

type VerifiedFeedback = { rating: number; tag: string; tags: string[]; comment: string | null };
type Ctx = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  eventType: string;
  foodType: string;
  budget: number;
  capacity: number;
  venue: string;
  funnel: Funnel;
  feedback: VerifiedFeedback[];
  avgVerifiedRating: number;
  recordId: string | null;
  keep: string[];
  change: string[];
  score: number;
};

function serialize(m: { id: string; role: string; content: string; sources: string; usedFallback: boolean; createdAt: Date }): ChatMessageView {
  return { id: m.id, role: m.role === "assistant" ? "assistant" : "user", content: m.content, sources: parseJSON<ChatSource[]>(m.sources, []), usedFallback: m.usedFallback, createdAt: m.createdAt.toISOString() };
}

export async function getChatHistory(orgId: string, take = 100) {
  const rows = await prisma.chatMessage.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } });
  return rows.slice(-take).map(serialize);
}

export async function clearChat(orgId: string) {
  await prisma.chatMessage.deleteMany({ where: { orgId } });
}

/** Load the org's past/live events with funnels, records and verified-attendee feedback. */
async function loadContext(orgId: string) {
  const events = await prisma.event.findMany({
    where: { orgId, status: { in: ["closed", "live"] } },
    include: { venue: true, record: true },
    orderBy: { date: "desc" },
  });
  const ids = events.map((e) => e.id);
  const [funnels, feedback, checkIns, regs] = await Promise.all([
    getFunnels(ids),
    prisma.feedback.findMany({ where: { eventId: { in: ids } } }),
    prisma.checkIn.findMany({ where: { eventId: { in: ids } }, select: { studentId: true, eventId: true } }),
    prisma.registration.findMany({ where: { eventId: { in: ids }, status: "registered" }, select: { studentId: true, eventId: true } }),
  ]);
  const checked = new Set(checkIns.map((c) => `${c.studentId}|${c.eventId}`));
  const registered = new Set(regs.map((r) => `${r.studentId}|${r.eventId}`));
  const verified = feedback.filter((f) => checked.has(`${f.studentId}|${f.eventId}`) && registered.has(`${f.studentId}|${f.eventId}`));
  return events.map((e) => {
    // Highest-rated feedback first, so quotes and context lead with the strongest signal.
    const fb = verified
      .filter((f) => f.eventId === e.id)
      .map((f) => ({ rating: f.rating, tag: f.tag, tags: parseStrings(f.tags).length ? parseStrings(f.tags) : [f.tag], comment: f.comment }))
      .sort((a, b) => b.rating - a.rating);
    const kc = parseJSON<{ keep: string[]; change: string[] }>(e.record?.keepChange, { keep: [], change: [] });
    return {
      event: e,
      ctx: {
        id: e.id,
        title: e.title,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        status: e.status,
        eventType: e.eventType,
        foodType: e.foodType,
        budget: e.budget,
        capacity: e.capacity,
        venue: e.venue?.name ?? e.location,
        funnel: funnels[e.id],
        feedback: fb,
        avgVerifiedRating: fb.length ? Math.round((fb.reduce((s, f) => s + f.rating, 0) / fb.length) * 10) / 10 : 0,
        recordId: e.record?.approved ? e.record.id : null,
        keep: kc.keep ?? [],
        change: kc.change ?? [],
        score: 0,
      } as Ctx,
    };
  });
}

/** Rank events: explicit title mentions first, then embedding similarity to the question. */
async function retrieve(question: string, items: Awaited<ReturnType<typeof loadContext>>, k = 3): Promise<Ctx[]> {
  if (!items.length) return [];
  const qTokens = new Set(tokenize(question));
  // Tokens that appear in exactly one event title are "distinctive" (e.g. diwali, pytorch, llms).
  const GENERIC = new Set(["workshop", "night", "event", "events", "panel", "lab", "mixer", "review", "talk", "intro", "2025", "2026", "hands-on", "hand", "lawn", "day"]);
  const df = new Map<string, number>();
  for (const { ctx } of items) for (const t of new Set(tokenize(ctx.title))) df.set(t, (df.get(t) ?? 0) + 1);
  const qVec = await embedOne(question, "chatEmbedding");
  for (const { event, ctx } of items) {
    const titleToks = tokenize(ctx.title);
    const mention = titleToks.filter((t) => t.length > 2 && !GENERIC.has(t) && qTokens.has(t) && (df.get(t) ?? 0) <= 2).length;
    const text = event.record ? recordEmbeddingText(event.title, event.record.markdown) : eventText(event);
    const vec = event.record?.approved ? parseNumbers(event.record.embedding) : parseNumbers(event.embedding);
    ctx.score = mention * 1.0 + similarity(qVec, vec, question, text);
  }
  const ranked = items.map((i) => i.ctx).sort((a, b) => b.score - a.score);
  const mentioned = ranked.filter((c) => c.score >= 1);
  return (mentioned.length ? mentioned : ranked).slice(0, k);
}

/** Quotes ordered by rating (highest first); each shows its star rating. */
const fbQuote = (fb: VerifiedFeedback[], pred: (f: VerifiedFeedback) => boolean, n = 2, order: "desc" | "asc" = "desc") =>
  [...fb]
    .filter((f) => f.comment && f.comment.trim().length > 3 && pred(f))
    .sort((a, b) => (order === "desc" ? b.rating - a.rating : a.rating - b.rating))
    .slice(0, n)
    .map((f) => `“${truncate(f.comment!.trim(), 120)}” (${f.rating}★)`);

function tagCounts(fb: VerifiedFeedback[]) {
  const m: Record<string, number> = {};
  for (const f of fb) for (const t of f.tags) m[t] = (m[t] ?? 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

/** Deterministic, data-grounded answer used when no LLM is configured (or it fails). */
export function mockAnswer(question: string, topIn: Ctx[], org: { name: string }, insights: { bestSlot: string | null; reasonTotals: Record<string, number> }): { answer: string; sources: string[] } {
  const q = question.toLowerCase();
  // Responses are ordered by rating: best-rated events (verified attendees) first.
  const top = [...topIn].sort((a, b) => b.avgVerifiedRating - a.avgVerifiedRating || b.score - a.score);
  if (!top.length) return { answer: `I don't have any past events for ${org.name} yet. Import past events on **Setup & import**, or close an event to create its first record.`, sources: [] };
  const lines: string[] = [];
  const totalVerified = top.reduce((s, c) => s + c.feedback.length, 0);
  const name = (c: Ctx) => `**${c.title}** (${formatDate(c.date)})`;
  const isTime = /\b(time|times|when|slot|day|days|schedule|late|early|earlier|evening|morning|weekday|weekend)\b/.test(q);
  const isFood = /\b(food|eat|eating|catering|pizza|dinner|snack|snacks|boba|biryani|menu)\b/.test(q);
  const isAttendance = /\b(attend|attendance|turnout|how many|capacity|showed|show up|came|full|crowd|crowded|funnel|registered|checked)\b/.test(q);
  const isWhy = /\b(why|skip|skipped|pass|passed|left|swipe|swiped|didn'?t|not come|lose|lost)\b/.test(q);
  const isImprove = /\b(improve|better|next|change|should|recommend|advice|fix|plan|keep|lesson|lessons)\b/.test(q);
  const isFeedback = /\b(feedback|say|said|think|thought|rating|rated|review|liked|loved|hate|complain|comments?)\b/.test(q);

  if (isTime) {
    for (const c of top) {
      const left = c.funnel.leftSwipes;
      const t = c.funnel.reasons.time ?? 0;
      const timeFb = fbQuote(c.feedback, (f) => f.tags.includes("bad-timing") || /(earl|late|time)/i.test(f.comment ?? ""), 1, "asc");
      lines.push(`- ${name(c)} ran ${DAYS_LONG[dayOfWeek(c.date)]} ${fmt12(c.startTime)}–${fmt12(c.endTime)}: ${t}/${left} left swipes (${pct(t, left)}%) said **Bad time**.${timeFb.length ? ` Attendees: ${timeFb.join(" ")}` : ""}`);
    }
    if (insights.bestSlot) lines.push(`\n**Your best-performing slot is ${insights.bestSlot}**, so schedule similar events there.`);
  } else if (isFood) {
    for (const c of top) {
      const food = c.feedback.filter((f) => f.tags.includes("great-food") || /(food|pizza|boba|biryani|dinner|thandai|snack)/i.test(f.comment ?? ""));
      lines.push(`- ${name(c)} · food: ${c.foodType === "free" ? "free" : c.foodType === "paid" ? "for sale" : "none"} · ${food.length}/${c.feedback.length} verified responses mentioned food${food.length ? ` (avg ${(food.reduce((s, f) => s + f.rating, 0) / food.length).toFixed(1)}★)` : ""}. ${fbQuote(food, () => true, 2).join(" ")}`);
    }
  } else if (isAttendance) {
    for (const c of top) {
      const f = c.funnel;
      lines.push(`- ${name(c)}: ${f.rightSwipes} swiped right → ${f.preRegistered} pre-registered → ${f.registered} registered → **${f.checkedIn} checked in** (${pct(f.checkedIn, c.capacity)}% of ${c.capacity} capacity, ${pct(f.checkedIn, f.registered)}% of registered showed up).`);
    }
  } else if (isWhy) {
    for (const c of top) {
      const r = Object.entries(c.funnel.reasons).sort((a, b) => b[1] - a[1]);
      const left = c.funnel.leftSwipes;
      lines.push(`- ${name(c)}: ${left} students passed — ${r.length ? r.map(([k, n]) => `${REASON_LABELS[k] ?? k} ${pct(n, left)}%`).join(", ") : "no reasons recorded"}.`);
    }
    const tot = Object.entries(insights.reasonTotals).sort((a, b) => b[1] - a[1])[0];
    if (tot) lines.push(`\nAcross all your events, the #1 reason is **${REASON_LABELS[tot[0]] ?? tot[0]}** (${tot[1]} passes).${tot[0] === "time" && insights.bestSlot ? ` Try ${insights.bestSlot}.` : ""}`);
  } else if (isImprove) {
    for (const c of top) {
      const ch = c.change.slice(0, 2);
      const kp = c.keep.slice(0, 1);
      lines.push(`- ${name(c)} — **Change:** ${ch.length ? ch.join("; ") : "nothing major"}. **Keep:** ${kp.length ? kp.join("; ") : "the format"}.`);
    }
    if (insights.bestSlot) lines.push(`\nScheduling tip: your best slot historically is **${insights.bestSlot}**.`);
  } else {
    // Feedback summary (also the default).
    for (const c of top) {
      const tags = tagCounts(c.feedback).slice(0, 3).map(([t, n]) => `${FEEDBACK_LABELS[t] ?? t} ×${n}`);
      const quotes = fbQuote(c.feedback, () => true, isFeedback ? 2 : 1);
      lines.push(`- ${name(c)} · **${c.avgVerifiedRating ? c.avgVerifiedRating.toFixed(1) + "★" : "no ratings"}** from ${c.feedback.length} verified attendees · ${c.funnel.checkedIn} checked in${tags.length ? ` · top tags: ${tags.join(", ")}` : ""}. ${quotes.join(" ")}`);
    }
  }
  const header =
    top.length === 1 ? `Here's what I found for **${top[0].title}**:` : `Here's what I found across ${top.length} of ${org.name}'s past events most related to your question:`;
  const footer = `\n\n_Based on event records, swipe data and ${totalVerified} feedback responses from students who registered and checked in._`;
  return { answer: `${header}\n\n${lines.join("\n")}${footer}`, sources: top.map((c) => c.id) };
}

export async function askOrgAssistant(orgId: string, message: string) {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });
  const prior = await prisma.chatMessage.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 6 });
  const userMsg = await prisma.chatMessage.create({ data: { orgId, role: "user", content: message } });

  const [items, ins] = await Promise.all([loadContext(orgId), computeOrgSwipeInsights(orgId)]);
  // Short follow-ups ("and the food?") inherit the previous question for retrieval.
  const lastUser = prior.find((m) => m.role === "user");
  const retrievalQuery = message.split(/\s+/).length <= 5 && lastUser ? `${lastUser.content} ${message}` : message;
  const top = await retrieve(retrievalQuery, items, 3);
  const insights = { bestSlot: ins.swipeInsights.bestSlot?.label ?? null, reasonTotals: ins.reasonTotals };
  const ids = new Set(top.map((c) => c.id));

  const context = [...top]
    .sort((a, b) => b.avgVerifiedRating - a.avgVerifiedRating)
    .map((c) => {
      const f = c.funnel;
      return [
        `[${c.id}] ${c.title} — ${c.date} (${DAYS_LONG[dayOfWeek(c.date)]}) ${c.startTime}-${c.endTime}, ${c.eventType}, ${c.venue}, budget $${c.budget}, capacity ${c.capacity}, food ${c.foodType}, status ${c.status}`,
        `  funnel: right ${f.rightSwipes} / left ${f.leftSwipes} → pre-registered ${f.preRegistered} → registered ${f.registered} → checked in ${f.checkedIn}`,
        `  left-swipe reasons: ${JSON.stringify(f.reasons)}`,
        `  record keep: ${c.keep.join("; ") || "—"} | change: ${c.change.join("; ") || "—"}`,
        `  verified attendee feedback (${c.feedback.length}, avg ${c.avgVerifiedRating}): ${c.feedback
          .slice(0, 25)
          .map((x) => `${x.rating}★ ${x.tags.join("+")}${x.comment ? `: "${x.comment}"` : ""}`)
          .join(" | ")}`,
      ].join("\n");
    })
    .join("\n\n");

  const res = await runAI({
    feature: "orgChat",
    system: `You are "Ask TrojanEngage", an assistant for the USC student org ${org.name}. Answer questions about the org's past events using ONLY the context provided: event records, funnel numbers, left-swipe reasons and feedback from verified attendees (students who registered and checked in). ORDER your response by rating: list events from highest to lowest average verified rating, and within an event quote the highest-rated feedback first (show the ★ rating next to each quote). Quote real numbers. If the context doesn't contain the answer, say so. Use concise Markdown (bullets, **bold** event names). Return the event ids you used in "sources", in the same rating order.`,
    user: `Org best time slot: ${insights.bestSlot ?? "unknown"}. Org-wide left-swipe reasons: ${JSON.stringify(insights.reasonTotals)}.

CONTEXT (most relevant events):
${context || "(no past events)"}

RECENT CONVERSATION:
${prior
  .slice()
  .reverse()
  .map((m) => `${m.role}: ${truncate(m.content, 300)}`)
  .join("\n") || "(none)"}

QUESTION: ${message}

Return {"answer":"markdown","sources":["eventId", ...]}.`,
    schema: AnswerSchema,
    fallback: () => mockAnswer(message, top, org, insights),
    inputSummary: `${org.name}: "${truncate(message, 120)}" · ${top.length} events retrieved (${top.map((c) => c.title).join(", ")})`,
    summarize: (d) => truncate(d.answer.replace(/\s+/g, " "), 200),
  });
  const used = res.data.sources.filter((s) => ids.has(s));
  const byRating = [...top].sort((a, b) => b.avgVerifiedRating - a.avgVerifiedRating).map((c) => c.id);
  const sources: ChatSource[] = (used.length ? used : byRating).map((id) => {
    const c = top.find((x) => x.id === id)!;
    return { eventId: c.id, title: c.title, recordId: c.recordId };
  });
  const assistant = await prisma.chatMessage.create({
    data: { orgId, role: "assistant", content: res.data.answer, sources: toJSON(sources), usedFallback: res.usedFallback },
  });
  return { user: serialize(userMsg), assistant: serialize(assistant) };
}
