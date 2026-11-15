"use client";
import { CheckCircle2, FileUp, Save, Sparkles, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { OrgLogo } from "@/components/avatar";
import { RoleGate } from "@/components/role-gate";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { EVENT_TYPES } from "@/lib/taxonomy";

type Row = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  eventType: string;
  description: string;
  location: string;
  foodType: string;
  budget: number;
  capacity: number;
  attendance: number;
  rating: number;
  tags: string[];
  notes: string;
};

const SAMPLE = `Past events — exported from our old Google Doc

- Resume Roast Night — Oct 2, 2025, 6-8pm at Leavey Library 3rd floor. Free pizza. Budget $250, capacity 40, about 34 people came. Notes: loved the 1:1 reviews; too crowded near the end, get a bigger room.

- Hack Night: Build a Chrome Extension — 11/6/2025 7pm-10pm, SAL computer lab. Budget $180. 22 attended out of 30. Feedback: great mentors but ran too long, shorten to 2 hours.

title,date,time,location,budget,capacity,attendance,rating,notes
Spring Mixer with Alumni,2026-03-12,6pm-8pm,Ronald Tutor Campus Center,600,80,71,4.6,"Alumni loved it; keep the name tags, start earlier"`;

type OrgFull = { id: string; name: string; category: string; description: string; logoUrl: string };

function Setup({ orgId }: { orgId: string }) {
  const { refresh } = useSession();
  const [org, setOrg] = React.useState<OrgFull | null>(null);
  const [stats, setStats] = React.useState<{ counts: Record<string, number>; approvedRecords: number } | null>(null);
  const [text, setText] = React.useState("");
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [extracting, setExtracting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savingOrg, setSavingOrg] = React.useState(false);
  const [done, setDone] = React.useState<number | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const loadOrg = React.useCallback(async () => {
    const d = await api<{ org: OrgFull; counts: Record<string, number>; approvedRecords: number }>(`/api/orgs/${orgId}`);
    setOrg(d.org);
    setStats({ counts: d.counts, approvedRecords: d.approvedRecords });
  }, [orgId]);
  React.useEffect(() => {
    loadOrg().catch((e) => toast.error(e.message));
  }, [loadOrg]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.(txt|md|csv)$/i.test(f.name)) return toast.error("Upload a .txt, .md or .csv file");
    const t = await f.text();
    setText((prev) => (prev ? prev + "\n\n" : "") + t);
    toast.success(`Added ${f.name}`);
  };

  const extract = async () => {
    setExtracting(true);
    setDone(null);
    try {
      const d = await api<{ rows: Row[]; usedFallback: boolean }>(`/api/orgs/${orgId}/import`, { body: { text } });
      setRows(d.rows);
      if (!d.rows.length) toast.warning("No events found — make sure each event has a title and a date.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };
  const confirm = async () => {
    if (!rows?.length) return;
    setSaving(true);
    try {
      const d = await api<{ created: number }>(`/api/orgs/${orgId}/import/confirm`, { body: { rows } });
      setDone(d.created);
      setRows(null);
      setText("");
      loadOrg();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r?.map((x, j) => (j === i ? { ...x, ...patch } : x)) ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Setup & import</h1>
        <p className="text-sm text-muted-foreground">Bring your org&apos;s history in once — every future event plan builds on it.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Org profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!org ? (
              <Skeleton className="h-48" />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <OrgLogo org={org} size={52} />
                  <div className="text-xs text-muted-foreground">
                    {stats?.counts.closed ?? 0} past · {stats?.counts.published ?? 0} upcoming · {stats?.approvedRecords ?? 0} approved records
                  </div>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={org.category} onChange={(e) => setOrg({ ...org, category: e.target.value })} />
                </div>
                <div>
                  <Label>Logo (emoji or image URL)</Label>
                  <Input value={org.logoUrl} onChange={(e) => setOrg({ ...org, logoUrl: e.target.value })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={org.description} onChange={(e) => setOrg({ ...org, description: e.target.value })} />
                </div>
                <Button
                  className="w-full"
                  loading={savingOrg}
                  onClick={async () => {
                    setSavingOrg(true);
                    try {
                      await api(`/api/orgs/${orgId}`, { method: "PATCH", body: { name: org.name, category: org.category, description: org.description, logoUrl: org.logoUrl } });
                      await refresh();
                      toast.success("Org profile saved");
                    } finally {
                      setSavingOrg(false);
                    }
                  }}
                >
                  <Save /> Save profile
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-cardinal" /> Add your files
              </CardTitle>
              <p className="text-sm text-muted-foreground">Paste old docs, notes or a CSV export — or upload .txt / .md / .csv. AI extracts each past event for you to review.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files?.[0]);
                }}
              >
                <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste anything: meeting notes, a recap email, a spreadsheet export…" className="min-h-[200px] font-mono text-xs" />
              </div>
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept=".txt,.md,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <FileUp /> Upload file
                </Button>
                <Button variant="ghost" onClick={() => setText(SAMPLE)}>
                  Use sample notes
                </Button>
                <Button className="ml-auto" onClick={extract} loading={extracting} disabled={text.trim().length < 10}>
                  <Sparkles /> Extract events
                </Button>
              </div>
              {done !== null && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" /> Imported {done} event{done === 1 ? "" : "s"} with records.{" "}
                  <Link href="/org/history" className="font-semibold underline">
                    See history
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {extracting && <Skeleton className="h-48" />}
          {rows && rows.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Review {rows.length} extracted event{rows.length === 1 ? "" : "s"}</CardTitle>
                <Button onClick={confirm} loading={saving}>
                  <CheckCircle2 /> Confirm & import
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="p-2">Title</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Time</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Location</th>
                      <th className="p-2">Budget</th>
                      <th className="p-2">Cap</th>
                      <th className="p-2">Came</th>
                      <th className="p-2">Notes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b align-top">
                        <td className="p-1.5">
                          <Input value={r.title} onChange={(e) => update(i, { title: e.target.value })} className="h-8 min-w-[180px]" />
                        </td>
                        <td className="p-1.5">
                          <Input type="date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} className="h-8" />
                        </td>
                        <td className="p-1.5">
                          <div className="flex gap-1">
                            <Input type="time" value={r.startTime} onChange={(e) => update(i, { startTime: e.target.value })} className="h-8 w-[92px]" />
                            <Input type="time" value={r.endTime} onChange={(e) => update(i, { endTime: e.target.value })} className="h-8 w-[92px]" />
                          </div>
                        </td>
                        <td className="p-1.5">
                          <Select value={r.eventType} onChange={(e) => update(i, { eventType: e.target.value })} className="h-8">
                            {EVENT_TYPES.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="p-1.5">
                          <Input value={r.location} onChange={(e) => update(i, { location: e.target.value })} className="h-8 min-w-[140px]" />
                        </td>
                        <td className="p-1.5">
                          <Input type="number" value={r.budget} onChange={(e) => update(i, { budget: Number(e.target.value) })} className="h-8 w-20" />
                        </td>
                        <td className="p-1.5">
                          <Input type="number" value={r.capacity} onChange={(e) => update(i, { capacity: Number(e.target.value) })} className="h-8 w-16" />
                        </td>
                        <td className="p-1.5">
                          <Input type="number" value={r.attendance} onChange={(e) => update(i, { attendance: Number(e.target.value) })} className="h-8 w-16" />
                        </td>
                        <td className="p-1.5">
                          <Textarea value={r.notes} onChange={(e) => update(i, { notes: e.target.value })} className="min-h-[34px] min-w-[200px] py-1 text-xs" />
                        </td>
                        <td className="p-1.5">
                          <Button size="icon" variant="ghost" onClick={() => setRows((rs) => rs?.filter((_, j) => j !== i) ?? null)} aria-label="Remove row">
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <RoleGate role="org">{(id) => <Setup orgId={id} />}</RoleGate>;
}
