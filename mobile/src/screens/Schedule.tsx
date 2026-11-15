import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { Nav } from "../../App";
import { api, type Block } from "../api";
import { C, DAYS, fmt12 } from "../theme";
import { Btn, Card, Chip, H1, Muted, s } from "../ui";

type Draft = { id?: string; kind: string; title: string; location: string; day: number; start: string; end: string };
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Classes are read-only (USC import). Students add/update/delete only their own busy time. */
export function ScheduleScreen({ nav }: { nav: Nav }) {
  const [blocks, setBlocks] = React.useState<Block[] | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const load = React.useCallback(async () => setBlocks((await api<{ blocks: Block[] }>(`/api/students/${nav.me.id}/schedule`)).blocks), [nav.me.id]);
  React.useEffect(() => {
    load().catch(() => {});
  }, [load]);
  const save = async () => {
    if (!draft) return;
    try {
      const { id, ...body } = draft;
      if (!/^\d{2}:\d{2}$/.test(body.start) || !/^\d{2}:\d{2}$/.test(body.end)) throw new Error("Use 24h times like 17:00");
      if (id) await api(`/api/schedule/${id}`, { method: "PATCH", body });
      else await api(`/api/students/${nav.me.id}/schedule`, { body });
      setDraft(null);
      load();
    } catch (e) {
      Alert.alert("Couldn't save", (e as Error).message);
    }
  };
  const del = (b: Block) =>
    Alert.alert("Delete?", b.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api(`/api/schedule/${b.id}`, { method: "DELETE" }); load(); } },
    ]);
  if (!blocks) return <ActivityIndicator color={C.cardinal} style={{ marginTop: 80 }} />;
  const classes = Array.from(new Map(blocks.filter((b) => !b.editable).map((b) => [b.title, b])).values());
  const mine = blocks.filter((b) => b.editable);
  const input = { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, backgroundColor: "#fff", marginBottom: 8 } as const;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={nav.back}><Text style={{ color: C.muted, marginBottom: 10 }}>‹ My Events</Text></Pressable>
      <H1>My schedule</H1>
      <Text style={{ fontWeight: "800", marginTop: 16, color: C.muted }}>🔒 CLASSES FROM USC (read-only)</Text>
      {classes.map((b) => (
        <Card key={b.title} style={{ marginTop: 8, padding: 12, backgroundColor: "#F1F5F9" }}>
          <Text style={{ fontWeight: "700" }}>{b.title}</Text>
          <Muted>{blocks.filter((x) => x.title === b.title).map((x) => DAYS[x.day]).join("/")} · {fmt12(b.start)}–{fmt12(b.end)} · {b.location}</Muted>
        </Card>
      ))}
      <View style={[s.row, { justifyContent: "space-between", marginTop: 20 }]}>
        <Text style={{ fontWeight: "800", color: C.muted }}>OTHER BUSY TIME</Text>
        <Btn title="+ Add" onPress={() => setDraft({ kind: "work", title: "", location: "", day: 1, start: "17:00", end: "20:00" })} style={{ height: 34 }} />
      </View>
      {mine.length === 0 && <Muted style={{ marginTop: 8 }}>Work on or off campus? Add it so events don&apos;t clash.</Muted>}
      {mine.map((b) => (
        <Card key={b.id} style={{ marginTop: 8, padding: 12 }}>
          <Pressable onPress={() => setDraft({ id: b.id, kind: b.kind, title: b.title, location: b.location, day: b.day, start: b.start, end: b.end })} onLongPress={() => del(b)}>
            <Text style={{ fontWeight: "700" }}>{b.kind === "work" ? "💼" : "🗓"} {b.title}</Text>
            <Muted>{DAYS[b.day]} {fmt12(b.start)}–{fmt12(b.end)}{b.location ? ` · ${b.location}` : ""} · tap to edit, hold to delete</Muted>
          </Pressable>
        </Card>
      ))}
      {draft && (
        <Card style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>{draft.id ? "Edit" : "Add"} busy time</Text>
          <View style={s.wrap}>
            {[["work", "Work"], ["personal", "Personal"], ["other", "Other"]].map(([k, l]) => <Chip key={k} label={l} active={draft.kind === k} onPress={() => setDraft({ ...draft, kind: k })} />)}
          </View>
          <TextInput style={input} placeholder="Name (e.g. Lyon Center desk)" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} />
          <TextInput style={input} placeholder="Where (optional)" value={draft.location} onChangeText={(t) => setDraft({ ...draft, location: t })} />
          <View style={s.wrap}>{ORDER.map((d) => <Chip key={d} label={DAYS[d]} active={draft.day === d} onPress={() => setDraft({ ...draft, day: d })} />)}</View>
          <View style={[s.row, { gap: 8 }]}>
            <TextInput style={[input, { flex: 1 }]} placeholder="Start 17:00" value={draft.start} onChangeText={(t) => setDraft({ ...draft, start: t })} />
            <TextInput style={[input, { flex: 1 }]} placeholder="End 20:00" value={draft.end} onChangeText={(t) => setDraft({ ...draft, end: t })} />
          </View>
          <View style={[s.row, { gap: 8 }]}>
            <Btn title="Cancel" kind="ghost" onPress={() => setDraft(null)} style={{ flex: 1 }} />
            <Btn title="Save" onPress={save} disabled={!draft.title.trim()} style={{ flex: 1 }} />
          </View>
        </Card>
      )}
    </ScrollView>
  );
}
