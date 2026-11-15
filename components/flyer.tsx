"use client";
import { QRCodeSVG } from "qrcode.react";
import * as React from "react";
import { fmt12, formatDate } from "@/lib/time";
import { flyerBackground, type CardEvent } from "./event-card";

/** Printable flyer with a QR code that links to /event/[id]. */
export function Flyer({ e, id }: { e: CardEvent & { goodies?: string; accessibilityNotes?: string }; id?: string }) {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);
  const url = id ? `${origin}/event/${id}` : origin;
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl text-white shadow-2xl" style={flyerBackground(e.flyerColor, e.flyerImageUrl)}>
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[18px] border-gold/40" />
      <div className="relative flex h-full flex-col p-6">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{e.org?.name ?? "USC"} presents</div>
        <h2 className="mt-3 text-3xl font-black leading-[1.05]">{e.flyerHeadline || e.title}</h2>
        {e.flyerTagline && <p className="mt-2 text-base font-medium text-white/90">{e.flyerTagline}</p>}
        <p className="mt-4 line-clamp-4 text-sm text-white/85">{e.cardBlurb || e.description}</p>
        <div className="mt-auto flex items-end justify-between gap-4">
          <div className="space-y-1 text-sm">
            <div className="text-lg font-bold">{formatDate(e.date)}</div>
            <div>
              {fmt12(e.startTime)} – {fmt12(e.endTime)}
            </div>
            {e.location && <div className="font-medium">{e.location}</div>}
            <div className="pt-1 text-xs font-semibold text-gold">
              {e.foodType === "free" ? "FREE FOOD · " : ""}
              {e.ticketCost > 0 ? `$${e.ticketCost}` : "FREE ENTRY"}
              {e.goodies ? ` · ${e.goodies}` : ""}
            </div>
          </div>
          <div className="rounded-xl bg-white p-2">
            <QRCodeSVG value={url || "https://usc.edu"} size={84} fgColor="#990000" />
          </div>
        </div>
      </div>
    </div>
  );
}
