"use client";
import * as React from "react";
import { DAYS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

export const GRID_HOURS = Array.from({ length: 14 }, (_, i) => i + 9); // 9am–10pm
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

function hourLabel(h: number) {
  const ap = h >= 12 ? "p" : "a";
  return `${h % 12 || 12}${ap}`;
}

/** Tap (or drag) cells to mark free hours. Values are "day-hour" strings. */
export function FreeTimeGrid({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const set = React.useMemo(() => new Set(value), [value]);
  const painting = React.useRef<null | boolean>(null);
  const toggle = (key: string, mode?: boolean) => {
    const next = new Set(set);
    const on = mode ?? !next.has(key);
    if (on) next.add(key);
    else next.delete(key);
    onChange(Array.from(next));
  };
  React.useEffect(() => {
    const up = () => (painting.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  return (
    <div className="select-none overflow-x-auto">
      <div className="grid min-w-[320px] gap-1" style={{ gridTemplateColumns: "34px repeat(7, 1fr)" }}>
        <div />
        {ORDER.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground">
            {DAYS[d]}
          </div>
        ))}
        {GRID_HOURS.map((h) => (
          <React.Fragment key={h}>
            <div className="pr-1 text-right text-[10px] leading-6 text-muted-foreground">{hourLabel(h)}</div>
            {ORDER.map((d) => {
              const key = `${d}-${h}`;
              const on = set.has(key);
              return (
                <button
                  type="button"
                  key={key}
                  aria-label={`${DAYS[d]} ${hourLabel(h)}`}
                  aria-pressed={on}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    painting.current = !on;
                    toggle(key, !on);
                  }}
                  onPointerEnter={() => {
                    if (painting.current !== null && on !== painting.current) toggle(key, painting.current);
                  }}
                  className={cn("h-6 rounded-md border transition-colors", on ? "border-cardinal bg-cardinal" : "border-border bg-muted/60 hover:bg-cardinal/20")}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
