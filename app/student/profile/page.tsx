"use client";
import { LogOut, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { useSession } from "@/components/session-provider";
import * as React from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import Link from "next/link";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { DAYS, GOAL_LABELS, GOALS, TAG_LABELS, TAGS } from "@/lib/taxonomy";
import { fmt12, type FreeSlot } from "@/lib/time";

type Profile = {
  student: { id: string; name: string; avatarUrl: string; major: string; year: string; interests: string[]; goals: string[]; freeSlots: FreeSlot[] };
  topTags: { tag: string; label: string; weight: number }[];
  sentence: string;
  swipeCount: number;
  nextRefreshIn: number;
};

function ProfileView({ id }: { id: string }) {
  const { logout } = useSession();
  const [p, setP] = React.useState<Profile | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [interests, setInterests] = React.useState<string[]>([]);
  const [goals, setGoals] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(
    async (refresh = false) => {
      const d = await api<Profile>(`/api/students/${id}/profile${refresh ? "?refresh=1" : ""}`);
      setP(d);
      setInterests(d.student.interests);
      setGoals(d.student.goals);
    },
    [id],
  );
  React.useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/students/${id}/setup`, { body: { interests, goals } });
      toast.success("Profile updated — your feed will adapt");
      setEditing(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  if (!p)
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-56" />
      </div>
    );
  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="flex items-center gap-3">
        <Avatar name={p.student.name} src={p.student.avatarUrl} size={56} />
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">{p.student.name}</h1>
          <div className="text-sm text-muted-foreground">
            {p.student.major} · {p.student.year}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={logout}>
          <LogOut /> Log out
        </Button>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-cardinal to-cardinal-900 p-4 text-white shadow-lift">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Your taste, in one line
          </div>
          <button
            onClick={async () => {
              setRefreshing(true);
              await load(true).finally(() => setRefreshing(false));
            }}
            className="rounded-full p-1 hover:bg-white/10"
            aria-label="Refresh"
          >
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </button>
        </div>
        <p className="mt-2 text-lg font-semibold leading-snug">{p.sentence || "Swipe a few events and we'll describe your taste."}</p>
        <p className="mt-2 text-xs text-white/70">
          {p.swipeCount} swipes · refreshes in {p.nextRefreshIn} swipe{p.nextRefreshIn === 1 ? "" : "s"}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Top tags</CardTitle>
          <p className="text-xs text-muted-foreground">Learned from your swipes, registrations and feedback</p>
        </CardHeader>
        <CardContent>
          {p.topTags.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={p.topTags} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => v.toFixed(2)} cursor={{ fill: "rgba(153,0,0,.05)" }} />
                  <Bar dataKey="weight" radius={[0, 8, 8, 0]}>
                    {p.topTags.map((t, i) => (
                      <Cell key={t.tag} fill={i === 0 ? "#990000" : i < 3 ? "#b33333" : "#FFCC00"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No signal yet.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Interests, goals & free time</CardTitle>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!editing ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {p.student.interests.map((t) => (
                  <Badge key={t} variant="secondary">
                    {TAG_LABELS[t] ?? t}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.student.goals.map((g) => (
                  <Badge key={g} variant="gold">
                    {GOAL_LABELS[g] ?? g}
                  </Badge>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                {p.student.freeSlots.map((s, i) => (
                  <div key={i} className="text-muted-foreground">
                    <span className="inline-block w-10 font-semibold text-foreground">{DAYS[s.day]}</span> {fmt12(s.start)} – {fmt12(s.end)}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <Chip key={t} active={interests.includes(t)} onClick={() => toggle(interests, setInterests, t)}>
                    {TAG_LABELS[t]}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <Chip key={g} active={goals.includes(g)} onClick={() => toggle(goals, setGoals, g)}>
                    {GOAL_LABELS[g]}
                  </Chip>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Free time comes from your USC classes and the busy time you add under{" "}
                <Link href="/student/schedule" className="font-semibold text-cardinal underline">
                  Schedule
                </Link>
                .
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={save} loading={saving} disabled={!interests.length}>
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return <RoleGate role="student">{(id) => <ProfileView id={id} />}</RoleGate>;
}
