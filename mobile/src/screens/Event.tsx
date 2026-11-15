import * as React from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import type { Nav } from "../../App";
import { api, ApiError, type Conflict, type Event as Ev } from "../api";
import { C, fmt12, when } from "../theme";
import { Badge, Btn, Card, MatchPill, Muted, s, Warn } from "../ui";

type Detail = {
  event: Ev & { goodies: string; accessibilityNotes: string; virtualUrl: string | null; registrationUrl: string | null; coHosts: string[]; visibility: string };
  funnel: { registered: number };
  me: { registration: { id: string; status: string } | null; checkedIn: boolean; gaveFeedback: boolean; matchPct: number | null; why: string | null; conflicts: Conflict[] } | null;
};
type Summary = { overview: string; whatYoullDo: string[]; goodToKnow: string[]; whoItsFor: string };

export function EventScreen({ nav, id }: { nav: Nav; id: string }) {
  const [d, setD] = React.useState<Detail | null>(null);
  const [sum, setSum] = React.useState<Summary | null>(null);
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => setD(await api<Detail>(`/api/events/${id}`)), [id]);
  React.useEffect(() => {
    load().catch(() => {});
    api<{ summary: Summary }>(`/api/events/${id}/summary`).then((x) => setSum(x.summary)).catch(() => {});
  }, [id, load]);

  // Register with clash warning — the student can always proceed.
  const register = async (force = false) => {
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; status?: string; note?: string }>(`/api/events/${id}/register`, { body: { force } });
      Alert.alert(r.status === "waitlisted" ? "On the waitlist" : "Registered!", r.note ? `Heads up: ${r.note}` : "It's on your calendar.");
      load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.data as any)?.needsConfirmation) {
        const list = ((e.data as any).conflicts as Conflict[]).map((c) => `• ${c.title}${c.when ? ` (${c.when})` : ""}`).join("\n");
        Alert.alert("Schedule clash", `This overlaps with:\n${list}\n\nRegister anyway?`, [
          { text: "Not now", style: "cancel" },
          { text: "Register anyway", onPress: () => register(true) },
        ]);
      } else Alert.alert("Couldn't register", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/events/${id}/save`, { method: "POST" });
      load();
    } finally {
      setBusy(false);
    }
  };
  const checkIn = async () => {
    setBusy(true);
    try {
      await api("/api/checkin", { body: { eventId: id } });
      nav.go({ name: "feedback", id });
    } catch (e) {
      Alert.alert("Check-in", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!d) return <ActivityIndicator color={C.cardinal} style={{ marginTop: 80 }} />;
  const e = d.event;
  const me = d.me;
  const status = me?.registration?.status;
  const spots = Math.max(0, e.capacity - d.funnel.registered);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Pressable onPress={nav.back}>
        <Text style={{ color: C.muted, marginBottom: 10 }}>‹ Back</Text>
      </Pressable>
      <View style={{ backgroundColor: e.flyerColor || C.cardinal, borderRadius: 24, padding: 20 }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Badge label={e.status === "live" ? "🔴 LIVE NOW" : e.eventType} bg="rgba(255,255,255,0.22)" fg="#fff" />
          {typeof me?.matchPct === "number" && <MatchPill pct={me.matchPct} />}
        </View>
        <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 30, fontWeight: "700", fontSize: 11, textTransform: "uppercase" }}>
          {e.org?.name}
          {e.coHosts.length ? ` × ${e.coHosts.join(", ")}` : ""}
        </Text>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>{e.flyerHeadline || e.title}</Text>
      </View>
      {me?.why && <Text style={{ color: C.cardinal, marginTop: 10, fontWeight: "600" }}>✨ {me.why}</Text>}
      {me && me.conflicts.length > 0 && <Warn>Clashes with {me.conflicts.map((c) => c.title).join(", ")}</Warn>}

      <View style={{ marginTop: 14, gap: 8 }}>
        {e.status === "live" && !me?.checkedIn && <Btn title="I'm here — check in" kind="gold" onPress={checkIn} loading={busy} />}
        {me?.checkedIn && !me.gaveFeedback && status === "registered" && <Btn title="Give 10-second feedback" onPress={() => nav.go({ name: "feedback", id })} />}
        {(e.status === "published" || e.status === "live") && status !== "registered" && status !== "waitlisted" && (
          <View style={[s.row, { gap: 8 }]}>
            {(!status || status === "cancelled") && <Btn title="Save" kind="outline" onPress={save} loading={busy} style={{ flex: 1 }} />}
            <Btn title={spots === 0 ? "Join waitlist" : "Register"} onPress={() => register(false)} loading={busy} style={{ flex: 1 }} />
          </View>
        )}
        {status === "registered" && e.status === "published" && <Muted style={{ textAlign: "center" }}>✓ You&apos;re registered — check-in opens when it goes live.</Muted>}
        {status === "waitlisted" && <Muted style={{ textAlign: "center" }}>You&apos;re on the waitlist.</Muted>}
        {e.registrationUrl && <Btn title="Org RSVP form ↗" kind="ghost" onPress={() => Linking.openURL(e.registrationUrl!)} />}
      </View>

      <Card style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 6 }}>About this event</Text>
        {!sum ? (
          <ActivityIndicator color={C.cardinal} />
        ) : (
          <>
            <Text style={{ lineHeight: 21 }}>{sum.overview.replace(/\*\*/g, "")}</Text>
            <Text style={{ fontWeight: "700", marginTop: 12, color: C.muted, fontSize: 12 }}>WHAT YOU&apos;LL DO</Text>
            {sum.whatYoullDo.map((x, i) => <Text key={i} style={{ marginTop: 3 }}>• {x}</Text>)}
            <Text style={{ fontWeight: "700", marginTop: 12, color: C.muted, fontSize: 12 }}>GOOD TO KNOW</Text>
            {sum.goodToKnow.map((x, i) => <Text key={i} style={{ marginTop: 3 }}>• {x}</Text>)}
            <Text style={{ marginTop: 12, backgroundColor: C.soft, padding: 10, borderRadius: 10 }}>Who it&apos;s for: {sum.whoItsFor}</Text>
          </>
        )}
      </Card>
      <Card style={{ marginTop: 12, gap: 6 }}>
        <Text>📅 {when(e)}</Text>
        <Text>📍 {e.format === "virtual" ? "Online" : e.location} · {e.campus}</Text>
        {e.format !== "in-person" && <Text>💻 {e.format === "hybrid" ? "Hybrid — in person or online" : "Virtual"}</Text>}
        <Text>👥 {spots} of {e.capacity} spots left</Text>
        {!!e.goodies && <Text>🎁 {e.goodies}</Text>}
        {e.restrictions.length > 0 && <Text>🛡 {e.restrictions.join(" · ")}</Text>}
        {!!e.accessibilityNotes && <Text>♿ {e.accessibilityNotes}</Text>}
        {e.agenda.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontWeight: "700", color: C.muted, fontSize: 12 }}>AGENDA</Text>
            {e.agenda.map((a, i) => (
              <Text key={i} style={{ marginTop: 3 }}>
                <Text style={{ color: C.cardinal, fontWeight: "700" }}>{a.day ? `${a.day} ` : ""}{fmt12(a.time)}</Text> {a.title}
              </Text>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}
