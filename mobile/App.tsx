import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api, loadToken, saveToken, type Me } from "./src/api";
import { C } from "./src/theme";
import { LoginScreen } from "./src/screens/Login";
import { SetupScreen } from "./src/screens/Setup";
import { FeedScreen } from "./src/screens/Feed";
import { EventScreen } from "./src/screens/Event";
import { EventsScreen } from "./src/screens/Events";
import { ScheduleScreen } from "./src/screens/Schedule";
import { FeedbackScreen } from "./src/screens/Feedback";
import { ProfileScreen } from "./src/screens/Profile";

export type Route = { name: "feed" } | { name: "events" } | { name: "profile" } | { name: "event"; id: string } | { name: "feedback"; id: string } | { name: "schedule" };
export type Nav = { go: (r: Route) => void; back: () => void; me: Me; refreshMe: () => Promise<void>; logout: () => Promise<void> };

const TABS: { name: "feed" | "events" | "profile"; label: string; icon: string }[] = [
  { name: "feed", label: "Feed", icon: "🔥" },
  { name: "events", label: "My Events", icon: "📅" },
  { name: "profile", label: "Profile", icon: "👤" },
];

export default function App() {
  const [booting, setBooting] = React.useState(true);
  const [me, setMe] = React.useState<Me | null>(null);
  const [stack, setStack] = React.useState<Route[]>([{ name: "feed" }]);

  const refreshMe = React.useCallback(async () => {
    const d = await api<{ session: { role: string } | null; current: Me | null }>("/api/session");
    setMe(d.session?.role === "student" ? d.current : null);
  }, []);

  // Stay signed in: the token lives in the device keychain, so reopening the app skips login.
  React.useEffect(() => {
    (async () => {
      try {
        if (await loadToken()) await refreshMe();
      } catch {
        await saveToken(null);
      } finally {
        setBooting(false);
      }
    })();
  }, [refreshMe]);

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    await saveToken(null);
    setMe(null);
    setStack([{ name: "feed" }]);
  };

  if (booting)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.cardinal }}>
        <Text style={{ color: C.gold, fontSize: 34, fontWeight: "900" }}>TrojanEngage</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
      </View>
    );

  const route = stack[stack.length - 1];
  const nav: Nav | null = me
    ? {
        me,
        refreshMe,
        logout,
        go: (r) => setStack((st) => (r.name === "feed" || r.name === "events" || r.name === "profile" ? [r] : [...st, r])),
        back: () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)),
      }
    : null;
  const isTab = route.name === "feed" || route.name === "events" || route.name === "profile";

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "left", "right"]}>
        {!me || !nav ? (
          <LoginScreen
            onLoggedIn={async (token) => {
              await saveToken(token);
              await refreshMe();
            }}
          />
        ) : !me.onboarded ? (
          <SetupScreen nav={nav} />
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              {route.name === "feed" && <FeedScreen nav={nav} />}
              {route.name === "events" && <EventsScreen nav={nav} />}
              {route.name === "profile" && <ProfileScreen nav={nav} />}
              {route.name === "event" && <EventScreen nav={nav} id={route.id} />}
              {route.name === "feedback" && <FeedbackScreen nav={nav} id={route.id} />}
              {route.name === "schedule" && <ScheduleScreen nav={nav} />}
            </View>
            {isTab && (
              <SafeAreaView edges={["bottom"]} style={{ flexDirection: "row", borderTopWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
                {TABS.map((t) => (
                  <Pressable key={t.name} onPress={() => nav.go({ name: t.name })} style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
                    <Text style={{ fontSize: 20 }}>{t.icon}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: route.name === t.name ? C.cardinal : C.muted }}>{t.label}</Text>
                  </Pressable>
                ))}
              </SafeAreaView>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
