import * as React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api, API_URL } from "../api";
import { C } from "../theme";
import { Btn, Card, Muted, s } from "../ui";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (token: string) => Promise<void> }) {
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [major, setMajor] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const d =
        mode === "login"
          ? await api<{ token: string }>("/api/auth/login", { body: { email, password, remember: true } })
          : await api<{ token: string }>("/api/auth/signup", { body: { name, email, password, major, year: "Freshman" } });
      await onLoggedIn(d.token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const input = { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: "#fff", marginBottom: 10 } as const;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 34, fontWeight: "900", color: C.cardinal }}>TrojanEngage<Text style={{ color: C.gold }}>.</Text></Text>
        <Muted style={{ marginBottom: 24, fontSize: 15 }}>Every USC event, ranked for you. Log in with your USC email — your class schedule comes with it.</Muted>
        <Card>
          <View style={[s.row, { backgroundColor: C.soft, borderRadius: 12, padding: 4, marginBottom: 16 }]}>
            {(["login", "signup"] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: mode === m ? "#fff" : "transparent", alignItems: "center" }}>
                <Text style={{ fontWeight: "700", color: mode === m ? C.text : C.muted }}>{m === "login" ? "Log in" : "Sign up"}</Text>
              </Pressable>
            ))}
          </View>
          {mode === "signup" && <TextInput style={input} placeholder="Full name" value={name} onChangeText={setName} />}
          <TextInput style={input} placeholder="you@usc.edu" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          {mode === "signup" && <TextInput style={input} placeholder="Major" value={major} onChangeText={setMajor} />}
          {error && <Text style={{ color: "#B91C1C", marginBottom: 10, fontWeight: "600" }}>{error}</Text>}
          <Btn title={mode === "login" ? "Log in" : "Create account"} onPress={submit} loading={busy} />
          {mode === "login" && (
            <Pressable
              onPress={() => {
                setEmail("alex@usc.edu");
                setPassword("trojan123");
              }}
              style={{ marginTop: 14 }}
            >
              <Muted>Demo: tap to fill alex@usc.edu / trojan123</Muted>
            </Pressable>
          )}
        </Card>
        <Muted style={{ marginTop: 16, fontSize: 11 }}>Server: {API_URL}</Muted>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
