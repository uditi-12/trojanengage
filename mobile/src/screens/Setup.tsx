import * as React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import type { Nav } from "../../App";
import { api, type Block } from "../api";
import { C, DAYS, fmt12, GOALS, INTERESTS } from "../theme";
import { Btn, Card, Chip, H1, Muted, s } from "../ui";

export function SetupScreen({ nav }: { nav: Nav }) {
  const [step, setStep] = React.useState(0);
  const [interests, setInterests] = React.useState<string[]>([]);
  const [goals, setGoals] = React.useState<string[]>([]);
  const [blocks, setBlocks] = React.useState<Block[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    api<{ blocks: Block[] }>(`/api/students/${nav.me.id}/schedule`).then((d) => setBlocks(d.blocks)).catch(() => setBlocks([]));
  }, [nav.me.id]);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const finish = async () => {
    setBusy(true);
    try {
      await api(`/api/students/${nav.me.id}/setup`, { body: { interests, goals } });
      await nav.refreshMe();
    } catch (e) {
      Alert.alert("Couldn't save", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const classes = Array.from(new Map((blocks ?? []).filter((b) => b.kind === "class").map((b) => [b.title, b])).values());
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Muted>Step {step + 1} of 3</Muted>
      <View style={{ height: 6, backgroundColor: C.soft, borderRadius: 3, marginVertical: 10 }}>
        <View style={{ height: 6, width: `${((step + 1) / 3) * 100}%`, backgroundColor: C.cardinal, borderRadius: 3 }} />
      </View>
      {step === 0 && (
        <>
          <H1>What are you into?</H1>
          <Muted style={{ marginBottom: 16 }}>Pick a few — this seeds your feed.</Muted>
          <View style={s.wrap}>{INTERESTS.map(([k, l]) => <Chip key={k} label={l} active={interests.includes(k)} onPress={() => toggle(interests, setInterests, k)} />)}</View>
        </>
      )}
      {step === 1 && (
        <>
          <H1>What do you want from events?</H1>
          <View style={[s.wrap, { marginTop: 16 }]}>{GOALS.map(([k, l]) => <Chip key={k} label={l} active={goals.includes(k)} onPress={() => toggle(goals, setGoals, k)} />)}</View>
        </>
      )}
      {step === 2 && (
        <>
          <H1>Your USC schedule is in</H1>
          <Muted style={{ marginBottom: 12 }}>Imported from your USC registration. Events are ranked around your classes.</Muted>
          {classes.map((b) => (
            <Card key={b.title} style={{ marginBottom: 8, padding: 12, backgroundColor: "#F1F5F9" }}>
              <Text style={{ fontWeight: "700" }}>🔒 {b.title}</Text>
              <Muted>
                {(blocks ?? []).filter((x) => x.title === b.title).map((x) => DAYS[x.day]).join("/")} · {fmt12(b.start)}–{fmt12(b.end)} · {b.location}
              </Muted>
            </Card>
          ))}
          <Muted style={{ marginTop: 8 }}>Add work shifts later under My Events → Schedule.</Muted>
        </>
      )}
      <View style={[s.row, { marginTop: 24, gap: 10 }]}>
        {step > 0 && <Btn title="Back" kind="outline" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
        <Btn
          title={step < 2 ? "Next" : "Build my feed"}
          onPress={() => (step < 2 ? setStep(step + 1) : finish())}
          disabled={(step === 0 && !interests.length) || (step === 1 && !goals.length)}
          loading={busy}
          style={{ flex: 2 }}
        />
      </View>
    </ScrollView>
  );
}
