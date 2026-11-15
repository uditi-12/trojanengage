"use client";
import { CheckCircle2, Eye, PencilLine, RefreshCw, Save, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { RecordView } from "@/lib/types";

function RecordEditor({ eventId }: { eventId: string }) {
  const [rec, setRec] = React.useState<RecordView | null>(null);
  const [title, setTitle] = React.useState("");
  const [md, setMd] = React.useState("");
  const [tab, setTab] = React.useState<"preview" | "edit">("preview");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [regen, setRegen] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const d = await api<{ event: { title: string }; record: RecordView | null }>(`/api/events/${eventId}/record`);
        setTitle(d.event.title);
        setRec(d.record);
        setMd(d.record?.markdown ?? "");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  const dirty = rec && md !== rec.markdown;
  const save = async () => {
    if (!rec) return;
    setSaving(true);
    try {
      const d = await api<{ record: RecordView }>(`/api/records/${rec.id}`, { method: "PATCH", body: { markdown: md } });
      setRec(d.record);
      toast.success("Saved");
    } finally {
      setSaving(false);
    }
  };
  const approve = async () => {
    if (!rec) return;
    setApproving(true);
    try {
      if (dirty) await api(`/api/records/${rec.id}`, { method: "PATCH", body: { markdown: md } });
      const d = await api<{ record: RecordView }>(`/api/records/${rec.id}/approve`, { method: "POST" });
      setRec(d.record);
      toast.success("Record approved — it will now power pre-fill for future events");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApproving(false);
    }
  };
  const regenerate = async () => {
    setRegen(true);
    try {
      const d = await api<{ record: RecordView }>(`/api/events/${eventId}/record`, { method: "POST" });
      setRec(d.record);
      setMd(d.record.markdown);
      toast.success("Record regenerated");
    } finally {
      setRegen(false);
    }
  };

  if (loading)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-cardinal">
          <Sparkles className="h-4 w-4 animate-pulse" /> AI is writing the event record…
        </div>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  if (!rec) return <p className="text-muted-foreground">This event has no record yet — close it from the live dashboard first.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Event record</h1>
            {rec.approved ? (
              <Badge variant="success">
                <CheckCircle2 /> Approved
              </Badge>
            ) : (
              <Badge variant="warning">Draft — review & approve</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={regenerate} loading={regen}>
            <RefreshCw /> Regenerate
          </Button>
          {dirty && (
            <Button variant="outline" onClick={save} loading={saving}>
              <Save /> Save
            </Button>
          )}
          <Button onClick={approve} loading={approving} disabled={rec.approved && !dirty}>
            <CheckCircle2 /> {rec.approved && !dirty ? "Approved" : "Approve"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex gap-1 border-b p-2">
            {(["preview", "edit"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium capitalize", tab === t ? "bg-cardinal text-white" : "hover:bg-muted")}>
                {t === "preview" ? <Eye className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />} {t}
              </button>
            ))}
          </div>
          <CardContent className="pt-5">{tab === "preview" ? <Markdown>{md}</Markdown> : <Textarea value={md} onChange={(e) => setMd(e.target.value)} className="min-h-[600px] font-mono text-xs" />}</CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Feedback themes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rec.feedbackThemes.length === 0 && <p className="text-sm text-muted-foreground">No feedback.</p>}
              {rec.feedbackThemes.map((t) => (
                <div key={t.theme} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.theme}</span>
                    <Badge variant={t.sentiment === "positive" ? "success" : t.sentiment === "negative" ? "danger" : "secondary"}>{t.count}</Badge>
                  </div>
                  {t.quote && <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Keep / Change</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {rec.keepChange.keep.map((k) => (
                <div key={k} className="flex gap-2">
                  <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {k}
                </div>
              ))}
              {rec.keepChange.change.map((c) => (
                <div key={c} className="flex gap-2">
                  <ThumbsDown className="mt-0.5 h-4 w-4 shrink-0 text-cardinal" /> {c}
                </div>
              ))}
            </CardContent>
          </Card>
          {rec.approved && (
            <Link href="/org/new">
              <Button variant="gold" className="w-full">
                Plan the next one with this record →
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  return <RoleGate role="org">{() => <RecordEditor eventId={params.id} />}</RoleGate>;
}
