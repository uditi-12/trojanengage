// Org-level swipe analytics (left-swipe reasons, best time slots) + AI rewrite tips (§4I).
import { prisma } from "../db";
import { orgInsights, type OrgSwipeInsights } from "../ai/features";
import { DAYS_LONG } from "../taxonomy";
import { dayOfWeek, fmt12, toMinutes } from "../time";
import { pct } from "../utils";
import { getFunnels } from "./funnel";

type SlotStat = { key: string; day: number; startTime: string; label: string; rightRate: number; events: number; avgCheckedIn: number; swipes: number };

export async function computeOrgSwipeInsights(orgId: string) {
  const events = await prisma.event.findMany({ where: { orgId, status: { not: "draft" } }, orderBy: { date: "asc" } });
  const funnels = await getFunnels(events.map((e) => e.id));
  const reasonTotals: Record<string, number> = {};
  const perEvent = events.map((e) => {
    const f = funnels[e.id];
    for (const [r, n] of Object.entries(f.reasons)) reasonTotals[r] = (reasonTotals[r] ?? 0) + n;
    const total = f.rightSwipes + f.leftSwipes;
    return {
      id: e.id,
      title: e.title,
      date: e.date,
      startTime: e.startTime,
      status: e.status,
      foodType: e.foodType,
      rightRate: pct(f.rightSwipes, total),
      rightSwipes: f.rightSwipes,
      leftSwipes: f.leftSwipes,
      reasons: f.reasons,
      checkedIn: f.checkedIn,
      avgRating: f.avgRating,
      totalSwipes: total,
    };
  });
  const slots = new Map<string, { day: number; startTime: string; right: number; total: number; events: number; checked: number }>();
  for (const e of perEvent) {
    if (e.status !== "closed" || e.totalSwipes < 5) continue; // best slots come from finished events
    const day = dayOfWeek(e.date);
    const hour = Math.floor(toMinutes(e.startTime) / 60);
    const key = `${day}-${hour}`;
    const s = slots.get(key) ?? { day, startTime: `${String(hour).padStart(2, "0")}:00`, right: 0, total: 0, events: 0, checked: 0 };
    s.right += e.rightSwipes;
    s.total += e.totalSwipes;
    s.events += 1;
    s.checked += e.checkedIn;
    slots.set(key, s);
  }
  const slotStats: SlotStat[] = Array.from(slots.entries())
    .map(([key, s]) => ({
      key,
      day: s.day,
      startTime: s.startTime,
      label: `${DAYS_LONG[s.day]} ${fmt12(s.startTime)}`,
      rightRate: pct(s.right, s.total),
      events: s.events,
      avgCheckedIn: Math.round(s.checked / s.events),
      swipes: s.total,
    }))
    .sort((a, b) => b.rightRate - a.rightRate || b.avgCheckedIn - a.avgCheckedIn);
  const best = slotStats[0] ?? null;
  const swipeInsights: OrgSwipeInsights = {
    bestSlot: best ? { day: best.day, startTime: best.startTime, label: best.label, rightRate: best.rightRate } : null,
    reasonTotals,
  };
  const rated = perEvent.filter((e) => e.avgRating > 0);
  const avgRating = rated.length ? Math.round((rated.reduce((s, e) => s + e.avgRating, 0) / rated.length) * 10) / 10 : 0;
  return { perEvent, reasonTotals, slotStats, swipeInsights, avgRating };
}

const tipCache = new Map<string, { at: number; key: string; tips: { eventTitle?: string | null; tip: string }[]; usedFallback: boolean }>();

export async function getOrgInsights(orgId: string, opts: { refresh?: boolean } = {}) {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });
  const data = await computeOrgSwipeInsights(orgId);
  const key = JSON.stringify(data.reasonTotals) + data.perEvent.length;
  const cached = tipCache.get(orgId);
  let tips = cached?.tips;
  let usedFallback = cached?.usedFallback ?? true;
  if (!cached || cached.key !== key || Date.now() - cached.at > 10 * 60_000 || opts.refresh) {
    const res = await orgInsights({
      orgName: org.name,
      perEvent: data.perEvent.filter((e) => e.totalSwipes > 0),
      reasonTotals: data.reasonTotals,
      bestSlotLabel: data.swipeInsights.bestSlot?.label ?? null,
    });
    tips = res.data.tips;
    usedFallback = res.usedFallback;
    tipCache.set(orgId, { at: Date.now(), key, tips, usedFallback });
  }
  return {
    org: { id: org.id, name: org.name },
    reasonTotals: data.reasonTotals,
    bestSlots: data.slotStats.slice(0, 5),
    avgRating: data.avgRating,
    lowPerformers: [...data.perEvent].filter((e) => e.totalSwipes >= 5).sort((a, b) => a.rightRate - b.rightRate).slice(0, 3),
    tips: tips ?? [],
    usedFallback,
  };
}
