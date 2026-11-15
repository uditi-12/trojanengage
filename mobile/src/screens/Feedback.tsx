import * as React from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { Nav } from "../../App";
import { api } from "../api";
import { C, FEEDBACK } from "../theme";
import { Btn, Card, Chip, Muted, s } from "../ui";

export function FeedbackScreen({ nav, id }: { nav: Nav; id: string }) {
  const [rating, setRating] = React.useState(0);
  const [tags, setTags] = React.useState<string[]>([]);
  const [comment, setComment] = React.useState("");
  const [eligible, setEligible] = React.useState<{ ok: boolean; reason?: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    api<{ ok: boolean; reason?: string }>(`/api/feedback/eligibility?eventId=${id}`).then(setEligible).catch((e) => setEligible({ ok: false, reason: (e as Error).message }));
  }, [id]);
  const toggle = (t: string) => setTags((c) => (c.includes(t) ? c.filter((x) => x !== t) : c.length >= 4 ? c : [...c, t]));
  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/feedback", { body: { eventId: id, rating, tags, comment: comment.trim() || null } });
      setDone(true);
    } catch (e) {
      Alert.alert("Couldn't send", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (done)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 48 }}>🎉</Text>
        <Text style={{ fontSize: 20, fontWeight: "900", marginTop: 10, textAlign: "center" }}>Thanks! That makes the next one better.</Text>
        <Btn title="Back to feed" onPress={() => nav.go({ name: "feed" })} style={{ marginTop: 20, alignSelf: "stretch" }} />
      </View>
    );
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Pressable onPress={nav.back}><Text style={{ color: C.muted, marginBottom: 10 }}>‹ Back</Text></Pressable>
      {eligible && !eligible.ok ? (
        <Card>
          <Text style={{ fontWeight: "800", fontSize: 18 }}>🔒 Feedback is for attendees</Text>
          <Muted style={{ marginTop: 6 }}>{eligible.reason}</Muted>
        </Card>
      ) : (
        <Card>
          <Text style={{ color: C.cardinal, fontWeight: "800", fontSize: 11 }}>10-SECOND FEEDBACK · ✓ VERIFIED ATTENDEE</Text>
          <Text style={{ fontSize: 20, fontWeight: "900", marginTop: 4 }}>How was it?</Text>
          <View style={[s.row, { justifyContent: "center", marginVertical: 16 }]}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Text style={{ fontSize: 38, color: n <= rating ? C.gold : "#D1D5DB" }}>★</Text>
              </Pressable>
            ))}
          </View>
          <Muted style={{ marginBottom: 8 }}>Pick all that apply (up to 4)</Muted>
          <View style={s.wrap}>{FEEDBACK.map(([k, l]) => <Chip key={k} label={l} active={tags.includes(k)} onPress={() => toggle(k)} />)}</View>
          <TextInput placeholder="One line (optional)" value={comment} onChangeText={setComment} maxLength={200} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, marginTop: 8 }} />
          <Btn title="Submit" onPress={submit} disabled={!rating || !tags.length} loading={busy} style={{ marginTop: 14 }} />
        </Card>
      )}
    </ScrollView>
  );
}
