import * as React from "react";
import { ActivityIndicator, Animated, Dimensions, Modal, PanResponder, Pressable, Text, View } from "react-native";
import type { Nav } from "../../App";
import { api, type Ranked } from "../api";
import { C, REASONS, when } from "../theme";
import { Badge, Btn, H1, MatchPill, Muted, s, Warn } from "../ui";

const W = Dimensions.get("window").width;
const THRESH = W * 0.28;

export function FeedScreen({ nav }: { nav: Nav }) {
  const [queue, setQueue] = React.useState<Ranked[] | null>(null);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [pendingLeft, setPendingLeft] = React.useState<Ranked | null>(null);
  const [pending, setPending] = React.useState<{ eventId: string; title: string }[]>([]);
  const pos = React.useRef(new Animated.ValueXY()).current;
  const shownAt = React.useRef(Date.now());

  const load = React.useCallback(async () => {
    const d = await api<{ events: Ranked[] }>(`/api/students/${nav.me.id}/feed`);
    setQueue(d.events);
  }, [nav.me.id]);
  React.useEffect(() => {
    load().catch(() => setQueue([]));
    api<{ pending: { eventId: string; title: string }[] }>(`/api/students/${nav.me.id}/pending-feedback`).then((d) => setPending(d.pending)).catch(() => {});
  }, [load, nav.me.id]);
  React.useEffect(() => {
    shownAt.current = Date.now();
  }, [queue?.[0]?.id]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const send = async (e: Ranked, direction: "left" | "right", reason: string | null, dwellMs: number) => {
    try {
      const r = await api<{ conflict: { note: string } | null; smarter: { sentence: string } | null }>("/api/swipes", {
        body: { studentId: nav.me.id, eventId: e.id, direction, reason, matchPct: e.matchPct, rankPos: e.rankPos, dwellMs, source: "feed" },
      });
      if (direction === "right") flash(r.conflict ? `Saved · ⚠ ${r.conflict.note}` : `Saved ${e.flyerHeadline || e.title}`);
      if (r.smarter) {
        setBanner(r.smarter.sentence);
        load();
      }
    } catch (err) {
      flash((err as Error).message);
    }
  };

  const fly = (dir: "left" | "right") => {
    const top = queue?.[0];
    if (!top) return;
    const dwell = Date.now() - shownAt.current;
    Animated.timing(pos, { toValue: { x: dir === "right" ? W * 1.5 : -W * 1.5, y: 0 }, duration: 220, useNativeDriver: false }).start(() => {
      pos.setValue({ x: 0, y: 0 });
      setQueue((q) => (q ? q.slice(1) : q));
      if (dir === "right") send(top, "right", null, dwell);
      else setPendingLeft({ ...top, rankPos: top.rankPos, matchPct: top.matchPct, dwellMs: dwell } as Ranked & { dwellMs: number });
    });
  };

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
        onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          if (g.dx > THRESH) fly("right");
          else if (g.dx < -THRESH) fly("left");
          else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue],
  );
  const rotate = pos.x.interpolate({ inputRange: [-W, 0, W], outputRange: ["-12deg", "0deg", "12deg"] });

  const top = queue?.[0];
  const second = queue?.[1];
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <H1>For you</H1>
      <Muted>Swipe right to save · left to pass · tap for details</Muted>
      {pending[0] && (
        <Pressable onPress={() => nav.go({ name: "feedback", id: pending[0].eventId })} style={{ marginTop: 10, backgroundColor: "#FFF6CC", borderColor: C.gold, borderWidth: 1, borderRadius: 14, padding: 12 }}>
          <Text style={{ fontWeight: "700" }}>How was {pending[0].title}? Rate it in 10 seconds →</Text>
        </Pressable>
      )}
      {banner && (
        <Pressable onPress={() => setBanner(null)} style={{ marginTop: 10, backgroundColor: C.cardinal, borderRadius: 14, padding: 12 }}>
          <Text style={{ color: C.gold, fontWeight: "800", fontSize: 11 }}>✨ YOUR FEED JUST GOT SMARTER</Text>
          <Text style={{ color: "#fff", marginTop: 2 }}>{banner}</Text>
        </Pressable>
      )}
      <View style={{ flex: 1, marginTop: 12 }}>
        {!queue && <ActivityIndicator color={C.cardinal} style={{ marginTop: 80 }} />}
        {queue && !top && (
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 18, fontWeight: "800" }}>You&apos;re all caught up 🎉</Text>
            <Btn title="Refresh" kind="outline" onPress={() => load()} style={{ marginTop: 12 }} />
          </View>
        )}
        {second && <CardFace e={second} style={{ transform: [{ scale: 0.95 }, { translateY: 12 }] }} />}
        {top && (
          <Animated.View {...responder.panHandlers} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }] }}>
            <Pressable style={{ flex: 1 }} onPress={() => nav.go({ name: "event", id: top.id })}>
              <CardFace e={top} />
            </Pressable>
          </Animated.View>
        )}
      </View>
      {top && (
        <View style={[s.row, { justifyContent: "center", gap: 28, marginTop: 12 }]}>
          <Pressable onPress={() => fly("left")} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "#FECACA", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
            <Text style={{ fontSize: 28, color: "#EF4444", fontWeight: "900" }}>✕</Text>
          </Pressable>
          <Pressable onPress={() => fly("right")} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.cardinal, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 28, color: "#fff" }}>♥</Text>
          </Pressable>
        </View>
      )}
      {toast && (
        <View style={{ position: "absolute", top: 12, left: 16, right: 16, backgroundColor: C.text, borderRadius: 12, padding: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>{toast}</Text>
        </View>
      )}
      <Modal visible={!!pendingLeft} transparent animationType="slide" onRequestClose={() => setPendingLeft(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => { if (pendingLeft) send(pendingLeft, "left", null, (pendingLeft as any).dwellMs ?? 0); setPendingLeft(null); }} />
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 4 }}>Why pass?</Text>
          <Muted style={{ marginBottom: 12 }}>One tap helps {pendingLeft?.org?.name ?? "the org"} plan better.</Muted>
          <View style={s.wrap}>
            {REASONS.map(([k, l]) => (
              <Pressable
                key={k}
                onPress={() => {
                  if (pendingLeft) send(pendingLeft, "left", k, (pendingLeft as any).dwellMs ?? 0);
                  setPendingLeft(null);
                }}
                style={{ width: "48%", marginRight: "2%", marginBottom: 8, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 }}
              >
                <Text style={{ fontWeight: "700" }}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CardFace({ e, style }: { e: Ranked; style?: any }) {
  return (
    <View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: C.border, elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16 }, style]}>
      <View style={{ height: "42%", backgroundColor: e.flyerColor || C.cardinal, padding: 18, justifyContent: "space-between" }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Badge label={e.eventType} bg="rgba(255,255,255,0.22)" fg="#fff" />
          <MatchPill pct={e.matchPct} />
        </View>
        <View>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 11, textTransform: "uppercase" }}>{e.org?.name}</Text>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 24 }}>{e.flyerHeadline || e.title}</Text>
          {!!e.flyerTagline && <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 2 }}>{e.flyerTagline}</Text>}
        </View>
      </View>
      <View style={{ padding: 16, flex: 1 }}>
        <View style={{ backgroundColor: "#FDF2F2", borderRadius: 10, padding: 8, marginBottom: 8 }}>
          <Text style={{ color: C.cardinal, fontSize: 12, fontWeight: "600" }}>✨ {e.why}</Text>
        </View>
        <Text numberOfLines={3} style={{ color: C.text, lineHeight: 20 }}>{e.cardBlurb || e.description}</Text>
        <Muted style={{ marginTop: 8 }}>📅 {when(e)}</Muted>
        <Muted>📍 {e.format === "virtual" ? "Online" : e.location}{e.campus && e.campus !== "UPC" ? ` · ${e.campus}` : ""}</Muted>
        <View style={[s.wrap, { marginTop: 8 }]}>
          {e.foodType === "free" && <Badge label="🍕 Free food" bg={C.gold} />}
          <Badge label={e.ticketCost > 0 ? `$${e.ticketCost}` : "Free"} bg="#D1FAE5" fg={C.green} />
        </View>
        {e.conflicts[0] && <Warn>{e.conflicts[0].kind === "class" ? "Clashes with class " : "Clashes with "}{e.conflicts[0].title}</Warn>}
        {e.friendsGoing.length > 0 && <Muted style={{ marginTop: 6 }}>👥 {e.friendsGoing[0].name.split(" ")[0]}{e.friendsGoing.length > 1 ? ` + ${e.friendsGoing.length - 1}` : ""} interested</Muted>}
      </View>
    </View>
  );
}
