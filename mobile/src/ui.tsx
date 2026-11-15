import * as React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { C } from "./theme";

export function Btn({ title, onPress, kind = "primary", loading, disabled, style }: { title: string; onPress: () => void; kind?: "primary" | "outline" | "gold" | "ghost"; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = kind === "primary" ? C.cardinal : kind === "gold" ? C.gold : kind === "outline" ? C.card : "transparent";
  const fg = kind === "primary" ? "#fff" : kind === "gold" ? "#111" : C.cardinal;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderWidth: kind === "outline" ? 1 : 0, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: C.cardinal, borderColor: C.cardinal }]}>
      <Text style={[s.chipText, active && { color: "#fff" }]}>{active ? "✓ " : ""}{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Badge({ label, bg = C.soft, fg = C.text }: { label: string; bg?: string; fg?: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function MatchPill({ pct }: { pct: number }) {
  const bg = pct >= 75 ? "#10B981" : pct >= 50 ? C.gold : "rgba(255,255,255,0.3)";
  return <Badge label={`${pct}% match`} bg={bg} fg={pct >= 50 && pct < 75 ? "#111" : "#fff"} />;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={s.h1}>{children}</Text>;
}
export function Muted({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}
export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.warn}>
      <Text style={s.warnText}>⚠ {children}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  btn: { height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderColor: C.border },
  btnText: { fontWeight: "700", fontSize: 15 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.card, marginRight: 8, marginBottom: 8 },
  chipText: { fontWeight: "600", color: C.text, fontSize: 14 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginRight: 6, marginBottom: 6, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  h1: { fontSize: 26, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  muted: { color: C.muted, fontSize: 13 },
  warn: { backgroundColor: C.amberBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 },
  warnText: { color: C.amber, fontSize: 12, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
});
