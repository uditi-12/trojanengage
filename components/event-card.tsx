"use client";
import { CalendarDays, DollarSign, Info, MapPin, Pizza, Sparkles, TriangleAlert, Video } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/avatar";
import { TAG_LABELS } from "@/lib/taxonomy";
import { fmt12, formatDate, formatWhen } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ConflictItem, Friend } from "@/lib/types";

export type CardEvent = {
  title: string;
  flyerHeadline?: string;
  flyerTagline?: string;
  cardBlurb?: string;
  description?: string;
  flyerColor?: string;
  flyerImageUrl?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  foodType: string;
  ticketCost: number;
  tags: string[];
  eventType: string;
  org?: { name: string } | null;
  endDate?: string | null;
  campus?: string;
  format?: string;
  restrictions?: string[];
};

export function MatchBadge({ pct, className }: { pct: number; className?: string }) {
  const tone = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-gold text-neutral-900" : "bg-white/25";
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white shadow-sm", tone, className)}>{pct}% match</span>;
}

export function whenLabel(e: { date: string; endDate?: string | null; startTime: string; endTime: string }) {
  if (e.endDate && e.endDate !== e.date) return `${formatDate(e.date)} ${fmt12(e.startTime)} → ${formatDate(e.endDate)} ${fmt12(e.endTime)}`;
  return formatWhen(e.date, e.startTime, e.endTime);
}

export function shade(hex: string, amt: number) {
  const n = parseInt((hex || "#990000").replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function flyerBackground(color?: string, img?: string | null) {
  const c = color || "#990000";
  if (img) return { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.55) 100%), url(${img})`, backgroundSize: "cover", backgroundPosition: "center" };
  return {
    backgroundImage: `radial-gradient(circle at 85% 15%, ${shade(c, 70)}aa 0, transparent 40%), radial-gradient(circle at 10% 90%, #FFCC0055 0, transparent 35%), linear-gradient(135deg, ${shade(c, 20)} 0%, ${c} 55%, ${shade(c, -40)} 100%)`,
  };
}

export function FoodBadge({ foodType, className }: { foodType: string; className?: string }) {
  if (foodType === "none") return null;
  return (
    <Badge variant={foodType === "free" ? "gold" : "secondary"} className={className}>
      <Pizza /> {foodType === "free" ? "Free food" : "Food for sale"}
    </Badge>
  );
}

export function CostBadge({ cost, className }: { cost: number; className?: string }) {
  return (
    <Badge variant={cost > 0 ? "outline" : "success"} className={cn(cost > 0 && "bg-white", className)}>
      <DollarSign /> {cost > 0 ? `$${cost}` : "Free"}
    </Badge>
  );
}

/** The student-facing swipe card. Used in the feed and as a live preview in the org event builder. */
export function EventCardFace({
  e,
  why,
  friends,
  conflict,
  conflicts,
  isNew,
  matchPct,
  detailsHref,
  className,
}: {
  e: CardEvent;
  why?: string;
  friends?: Friend[];
  conflict?: { title: string } | null;
  conflicts?: ConflictItem[];
  isNew?: boolean;
  matchPct?: number;
  detailsHref?: string;
  className?: string;
}) {
  const clash = conflicts?.[0] ?? (conflict ? { kind: "event", title: conflict.title, when: "" } : null);
  const headline = e.flyerHeadline || e.title;
  const blurb = e.cardBlurb || e.description || "";
  return (
    <div className={cn("flex h-full w-full select-none flex-col overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-black/5", className)}>
      <div className="relative flex h-[46%] min-h-[180px] flex-col justify-between p-5 text-white" style={flyerBackground(e.flyerColor, e.flyerImageUrl)}>
        <div className="flex items-start justify-between gap-2">
          <Badge variant="glass" className="capitalize">
            {e.eventType}
          </Badge>
          <div className="flex gap-1.5">
            {typeof matchPct === "number" && <MatchBadge pct={matchPct} />}
            {isNew && (
              <Badge variant="gold">
                <Sparkles /> New
              </Badge>
            )}
          </div>
        </div>
        <div>
          {e.org?.name && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/80">{e.org.name}</div>}
          <h2 className="text-2xl font-extrabold leading-tight drop-shadow-sm">{headline}</h2>
          {e.flyerTagline && <p className="mt-1 text-sm font-medium text-white/90">{e.flyerTagline}</p>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        {why && (
          <div className="flex items-start gap-2 rounded-xl bg-cardinal-50 px-3 py-2 text-xs font-medium text-cardinal">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Why you&apos;re seeing this:</span> {why}
            </span>
          </div>
        )}
        <p className="line-clamp-3 text-sm leading-relaxed text-foreground/90">{blurb}</p>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-cardinal" /> {whenLabel(e)}
          </div>
          {e.format && e.format !== "in-person" && (
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-cardinal" /> {e.format === "virtual" ? "Online" : "In person + online"}
            </div>
          )}
          {e.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-cardinal" />{" "}
              <span className="truncate">
                {e.location}
                {e.campus && e.campus !== "UPC" ? ` · ${e.campus === "HSC" ? "Health Sciences Campus" : e.campus}` : ""}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FoodBadge foodType={e.foodType} />
          <CostBadge cost={e.ticketCost} />
          {e.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary">
              {TAG_LABELS[t] ?? t}
            </Badge>
          ))}
        </div>
        <div className="mt-auto space-y-2">
          {clash && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {clash.kind === "class" ? "Clashes with class " : clash.kind === "event" ? "Overlaps with " : "Clashes with "}
                {clash.title}
                {conflicts && conflicts.length > 1 ? ` +${conflicts.length - 1}` : ""}
              </span>
            </div>
          )}
          {detailsHref && (
            <Link
              href={detailsHref}
              onPointerDownCapture={(ev) => ev.stopPropagation()}
              className="flex items-center justify-center gap-1.5 rounded-xl border bg-card py-2 text-xs font-semibold text-cardinal hover:bg-cardinal-50"
            >
              <Info className="h-3.5 w-3.5" /> Full details & summary
            </Link>
          )}
          {friends && friends.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <AvatarStack people={friends} />
              <span>
                {friends[0].name.split(" ")[0]}
                {friends.length > 1 ? ` + ${friends.length - 1} friend${friends.length > 2 ? "s" : ""}` : ""} interested
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
