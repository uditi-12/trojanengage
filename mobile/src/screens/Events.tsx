import * as React from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import type { Nav } from "../../App";
import { api, ApiError, type Block, type Conflict, type Event as Ev } from "../api";
import { addDays, C, DAYS, dow, fmt12, todayISO } from "../theme";
import { Btn, Card, H1, Muted, s, Warn } from "../ui";

type Reg = { id: string; status: string; hasConflict: boolean; conflicts: Conflict[]; checkedIn: boolean; gaveFeedback: boolean; event: Ev };
type Sched = { blocks: Block[]; freeSlots: { day: number; start: string; end: string }[] };

function monday(d: string) {
  let x = d;
  while (dow(x) !== 1) x = addDays(x, -1);
  return x;
}

/** Mobile calendar: week strip + day timeline (classes, work, registered/saved events, free time). */
export function EventsScreen({ nav }: { nav: Nav }) {
  const [regs, setRegs] = React.useState<Reg[] | null>(null);
  const [sched, setSched] = React.useState<Sched | null>(null);
  const [week, setWeek] = React.useState(monday(todayISO()));
  const [day, setDay] = React.useState(todayISO());
  const [refreshing, setRefreshing] = React.useState(false);
  const load = React.useCallback(async () => {
    const [r, sc] = await Promise.all([api<{ registrations: Reg[] }>(`/api/students/${nav.me.id}/events`), api<Sched>(`/api/students/${nav.me.id}/schedule`)]);
    setRegs(r.registrations);
    setSched(sc);
  }, [nav.me.id]);
  React.useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const register = async (r: Reg, force = false) => {
    try {
      const res = await api<{ status: string; note?: string }>(`/api/registrations/${r.id}/confirm`, { body: { force } });
      Alert.alert(res.status === "waitlisted" ? "Waitlisted" : "Registered", res.note ? `Heads up: ${res.note}` : "Added to your calendar.");
      load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.data as any)?.needsConfirmation) {
        const list = ((e.data as any).conflicts as Conflict[]).map((c) => `• ${c.title}${c.when ? ` (${c.when})` : ""}`).join("\n");
        Alert.alert("Schedule clash", `${r.event.title} overlaps with:\n${list}\n\nRegister anyway?`, [
          { text: "Not now", style: "cancel" },
          { text: "Register anyway", onPress: () => register(r, true) },
        ]);
      } else Alert.alert("Error", (e as Error).message);
    }
  };
  const remove = async (r: Reg) => {
    await api(`/api/registrations/${r.id}`, { method: "DELETE" });
    load();
  };

  if (!regs || !sched) return <ActivityIndicator color={C.cardinal} style={{ marginTop: 80 }} />;
  const active = regs.filter((r) => r.event.status !== "closed");
  const saved = active.filter((r) => r.status === "pre-registered");
  const live = active.filter((r) => r.event.status === "live" && !r.checkedIn);

  type Item = { key: string; start: string; end: string; title: string; sub: string; color: string; dashed?: boolean; onPress?: () => void; warn?: boolean };
  const items: Item[] = [];
  for (const b of sched.blocks.filter((b) => b.day === dow(day)))
    items.push({ key: b.id, start: b.start, end: b.end, title: b.title, sub: b.kind === "class" ? `Class · ${b.location}` : `${b.kind} · ${b.location}`, color: b.kind === "class" ? "#94A3B8" : b.kind === "work" ? "#38BDF8" : "#A78BFA" });
  for (const r of active) {
    const e = r.event;
    const endDate = e.endDate && e.endDate > e.date ? e.endDate : e.date;
    if (day < e.date || day > endDate) continue;
    items.push({
      key: r.id,
      start: day === e.date ? e.startTime : "08:00",
      end: day === endDate ? e.endTime : "22:00",
      title: e.flyerHeadline || e.title,
      sub: r.status === "pre-registered" ? "Saved — not registered yet" : r.status === "waitlisted" ? "Waitlisted" : "Registered",
      color: C.cardinal,
      dashed: r.status === "pre-registered",
      warn: r.hasConflict,
      onPress: () => nav.go({ name: "event", id: e.id }),
    });
  }
  items.sort((a, b) => a.start.localeCompare(b.start));
  const free = sched.freeSlots.filter((f) => f.day === dow(day));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <H1>My Events</H1>
        <Btn title="Schedule" kind="outline" onPress={() => nav.go({ name: "schedule" })} style={{ height: 36 }} />
      </View>
      {live.map((r) => (
        <Pressable key={r.id} onPress={() => nav.go({ name: "event", id: r.event.id })} style={{ marginTop: 10, backgroundColor: "#DC2626", borderRadius: 14, padding: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>🔴 Live now: {r.event.flyerHeadline || r.event.title} — tap to check in</Text>
        </Pressable>
      ))}
      <View style={[s.row, { justifyContent: "space-between", marginTop: 14 }]}>
        <Pressable onPress={() => { setWeek(addDays(week, -7)); setDay(addDays(week, -7)); }}><Text style={{ fontSize: 22, color: C.muted }}>‹</Text></Pressable>
        {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d) => {
          const has = active.some((r) => d >= r.event.date && d <= (r.event.endDate ?? r.event.date));
          return (
            <Pressable key={d} onPress={() => setDay(d)} style={{ alignItems: "center", padding: 6, borderRadius: 12, backgroundColor: d === day ? C.cardinal : "transparent" }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: d === day ? "#fff" : C.muted }}>{DAYS[dow(d)]}</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: d === day ? "#fff" : C.text }}>{Number(d.slice(8))}</Text>
              <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: has ? (d === day ? C.gold : C.cardinal) : "transparent" }} />
            </Pressable>
          );
        })}
        <Pressable onPress={() => { setWeek(addDays(week, 7)); setDay(addDays(week, 7)); }}><Text style={{ fontSize: 22, color: C.muted }}>›</Text></Pressable>
      </View>
      <Card style={{ marginTop: 10 }}>
        {items.length === 0 && <Muted>Nothing scheduled — you&apos;re free 8am–10pm.</Muted>}
        {items.map((it) => (
          <Pressable key={it.key} onPress={it.onPress} style={{ flexDirection: "row", marginBottom: 10 }}>
            <Text style={{ width: 62, color: C.muted, fontSize: 12, fontWeight: "700" }}>{fmt12(it.start)}{"\n"}{fmt12(it.end)}</Text>
            <View style={{ flex: 1, borderLeftWidth: 4, borderLeftColor: it.color, borderStyle: it.dashed ? "dashed" : "solid", backgroundColor: it.dashed ? "#FFF6CC" : C.soft, borderRadius: 8, padding: 8 }}>
              <Text style={{ fontWeight: "700" }}>{it.warn ? "⚠ " : ""}{it.title}</Text>
              <Muted style={{ textTransform: "capitalize" }}>{it.sub}</Muted>
            </View>
          </Pressable>
        ))}
        {free.length > 0 && <Muted style={{ marginTop: 4, color: C.green }}>Free: {free.map((f) => `${fmt12(f.start)}–${fmt12(f.end)}`).join(", ")}</Muted>}
      </Card>

      <Text style={{ fontWeight: "800", marginTop: 20, marginBottom: 8, color: C.muted }}>SAVED ({saved.length})</Text>
      {saved.length === 0 && <Muted>Swipe right in your feed to save events here.</Muted>}
      {saved.map((r) => (
        <Card key={r.id} style={{ marginBottom: 10 }}>
          <Pressable onPress={() => nav.go({ name: "event", id: r.event.id })}>
            <Text style={{ fontWeight: "800" }}>{r.event.flyerHeadline || r.event.title}</Text>
            <Muted>{r.event.date} · {fmt12(r.event.startTime)}–{fmt12(r.event.endTime)} · {r.event.location}</Muted>
          </Pressable>
          {r.hasConflict && <Warn>{r.conflicts.map((c) => c.title).join(", ")}</Warn>}
          <View style={[s.row, { gap: 8, marginTop: 10 }]}>
            <Btn title="Register" onPress={() => register(r)} style={{ flex: 1, height: 40 }} />
            <Btn title="Remove" kind="ghost" onPress={() => remove(r)} style={{ height: 40 }} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
