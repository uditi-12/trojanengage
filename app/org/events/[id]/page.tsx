"use client";
import {
  Accessibility,
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Eye,
  FileText,
  Gift,
  Lock,
  MapPin,
  Pencil,
  Radio,
  Rocket,
  ShieldAlert,
  Star,
  TriangleAlert,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { EventCardFace, whenLabel } from "@/components/event-card";
import { FunnelChart } from "@/components/funnel-chart";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { CAMPUS_LABELS, EVENT_TYPE_LABELS, REASON_LABELS, RESTRICTION_LABELS, TAG_LABELS } from "@/lib/taxonomy";
import { fmt12, isLiveNow } from "@/lib/time";
import { pct } from "@/lib/utils";
import type { EventView, FunnelView } from "@/lib/types";

type Resp = { event: EventView; funnel: FunnelView; record: { id: string; approved: boolean } | null };
type Avail = {
  clashes: { id: string; title: string; orgName: string; sameOrg: boolean; sameVenue: boolean; when: string }[];
  availability: { pctFree: number; total: number; busy: Record<string, number> };
};

function Detail({ eventId, orgId }: { eventId: string; orgId: string }) {
  const router = useRouter();
  const [d, setD] = React.useState<Resp | null>(null);
  const [av, setAv] = React.useState<Avail | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    const r = await api<Resp>(`/api/events/${eventId}`);
    setD(r);
    if (r.event.status !== "closed")
      api<Avail>("/api/events/availability", {
        body: { orgId, date: r.event.date, endDate: r.event.endDate, startTime: r.event.startTime, endTime: r.event.endTime, venueId: r.event.venueId, tags: r.event.tags, excludeEventId: r.event.id },
      })
        .then(setAv)
        .catch(() => {});
  }, [eventId, orgId]);
  React.useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);

  const act = async (kind: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(kind);
    try {
      await fn();
      toast.success(msg);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!d)
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  if (d.event.orgId !== orgId) return <p className="text-muted-foreground">This event belongs to another org.</p>;
  const e = d.event;
  const f = d.funnel;
  const reasons = Object.entries(f.reasons).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <Link href="/org/history" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> History
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">{e.title}</h1>
            <Badge variant={e.status === "live" ? "default" : e.status === "published" ? "gold" : e.status === "closed" ? "secondary" : "outline"} className="capitalize">
              {isLiveNow(e) && <Radio />} {e.status === "live" && !isLiveNow(e) ? "check-in open" : e.status}
            </Badge>
            {e.visibility === "members-only" && <Badge variant="outline">Members only</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}
            {e.coHosts.length ? ` · with ${e.coHosts.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {e.status !== "closed" && (
            <Link href={`/org/new?id=${e.id}`}>
              <Button variant="outline">
                <Pencil /> Edit event
              </Button>
            </Link>
          )}
          {e.status === "draft" && (
            <Button loading={busy === "publish"} onClick={() => act("publish", () => api(`/api/events/${e.id}/publish`, { method: "POST" }), "Published")}>
              <Rocket /> Publish
            </Button>
          )}
          {e.status === "published" && (
            <Button variant="gold" loading={busy === "live"} onClick={() => act("live", () => api(`/api/events/${e.id}`, { method: "PATCH", body: { status: "live" } }), "Event is live — check-in open")}>
              <Radio /> Go live
            </Button>
          )}
          {e.status === "live" && (
            <Link href={`/org/events/${e.id}/live`}>
              <Button>
                <Radio /> Live dashboard
              </Button>
            </Link>
          )}
          {(e.status === "live" || e.status === "published") && (
            <Button
              variant="ghost"
              loading={busy === "close"}
              onClick={async () => {
                setBusy("close");
                try {
                  await api(`/api/events/${e.id}/close`, { method: "POST" });
                  router.push(`/org/events/${e.id}/record`);
                } catch (err) {
                  toast.error((err as Error).message);
                  setBusy(null);
                }
              }}
            >
              <Lock /> Close
            </Button>
          )}
          {d.record && (
            <Link href={`/org/events/${e.id}/record`}>
              <Button variant={d.record.approved ? "secondary" : "gold"}>
                <FileText /> {d.record.approved ? "Record" : "Review record"}
              </Button>
            </Link>
          )}
          <Link href={`/event/${e.id}`} target="_blank">
            <Button variant="ghost">
              <Eye /> Student view
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Event details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Row icon={<CalendarDays />} label="When" value={whenLabel(e)} />
              <Row icon={<MapPin />} label="Where" value={`${e.format === "virtual" ? "Online" : e.location || e.venue?.name || "TBD"} · ${CAMPUS_LABELS[e.campus] ?? e.campus}`} />
              <Row icon={<Video />} label="Format" value={e.format === "in-person" ? "In person" : e.format === "hybrid" ? `Hybrid${e.virtualUrl ? " (stream link set)" : ""}` : "Virtual"} />
              <Row icon={<Users />} label="Capacity" value={`${e.capacity} · ${f.registered} registered · waitlist ${e.waitlistEnabled ? "on" : "off"}`} />
              <Row icon={<Wallet />} label="Budget / ticket" value={`$${e.budget.toLocaleString()} · ${e.ticketCost ? `$${e.ticketCost} ticket` : "free entry"}`} />
              <Row icon={<Gift />} label="Food & goodies" value={`${e.foodType === "free" ? "Free food" : e.foodType === "paid" ? "Food for sale" : "No food"}${e.goodies ? ` · ${e.goodies}` : ""}`} />
              <Row icon={<Users />} label="Audience" value={`${e.audience}${e.visibility === "members-only" ? " · members only" : ""}`} />
              <Row icon={<ShieldAlert />} label="Requirements" value={e.restrictions.length ? e.restrictions.map((r) => RESTRICTION_LABELS[r] ?? r).join(", ") : "None"} />
              <Row icon={<Accessibility />} label="Accessibility" value={e.accessibilityNotes || "Not stated — add it before publishing"} warn={!e.accessibilityNotes} className="sm:col-span-2" />
              {e.registrationUrl && <Row icon={<ExternalLink />} label="External RSVP" value={e.registrationUrl} className="sm:col-span-2" />}
              <div className="sm:col-span-2">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Description</div>
                <p className="whitespace-pre-line leading-relaxed">{e.description || "—"}</p>
              </div>
              {e.agenda.length > 0 && (
                <div className="sm:col-span-2">
                  <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Agenda</div>
                  <ol className="space-y-0.5">
                    {e.agenda.map((a, i) => (
                      <li key={i}>
                        <span className="font-semibold text-cardinal">
                          {a.day ? `${a.day} ` : ""}
                          {fmt12(a.time)}
                        </span>{" "}
                        {a.title}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 sm:col-span-2">
                {e.tags.map((t) => (
                  <Badge key={t} variant="secondary">
                    {TAG_LABELS[t] ?? t}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Funnel</CardTitle>
              <span className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-gold text-gold" /> {f.avgRating ? f.avgRating.toFixed(1) : "–"} · {f.feedbackCount} feedback
              </span>
            </CardHeader>
            <CardContent>
              <FunnelChart f={f} height={200} />
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <span>{pct(f.rightSwipes, f.rightSwipes + f.leftSwipes)}% right-swipe rate</span>
                <span>{pct(f.registered, f.preRegistered)}% saved → registered</span>
                <span>{pct(f.checkedIn, f.registered)}% show-up</span>
                <span>{pct(f.checkedIn, e.capacity)}% of capacity</span>
              </div>
              {reasons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {reasons.map(([r, n]) => (
                    <Badge key={r} variant="outline">
                      {REASON_LABELS[r] ?? r}: {n}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {av && (
            <Card className={av.clashes.length ? "border-amber-300" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-cardinal" /> Availability & conflicts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="text-3xl font-black">{av.availability.pctFree}%</div>
                  <div className="text-xs text-muted-foreground">
                    of {av.availability.total} interested students are free · {av.availability.busy.class} in class · {av.availability.busy.work} working · {av.availability.busy.event} at other events
                  </div>
                </div>
                {av.clashes.length === 0 ? (
                  <p className="text-xs text-emerald-700">No other campus events at this time.</p>
                ) : (
                  av.clashes.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-start gap-2 rounded-xl bg-amber-50 p-2 text-xs">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span>
                        <b>{c.title}</b> · {c.orgName} · {c.when}
                        {c.sameVenue && <span className="ml-1 font-semibold text-red-700">same venue!</span>}
                        {c.sameOrg && <span className="ml-1 font-semibold">your org</span>}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Student card</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto h-[460px] max-w-[320px]">
                <EventCardFace e={e} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value, warn, className }: { icon: React.ReactNode; label: string; value: string; warn?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon} {label}
      </div>
      <div className={warn ? "text-amber-700" : ""}>{value}</div>
    </div>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  return <RoleGate role="org">{(orgId) => <Detail eventId={params.id} orgId={orgId} />}</RoleGate>;
}
