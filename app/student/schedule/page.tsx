"use client";
import { ArrowLeft, Briefcase, Lock, Pencil, Plus, RefreshCw, Trash2, User } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { DAYS_LONG, SCHEDULE_KIND_LABELS } from "@/lib/taxonomy";
import { fmt12 } from "@/lib/time";
import type { ScheduleBlockView } from "@/lib/types";

type Schedule = { importedAt: string | null; blocks: ScheduleBlockView[]; freeSlots: { day: number; start: string; end: string }[] };
type Draft = { id?: string; kind: string; title: string; location: string; day: number; start: string; end: string };
const EMPTY: Draft = { kind: "work", title: "", location: "", day: 1, start: "17:00", end: "20:00" };
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function ScheduleEditor({ id }: { id: string }) {
  const [s, setS] = React.useState<Schedule | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const load = React.useCallback(async () => setS(await api<Schedule>(`/api/students/${id}/schedule`)), [id]);
  React.useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { id: blockId, ...body } = draft;
      if (blockId) await api(`/api/schedule/${blockId}`, { method: "PATCH", body });
      else await api(`/api/students/${id}/schedule`, { body });
      toast.success(blockId ? "Updated" : "Added to your schedule");
      setDraft(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (b: ScheduleBlockView) => {
    await api(`/api/schedule/${b.id}`, { method: "DELETE" });
    toast("Removed");
    load();
  };

  if (!s)
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  const classes = s.blocks.filter((b) => !b.editable);
  const mine = s.blocks.filter((b) => b.editable);
  const byCourse = new Map<string, ScheduleBlockView[]>();
  for (const c of classes) byCourse.set(c.title, [...(byCourse.get(c.title) ?? []), c]);

  return (
    <div className="space-y-4 px-4 pt-4">
      <Link href="/student/events" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> My Events
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight">My schedule</h1>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" /> Classes from USC
            </CardTitle>
            <p className="text-xs text-muted-foreground">Imported from your USC registration{s.importedAt ? ` · ${new Date(s.importedAt).toLocaleDateString()}` : ""}. These can&apos;t be edited here.</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            loading={syncing}
            onClick={async () => {
              setSyncing(true);
              try {
                setS(await api<Schedule>(`/api/students/${id}/schedule/import`, { method: "POST" }));
                toast.success("Re-synced with USC");
              } finally {
                setSyncing(false);
              }
            }}
          >
            <RefreshCw /> Sync
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {byCourse.size === 0 && <p className="text-sm text-muted-foreground">No classes found.</p>}
          {Array.from(byCourse.entries()).map(([title, list]) => (
            <div key={title} className="rounded-xl bg-slate-100 p-3 text-sm">
              <div className="font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">
                {list.map((b) => DAYS_LONG[b.day].slice(0, 3)).join("/")} · {fmt12(list[0].start)}–{fmt12(list[0].end)}
                {list[0].location ? ` · ${list[0].location}` : ""}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Other busy time</CardTitle>
            <p className="text-xs text-muted-foreground">On- or off-campus work, practice, commitments. Events will be checked against these.</p>
          </div>
          <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
            <Plus /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {mine.length === 0 && <p className="text-sm text-muted-foreground">Nothing added yet.</p>}
          {mine.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              {b.kind === "work" ? <Briefcase className="h-4 w-4 text-sky-700" /> : <User className="h-4 w-4 text-violet-700" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{b.title}</div>
                <div className="text-xs text-muted-foreground">
                  {SCHEDULE_KIND_LABELS[b.kind]} · {DAYS_LONG[b.day]} {fmt12(b.start)}–{fmt12(b.end)}
                  {b.location ? ` · ${b.location}` : ""}
                </div>
              </div>
              <button onClick={() => setDraft({ id: b.id, kind: b.kind, title: b.title, location: b.location, day: b.day, start: b.start, end: b.end })} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => remove(b)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your free time</CardTitle>
          <p className="text-xs text-muted-foreground">Worked out automatically (8am–10pm, minus everything above). Used to rank your feed.</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {ORDER.map((d) => {
            const f = s.freeSlots.filter((x) => x.day === d);
            return (
              <div key={d} className="flex gap-2">
                <span className="w-10 shrink-0 font-semibold">{DAYS_LONG[d].slice(0, 3)}</span>
                <span className="text-muted-foreground">{f.length ? f.map((x) => `${fmt12(x.start)}–${fmt12(x.end)}`).join(", ") : "—"}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit busy time" : "Add busy time"}>
        {draft && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                  <option value="work">Work shift</option>
                  <option value="personal">Personal</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <Label>Day</Label>
                <Select value={draft.day} onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) })}>
                  {ORDER.map((d) => (
                    <option key={d} value={d}>
                      {DAYS_LONG[d]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Lyon Center front desk" />
            </div>
            <div>
              <Label>Where (optional)</Label>
              <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="On campus / off campus" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" loading={saving} disabled={!draft.title.trim()} onClick={save}>
              {draft.id ? "Save changes" : "Add to schedule"}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function Page() {
  return <RoleGate role="student">{(id) => <ScheduleEditor id={id} />}</RoleGate>;
}
