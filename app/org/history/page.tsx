"use client";
import { CalendarDays, Clock, FileText, Lightbulb, Plus, Radio, RefreshCw, Star, TrendingDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { FunnelMini } from "@/components/funnel-chart";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { REASON_LABELS } from "@/lib/taxonomy";
import { formatWhen, isLiveNow } from "@/lib/time";
import { cn, pct } from "@/lib/utils";
import type { EventView, FunnelView } from "@/lib/types";

type HistEvent = EventView & { funnel: FunnelView; record: { id: string; approved: boolean } | null };
type Insights = {
  reasonTotals: Record<string, number>;
  bestSlots: { key: string; label: string; rightRate: number; events: number; avgCheckedIn: number; swipes: number }[];
  avgRating: number;
  lowPerformers: { id: string; title: string; rightRate: number; leftSwipes: number }[];
  tips: { eventTitle?: string | null; tip: string }[];
  usedFallback: boolean;
};

const STATUS: Record<string, { label: string; variant: "default" | "gold" | "secondary" | "success" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  published: { label: "Published", variant: "gold" },
  live: { label: "Live", variant: "default" },
  closed: { label: "Closed", variant: "secondary" },
};

function History({ orgId }: { orgId: string }) {
  const [events, setEvents] = React.useState<HistEvent[] | null>(null);
  const [ins, setIns] = React.useState<Insights | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const load = React.useCallback(async () => {
    const [h, i] = await Promise.all([api<{ events: HistEvent[] }>(`/api/orgs/${orgId}/history`), api<Insights>(`/api/orgs/${orgId}/insights`)]);
    setEvents(h.events);
    setIns(i);
  }, [orgId]);
  React.useEffect(() => {
    setEvents(null);
    setIns(null);
    load().catch((e) => toast.error(e.message));
  }, [load]);

  const goLive = async (id: string) => {
    await api(`/api/events/${id}`, { method: "PATCH", body: { status: "live" } });
    toast.success("Event is live — check-in is open");
    load();
  };

  const reasonData = Object.entries(ins?.reasonTotals ?? {})
    .map(([k, v]) => ({ reason: REASON_LABELS[k] ?? k, key: k, value: v }))
    .sort((a, b) => b.value - a.value);
  const totalReasons = reasonData.reduce((s, r) => s + r.value, 0);
  const liveList = events?.filter((e) => e.status === "live") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">History & insights</h1>
          <p className="text-sm text-muted-foreground">Every event, its funnel, and what students told you.</p>
        </div>
        <div className="flex gap-2">
          {liveList.map((live) => (
            <Link key={live.id} href={`/org/events/${live.id}/live`}>
              <Button variant="gold">
                <Radio /> Live: {live.flyerHeadline || live.title}
              </Button>
            </Link>
          ))}
          <Link href="/org/new">
            <Button>
              <Plus /> New event
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!events && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
            {events?.length === 0 && <EmptyState title="No events yet" body="Create your first event or import past ones." action={<Link href="/org/setup"><Button>Import past events</Button></Link>} />}
            {events?.map((e) => {
              const st = e.status === "live" && !isLiveNow(e) ? { label: "Check-in open", variant: "gold" as const } : STATUS[e.status] ?? STATUS.draft;
              const swipes = e.funnel.rightSwipes + e.funnel.leftSwipes;
              return (
                <div key={e.id} className={cn("flex flex-wrap items-center gap-4 rounded-2xl border p-3 transition hover:bg-muted/40", isLiveNow(e) && "border-cardinal bg-cardinal-50/40")}>
                  <div className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: e.flyerColor }} />
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/org/events/${e.id}`} className="font-semibold hover:text-cardinal hover:underline">
                        {e.title}
                      </Link>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" /> {formatWhen(e.date, e.startTime, e.endTime)} · {e.venue?.name ?? e.location}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {swipes} swipes · {pct(e.funnel.rightSwipes, swipes)}% right · {e.funnel.checkedIn}/{e.capacity} checked in
                    </div>
                  </div>
                  <FunnelMini f={e.funnel} />
                  <div className="w-14 text-center">
                    {e.funnel.avgRating ? (
                      <div className="flex items-center justify-center gap-0.5 font-bold">
                        <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {e.funnel.avgRating.toFixed(1)}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {e.status === "published" && (
                      <Button size="sm" variant="outline" onClick={() => goLive(e.id)}>
                        <Radio /> Go live
                      </Button>
                    )}
                    {e.status === "live" && (
                      <Link href={`/org/events/${e.id}/live`}>
                        <Button size="sm">Dashboard</Button>
                      </Link>
                    )}
                    {e.record ? (
                      <Link href={`/org/events/${e.id}/record`}>
                        <Button size="sm" variant={e.record.approved ? "secondary" : "gold"}>
                          <FileText /> {e.record.approved ? "Record" : "Review record"}
                        </Button>
                      </Link>
                    ) : (
                      e.status === "draft" && (
                        <Link href={`/org/new?id=${e.id}`}>
                          <Button size="sm" variant="outline">
                            Continue
                          </Button>
                        </Link>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Avg rating</div>
              <div className="mt-1 flex items-center gap-1 text-3xl font-black">
                {ins ? ins.avgRating.toFixed(1) : "–"} <Star className="h-5 w-5 fill-gold text-gold" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Left swipes</div>
              <div className="mt-1 text-3xl font-black">{ins ? totalReasons : "–"}</div>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-cardinal" /> Why students pass
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!ins ? (
                <Skeleton className="h-40" />
              ) : reasonData.length ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reasonData} layout="vertical" margin={{ left: 4, right: 30 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="reason" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => [`${v} (${pct(v, totalReasons)}%)`, "Passes"]} cursor={{ fill: "rgba(153,0,0,.05)" }} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} label={{ position: "right", fontSize: 12, fontWeight: 600 }}>
                        {reasonData.map((r, i) => (
                          <Cell key={r.key} fill={i === 0 ? "#990000" : "#FFCC00"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No left swipes yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-cardinal" /> Best time slots
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!ins && <Skeleton className="h-24" />}
              {ins?.bestSlots.map((s, i) => (
                <div key={s.key} className="flex items-center gap-3">
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", i === 0 ? "bg-cardinal text-white" : "bg-muted")}>{i + 1}</span>
                  <span className="flex-1 text-sm font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.rightRate}% right · ~{s.avgCheckedIn} came
                  </span>
                </div>
              ))}
              {ins && !ins.bestSlots.length && <p className="text-sm text-muted-foreground">Need more swipes to rank slots.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-cardinal" /> AI rewrite tips
              </CardTitle>
              <button
                aria-label="Refresh tips"
                className="rounded-full p-1 hover:bg-muted"
                onClick={async () => {
                  setRefreshing(true);
                  try {
                    setIns(await api<Insights>(`/api/orgs/${orgId}/insights?refresh=1`));
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </button>
            </CardHeader>
            <CardContent className="space-y-2">
              {!ins && [0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
              {ins?.tips.map((t, i) => (
                <div key={i} className="rounded-xl bg-gold-100/60 p-3 text-sm">
                  {t.eventTitle && <div className="mb-0.5 text-xs font-semibold text-cardinal">{t.eventTitle}</div>}
                  {t.tip}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <RoleGate role="org">{(id) => <History orgId={id} />}</RoleGate>;
}
