import * as React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import type { Nav } from "../../App";
import { api } from "../api";
import { C } from "../theme";
import { Btn, Card, H1, Muted } from "../ui";

type Profile = { sentence: string; swipeCount: number; topTags: { tag: string; label: string; weight: number }[] };

export function ProfileScreen({ nav }: { nav: Nav }) {
  const [p, setP] = React.useState<Profile | null>(null);
  React.useEffect(() => {
    api<Profile>(`/api/students/${nav.me.id}/profile`).then(setP).catch(() => {});
  }, [nav.me.id]);
  const max = Math.max(1, ...(p?.topTags.map((t) => t.weight) ?? [1]));
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <H1>{nav.me.name}</H1>
      <Muted>{nav.me.major} · {nav.me.year}</Muted>
      <View style={{ backgroundColor: C.cardinal, borderRadius: 20, padding: 16, marginTop: 14 }}>
        <Text style={{ color: C.gold, fontWeight: "800", fontSize: 11 }}>✨ YOUR TASTE, IN ONE LINE</Text>
        {!p ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 6 }}>{p.sentence || "Swipe a few events and we'll describe your taste."}</Text>}
        {p && <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6, fontSize: 12 }}>{p.swipeCount} swipes</Text>}
      </View>
      <Card style={{ marginTop: 14 }}>
        <Text style={{ fontWeight: "800", marginBottom: 10 }}>Top tags</Text>
        {p?.topTags.map((t, i) => (
          <View key={t.tag} style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "600" }}>{t.label}</Text>
            <View style={{ height: 8, backgroundColor: C.soft, borderRadius: 4, marginTop: 3 }}>
              <View style={{ height: 8, width: `${(t.weight / max) * 100}%`, backgroundColor: i < 3 ? C.cardinal : C.gold, borderRadius: 4 }} />
            </View>
          </View>
        ))}
      </Card>
      <Btn title="My schedule" kind="outline" onPress={() => nav.go({ name: "schedule" })} style={{ marginTop: 14 }} />
      <Btn title="Log out" kind="ghost" onPress={nav.logout} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}
