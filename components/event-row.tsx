"use client";
import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { CostBadge, FoodBadge, flyerBackground } from "@/components/event-card";
import { formatWhen } from "@/lib/time";
import type { EventView } from "@/lib/types";

export function EventRow({ e, right, href }: { e: EventView; right?: React.ReactNode; href?: string }) {
  return (
    <Link href={href ?? `/event/${e.id}`} className="flex gap-3 rounded-2xl border bg-card p-3 shadow-soft transition hover:border-cardinal/30">
      <div className="h-16 w-16 shrink-0 rounded-xl" style={flyerBackground(e.flyerColor, e.flyerImageUrl)} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold leading-tight">{e.flyerHeadline || e.title}</div>
        <div className="truncate text-xs text-muted-foreground">{e.org?.name}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" /> {formatWhen(e.date, e.startTime, e.endTime)}
        </div>
        {e.location && (
          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {e.location}
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <FoodBadge foodType={e.foodType} />
          <CostBadge cost={e.ticketCost} />
          {e.status === "live" && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">LIVE</span>}
        </div>
      </div>
      {right}
    </Link>
  );
}
