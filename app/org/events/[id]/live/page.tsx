"use client";
import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, Lock, Maximize2, Radio, Star, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import * as React from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { FunnelChart } from "@/components/funnel-chart";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { pct } from "@/lib/utils";
import type { FunnelView } from "@/lib/types";

type Live = { event: { id: string; title: string; status: string; capacity: number }; funnel: FunnelView; recent: { name: string; avatarUrl: string; at: string }[] };

function Counter({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <motion.div key={value} initial={{ scale: 1.25, color: "#990000" }} animate={{ scale: 1, color: "#111827" }} className="mt-1 text-4xl font-black tabular-nums">
        {value}
      </motion.div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function LiveSwitcher({ orgId, current }: { orgId: string; current: string }) {
  const [live, setLive] = React.useState<{ id: string; title: string; flyerHeadline: string; startTime: string; endTime: string; checkedIn: number; capacity: number }[]>([]);
  React.useEffect(() => {
    const loadLive = () =>
      api<{ live: typeof live }>(`/api/orgs/${orgId}/live`)
        .then((d) => setLive(d.live))
        .catch(() => {});
    loadLive();
    const t = setInterval(loadLive, 5000);
    return () => clearInterval(t);
  }, [orgId]);
  if (live.length < 2) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <span className="flex shrink-0 items-center text-xs font-semibold uppercase text-muted-foreground">{live.length} live now:</span>
      {live.map((l) => (
        <Link
          key={l.id}
          href={`/org/events/${l.id}/live`}
          className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium ${l.id === current ? "border-cardinal bg-cardinal text-white" : "bg-card hover:border-cardinal"}`}
        >
          <span className="h-2 w-2 rounded-full bg-red-500" />
          {l.flyerHeadline || l.title}
          <span className={`text-xs ${l.id === current ? "text-white/80" : "text-muted-foreground"}`}>
            {l.checkedIn}/{l.capacity}
          </span>
        </Link>
      ))}
    </div>
  );
}

function LiveDash({ id, orgId }: { id: string; orgId: string }) {
  const router = useRouter();
  const [d, setD] = React.useState<Live | null>(null);
  const [origin, setOrigin] = React.useState("");
  const [simulating, setSimulating] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [big, setBig] = React.useState(false);
  React.useEffect(() => setOrigin(window.location.origin), []);
  const load = React.useCallback(async () => setD(await api<Live>(`/api/events/${id}/live`)), [id]);
  React.useEffect(() => {
    load().catch((e) => toast.error(e.message));
    const t = setInterval(() => load().catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [load]);

  const simulate = async () => {
    setSimulating(true);
    try {
      const r = await api<{ created: number }>(`/api/events/${id}/simulate`, { body: { n: 20 } });
      toast.success(`${r.created} simulated attendees checked in`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSimulating(false);
    }
  };
  const goLive = async () => {
    await api(`/api/events/${id}`, { method: "PATCH", body: { status: "live" } });
    load();
  };
  const close = async () => {
    setClosing(true);
    try {
      await api(`/api/events/${id}/close`, { method: "POST" });
      router.push(`/org/events/${id}/record`);
    } catch (e) {
      toast.error((e as Error).message);
      setClosing(false);
    }
  };

  if (!d)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  const f = d.funnel;
  const url = `${origin}/checkin/${id}`;
  return (
    <div className="space-y-5">
      <LiveSwitcher orgId={orgId} current={id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-cardinal">
            {d.event.status === "live" ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                </span>
                LIVE · updating every 3s
              </>
            ) : (
              <span className="capitalize text-muted-foreground">{d.event.status}</span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{d.event.title}</h1>
        </div>
        <div className="flex gap-2">
          {d.event.status === "published" && (
            <Button variant="gold" onClick={goLive}>
              <Radio /> Go live
            </Button>
          )}
          <Button variant="outline" onClick={simulate} loading={simulating} disabled={d.event.status !== "live"}>
            <FlaskConical /> Simulate 20 attendees
          </Button>
          <Button onClick={close} loading={closing} disabled={d.event.status === "closed"}>
            <Lock /> Close event
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card className="flex flex-col items-center p-6">
          <div className="text-sm font-semibold text-muted-foreground">Scan to check in</div>
          <button onClick={() => setBig(true)} className="group relative mt-3 rounded-3xl bg-white p-4 shadow-lift ring-4 ring-gold" aria-label="Enlarge QR">
            {origin && <QRCodeSVG value={url} size={260} fgColor="#990000" level="M" />}
            <Maximize2 className="absolute right-2 top-2 h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="mt-3 break-all text-center text-xs text-muted-foreground hover:text-cardinal">
            {url}
          </a>
          <div className="mt-5 w-full">
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span>Capacity</span>
              <span>
                {f.checkedIn}/{d.event.capacity} ({pct(f.checkedIn, d.event.capacity)}%)
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-gold to-cardinal" animate={{ width: `${Math.min(100, pct(f.checkedIn, d.event.capacity))}%` }} />
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Counter label="Swiped right" value={f.rightSwipes} sub={`${pct(f.rightSwipes, f.rightSwipes + f.leftSwipes)}% of swipes`} />
            <Counter label="Pre-registered" value={f.preRegistered} />
            <Counter label="Registered" value={f.registered} />
            <Counter label="Checked in" value={f.checkedIn} sub={`${pct(f.checkedIn, f.registered)}% of registered`} />
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Funnel</CardTitle>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-gold text-gold" /> {f.avgRating ? f.avgRating.toFixed(1) : "–"}
                </span>
                <span className="text-muted-foreground">{f.feedbackCount} feedback</span>
              </div>
            </CardHeader>
            <CardContent>
              <FunnelChart f={f} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-cardinal" /> Just checked in
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence initial={false}>
                  {d.recent.map((r) => (
                    <motion.div key={r.name + r.at} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-sm">
                      <Avatar name={r.name} src={r.avatarUrl} size={24} /> {r.name}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!d.recent.length && <p className="text-sm text-muted-foreground">No check-ins yet. Scan the QR with a phone, or simulate.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {big && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cardinal p-6 text-white" onClick={() => setBig(false)}>
          <div className="mb-6 text-3xl font-black">{d.event.title}</div>
          <div className="rounded-3xl bg-white p-6">
            <QRCodeSVG value={url} size={420} fgColor="#990000" />
          </div>
          <div className="mt-6 text-xl font-semibold text-gold">Scan to check in · {f.checkedIn} here</div>
        </div>
      )}

      {closing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-3xl bg-card p-8 text-center shadow-2xl">
            <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-cardinal border-t-transparent" />
            <div className="mt-4 font-semibold">Closing event & writing the record…</div>
            <div className="text-sm text-muted-foreground">Clustering feedback · summarizing the funnel</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  return <RoleGate role="org">{(orgId) => <LiveDash id={params.id} orgId={orgId} />}</RoleGate>;
}
