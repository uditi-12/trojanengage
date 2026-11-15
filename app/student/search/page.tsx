"use client";
import { Search, SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { EventRow } from "@/components/event-row";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { AUDIENCES, EVENT_TYPES } from "@/lib/taxonomy";
import { addDays, todayISO } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { EventView } from "@/lib/types";

type Hit = EventView & { score: number; keywordScore: number; semanticScore: number };
const DATE_RANGES: Record<string, () => { from?: string; to?: string }> = {
  any: () => ({}),
  week: () => ({ from: todayISO(), to: addDays(todayISO(), 7) }),
  weekend: () => {
    const t = todayISO();
    const d = new Date(t + "T12:00:00").getDay();
    const sat = addDays(t, (6 - d + 7) % 7);
    return { from: sat, to: addDays(sat, 1) };
  },
  month: () => ({ from: todayISO(), to: addDays(todayISO(), 31) }),
};

export default function SearchPage() {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("any");
  const [audience, setAudience] = React.useState("any");
  const [food, setFood] = React.useState("any");
  const [free, setFree] = React.useState(false);
  const [range, setRange] = React.useState("any");
  const [showFilters, setShowFilters] = React.useState(false);
  const [results, setResults] = React.useState<Hit[] | null>(null);

  React.useEffect(() => {
    const ctrl = { cancelled: false };
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ q, type, audience, food, free: free ? "1" : "0", ...DATE_RANGES[range]() });
      try {
        const d = await api<{ results: Hit[] }>(`/api/search?${p.toString()}`);
        if (!ctrl.cancelled) setResults(d.results);
      } catch {
        if (!ctrl.cancelled) setResults([]);
      }
    }, 250);
    return () => {
      ctrl.cancelled = true;
      clearTimeout(t);
    };
  }, [q, type, audience, food, free, range]);

  const activeFilters = [type, audience, food, range].filter((v) => v !== "any").length + (free ? 1 : 0);
  return (
    <div className="px-4 pt-4">
      <h1 className="mb-3 text-2xl font-extrabold tracking-tight">Search</h1>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “machine learning with food”" className="h-11 pl-9" />
        </div>
        <button onClick={() => setShowFilters((s) => !s)} className={cn("relative flex h-11 w-11 items-center justify-center rounded-xl border bg-card", showFilters && "border-cardinal text-cardinal")} aria-label="Filters">
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cardinal text-[10px] font-bold text-white">{activeFilters}</span>}
        </button>
      </div>
      {showFilters && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border bg-card p-3">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="any">Any type</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </Select>
          <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="any">Any audience</option>
            {AUDIENCES.filter((a) => a !== "all").map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="any">Any date</option>
            <option value="week">Next 7 days</option>
            <option value="weekend">This weekend</option>
            <option value="month">Next 30 days</option>
          </Select>
          <Select value={food} onChange={(e) => setFood(e.target.value)}>
            <option value="any">Any food</option>
            <option value="free">Free food</option>
            <option value="paid">Food for sale</option>
            <option value="none">No food</option>
          </Select>
          <label className="col-span-2 flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="h-4 w-4 accent-cardinal" /> Free entry only
          </label>
        </div>
      )}
      <div className="mt-4 space-y-2">
        {!results && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        {results?.length === 0 && <EmptyState icon={<Search className="h-6 w-6" />} title="No matches" body="Try a broader search or clear some filters." />}
        {results?.map((e) => (
          <EventRow
            key={e.id}
            e={e}
            right={
              q ? (
                <div className="flex shrink-0 flex-col items-end justify-center text-[10px] text-muted-foreground">
                  <span className="rounded-full bg-cardinal-50 px-1.5 py-0.5 font-bold text-cardinal">{Math.round(e.score * 100)}%</span>
                  <span className="mt-1">kw {Math.round(e.keywordScore * 100)}</span>
                  <span>sem {Math.round(e.semanticScore * 100)}</span>
                </div>
              ) : null
            }
          />
        ))}
      </div>
    </div>
  );
}
