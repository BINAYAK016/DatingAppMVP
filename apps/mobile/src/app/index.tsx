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
  const [mode, setMode] = useState<"welcome" | "login" | "register">("welcome"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [accepted, setAccepted] = useState(false),
    [accounts, setAccounts] = useState<Person[]>([]),
    [settings, setSettings] = useState(false),
    [server, setServer] = useState(st.url);
  useEffect(() => {
    request<Person[]>("/auth/demo")
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [request]);
  if (!st.ready) return <Loading />;
  if (st.token && st.data) return <Redirect href="/(tabs)" />;
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
      <Banner
        title={"Good people.\nCloser connections."}
        body="Meet people. Build connections. Find your together."
        emoji="✺"
      />
      <View style={{ height: 25 }} />
      {mode === "welcome" ? (
        <>
          <Text style={s.h2}>Meet. Match. Make memories.</Text>
          <Text style={[s.body, { marginVertical: 12 }]}>
            Discover someone new. Share the everyday with your matches. Let the
            good conversations happen.
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
          {!!accounts.length && (
            <View style={[s.card, { marginTop: 25 }]}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text style={s.label}>EXPLORE THE LOCAL BETA</Text>
                <Text style={s.tag}>SAMPLE DATA</Text>
              </View>
              <Text style={[s.small, { marginVertical: 12 }]}>
                Try both sides of a match. These are fictional test accounts,
                not real people.
              </Text>
              {accounts.map((p) => (
                <Pressable
                  key={p.id}
                  disabled={st.loading}
                  onPress={() =>
                    st
                      .signIn("/auth/demo", { id: p.id })
                      .catch((e) => st.toast(e.message))
                  }
                  style={[s.row, { paddingVertical: 10 }]}
                >
                  <Avatar person={p} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>{p.name}</Text>
                    <Text style={s.small}>{p.city} · Demo account</Text>
                  </View>
                  <Text style={s.link}>Try →</Text>
                </Pressable>
              ))}
            </View>
          )}
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
                I am 18 or older and agree to the beta terms, privacy policy and
                community rules.
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
