import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { Redirect, router } from "expo-router";
import { GoogleAuth } from "../components/GoogleAuth";
import { useStore } from "../lib/store";
import { Person } from "../lib/types";
import {
  Avatar,
  Banner,
  Button,
  Field,
  Loading,
  Page,
  s,
  C,
} from "../components/ui";
export default function Welcome() {
  const st = useStore();
  const { request } = st;
  const [mode, setMode] = useState<"welcome" | "login" | "register" | "demo">(
      "welcome",
    ),
    [demoReturnMode, setDemoReturnMode] = useState<
      "welcome" | "login" | "register"
    >("welcome"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [accepted, setAccepted] = useState(false),
    [accounts, setAccounts] = useState<Person[]>([]),
    [accountsLoading, setAccountsLoading] = useState(true),
    [accountsError, setAccountsError] = useState(""),
    [demoRetry, setDemoRetry] = useState(0),
    [settings, setSettings] = useState(false),
    [server, setServer] = useState(st.url);
  useEffect(() => {
    if (!st.ready) return;
    let active = true;
    request<Person[]>("/auth/demo")
      .then((result) => {
        if (active) setAccounts(result);
      })
      .catch((error: Error) => {
        if (active) {
          setAccounts([]);
          setAccountsError(error.message);
        }
      })
      .finally(() => {
        if (active) setAccountsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, st.ready, demoRetry]);
  if (!st.ready) return <Loading />;
  if (st.token && st.data) return <Redirect href="/(tabs)" />;
  const openDemo = () => {
    if (mode !== "demo") setDemoReturnMode(mode);
    setMode("demo");
    if (!accounts.length) {
      setAccountsLoading(true);
      setAccountsError("");
      setDemoRetry((value) => value + 1);
    }
  };
  const submit = async () => {
    try {
      await st.signIn(
        "/auth/" + mode,
        mode === "register"
          ? {
              email,
              password,
              acceptedPolicies: accepted,
            }
          : { email, password },
      );
    } catch (e: any) {
      st.toast(e.message);
    }
  };
  return (
    <Page>
      <View style={{ paddingTop: 25, paddingBottom: 28 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: C.primary }}>
          sangai<Text style={{ color: "#A84D69" }}> ✳</Text>
        </Text>
        <Text style={[s.eyebrow, { marginTop: 10 }]}>TOGETHER STARTS HERE</Text>
      </View>
      {mode === "demo" ? (
        <View style={s.card}>
          <Text style={[s.h2, { marginBottom: 10 }]}>
            Choose a demo account
          </Text>
          <Text style={[s.small, { marginBottom: 18 }]}>
            Explore with fictional people and sample data. No signup needed.
          </Text>
          {accountsLoading ? (
            <Text style={s.small}>Loading demo accounts…</Text>
          ) : accounts.length ? (
            accounts.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`Try ${p.name} demo account`}
                disabled={st.loading}
                onPress={() =>
                  st
                    .signIn("/auth/demo", { id: p.id })
                    .catch((error) => st.toast(error.message))
                }
                style={[s.row, { paddingVertical: 12 }]}
              >
                <Avatar person={p} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{p.name}</Text>
                  <Text style={s.small}>{p.city} · Fictional demo</Text>
                </View>
                <Text style={s.link}>Try →</Text>
              </Pressable>
            ))
          ) : (
            <>
              <Text style={[s.small, { marginBottom: 16 }]}>
                {accountsError ||
                  "Demo accounts are unavailable on this server."}
              </Text>
              <Button
                title="Retry loading demos"
                onPress={() => {
                  setAccountsLoading(true);
                  setAccountsError("");
                  setDemoRetry((value) => value + 1);
                }}
              />
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ paddingTop: 20 }}
            onPress={() => setMode(demoReturnMode)}
          >
            <Text style={s.link}>← Back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Banner
            title={"Good people.\nCloser connections."}
            body="Meet people. Build connections. Find your together."
            emoji="✺"
          />
          <View style={{ height: 25 }} />
          <Button title="Explore demo accounts" onPress={openDemo} secondary />
          <Text style={[s.small, { marginTop: 10, textAlign: "center" }]}>
            Fictional profiles · No signup needed
          </Text>
          <View style={{ height: 20 }} />
          {mode === "welcome" ? (
            <>
              <Text style={s.h2}>Meet. Match. Make memories.</Text>
              <Text style={[s.body, { marginVertical: 12 }]}>
                Discover someone new. Share the everyday with your matches. Let
                the good conversations happen.
              </Text>
              <GoogleAuth />
              <Button
                title="Continue with email"
                onPress={() => setMode("register")}
                icon="arrow-forward"
              />
              <View style={{ height: 10 }} />
              <Button
                title="I already have an account"
                onPress={() => setMode("login")}
                secondary
              />
            </>
          ) : (
            <View style={s.card}>
              <Text style={[s.h2, { marginBottom: 18 }]}>
                {mode === "register" ? "Make yourself at home" : "Welcome back"}
              </Text>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <Field
                label="Password · at least 10 characters"
                value={password}
                onChangeText={setPassword}
                secure
              />
              {mode === "register" && (
                <Pressable
                  onPress={() => setAccepted(!accepted)}
                  style={[s.row, { marginBottom: 18 }]}
                >
                  <Text style={{ fontSize: 22, color: C.primary }}>
                    {accepted ? "☑" : "☐"}
                  </Text>
                  <Text style={[s.small, { flex: 1 }]}>
                    I am 18 or older and agree to the beta terms, privacy policy
                    and community rules.
                  </Text>
                </Pressable>
              )}
              <Button
                title={
                  st.loading
                    ? "Signing in…"
                    : mode === "register"
                      ? "Create account"
                      : "Sign in"
                }
                disabled={st.loading}
                onPress={() => void submit()}
              />
              {mode === "login" && (
                <Pressable
                  style={{ paddingTop: 16 }}
                  onPress={() => router.push("/reset-password")}
                >
                  <Text style={s.link}>Forgot password?</Text>
                </Pressable>
              )}
              <Pressable
                style={{ paddingTop: 16 }}
                onPress={() => setMode("welcome")}
              >
                <Text style={s.link}>← Back</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      <View style={{ marginTop: 18, gap: 15 }}>
        <Pressable onPress={() => void Linking.openURL(st.url + "/policies")}>
          <Text style={[s.small, { textAlign: "center" }]}>
            Privacy, safety & beta terms
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setServer(st.url);
            setSettings(!settings);
          }}
        >
          <Text style={[s.small, { textAlign: "center" }]}>
            Local beta · Connection settings
          </Text>
        </Pressable>
        {settings && (
          <View style={s.card}>
            <Field
              label="Backend URL"
              value={server}
              onChangeText={setServer}
            />
            <Button
              title="Save & reconnect"
              onPress={() => {
                st.setUrl(server);
                setSettings(false);
                st.toast("Server address updated.");
              }}
            />
            <Text style={[s.small, { marginTop: 12 }]}>
              Android emulator: http://10.0.2.2:4100{"\n"}iOS Simulator:
              http://localhost:4100
            </Text>
          </View>
        )}
      </View>
    </Page>
  );
}
