import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Linking,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { GoogleAuth } from "../components/GoogleAuth";
import { DemoConfigRecovery } from "../components/DemoConnection";
import { authMessage } from "../lib/authMessage";
import { useStore } from "../lib/store";
import { connectionSettingsEnabled } from "../lib/connection";
import {
  BottomSheet,
  Button,
  Field,
  Icon,
  IconButton,
  Loading,
  Page,
  s,
  C,
  T,
} from "../components/ui";

function Brand() {
  return (
    <View style={styles.brand}>
      <Text style={styles.wordmark}>sangai</Text>
      <View style={styles.brandSymbol}>
        <Icon name="heart-outline" size={19} color={C.primary} />
      </View>
    </View>
  );
}
export default function Welcome() {
  const { account } = useLocalSearchParams<{ account?: string }>();
  const compact = useWindowDimensions().height < 740;
  const st = useStore();
  const [mode, setMode] = useState<"welcome" | "login" | "register">("welcome"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [accepted, setAccepted] = useState(false),
    [settings, setSettings] = useState(false),
    [server, setServer] = useState(st.url);
  const [formError, setFormError] = useState("");
  const previousToken = useRef(st.token);
  useEffect(() => {
    const signedOut = !!previousToken.current && !st.token;
    previousToken.current = st.token;
    if (!signedOut) return;
    const reset = setTimeout(() => {
      setMode("welcome");
      setEmail("");
      setPassword("");
      setAccepted(false);
      setFormError("");
      setSettings(false);
    }, 0);
    return () => clearTimeout(reset);
  }, [st.token]);
  if (!st.ready || st.bootstrapError) return <Loading />;
  if (st.token && st.data) return <Redirect href="/(tabs)" />;
  if (st.token) return <Loading />;
  if (st.demoMode === null) return <DemoConfigRecovery />;
  if (st.demoMode && account !== "1") return <Redirect href="/demo" />;
  const submit = async () => {
    setFormError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setFormError("Enter a valid email address.");
    if (!password || (mode === "register" && password.length < 10))
      return setFormError(
        mode === "register"
          ? "Use a password with at least 10 characters."
          : "Enter your password.",
      );
    if (mode === "register" && !accepted)
      return setFormError(
        "Confirm you’re 18 or older and accept the beta policies to continue.",
      );
    try {
      await st.signIn(
        "/auth/" + mode,
        mode === "register"
          ? { email: email.trim(), password, acceptedPolicies: accepted }
          : { email: email.trim(), password },
      );
    } catch (e: any) {
      setFormError(authMessage(e));
    }
  };
  const back = () => setMode("welcome");
  return (
    <>
      <Page>
        <View
          style={[
            styles.topbar,
            compact && { paddingVertical: 0, marginBottom: 12 },
          ]}
        >
          {mode !== "welcome" && (
            <IconButton name="arrow-back" label="Back" onPress={back} />
          )}
          <Brand />
        </View>
        {mode === "welcome" ? (
          <>
            <View
              style={[
                styles.connectionArt,
                compact && { height: 56, marginBottom: 16 },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View
                style={[
                  styles.connectionCircle,
                  styles.circleLeft,
                  compact && { width: 56, height: 56, borderRadius: 28 },
                ]}
              />
              <View
                style={[
                  styles.connectionCircle,
                  styles.circleRight,
                  compact && { width: 56, height: 56, borderRadius: 28 },
                ]}
              />
              <View
                style={[
                  styles.connectionHeart,
                  compact && { width: 44, height: 44, borderRadius: 22 },
                ]}
              >
                <Icon
                  name="heart-outline"
                  size={compact ? 32 : 44}
                  color={C.primary}
                />
              </View>
            </View>
            <Text style={styles.eyebrow}>ROOM FOR A REAL CONNECTION</Text>
            <Text accessibilityRole="header" style={styles.display}>
              Meet people.{"\n"}Find your together.
            </Text>
            <Text
              style={[
                s.body,
                styles.welcomeBody,
                compact && { marginTop: 12, marginBottom: 20 },
              ]}
            >
              {compact
                ? "Find people who get you. Share the everyday."
                : "A new connection. A good conversation. A little closer to someone who gets you."}
            </Text>
            <View style={styles.actionStack}>
              <GoogleAuth />
              <Button
                title="Continue with email"
                onPress={() => setMode("register")}
                icon="mail-outline"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="I already have an account"
                onPress={() => setMode("login")}
                style={styles.textAction}
              >
                <Text style={s.body}>
                  Already a member? <Text style={s.link}>Log in</Text>
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text
              accessibilityRole="header"
              style={[s.title, styles.formTitle]}
            >
              {mode === "register" ? "Make yourself at home" : "Welcome back"}
            </Text>
            <Text style={[s.body, { marginBottom: 16 }]}>
              {mode === "register"
                ? "Your next connection starts with you."
                : "A good conversation could be waiting."}
            </Text>
            <GoogleAuth />
            <Text
              style={[s.small, { textAlign: "center", marginVertical: 16 }]}
            >
              or continue with email
            </Text>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Field
              label="Password · at least 10 characters"
              value={password}
              onChangeText={setPassword}
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              returnKeyType="go"
              onSubmitEditing={() => {
                if (!st.loading) void submit();
              }}
              secure
              placeholder="Your password"
            />
            {mode === "register" && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="I am 18 or older and agree to the beta terms, privacy policy and community rules."
                accessibilityState={{ checked: accepted }}
                aria-checked={accepted}
                onPress={() => setAccepted(!accepted)}
                style={styles.policyRow}
              >
                <Icon
                  name={accepted ? "checkbox" : "square-outline"}
                  color={accepted ? C.primary : C.muted}
                  size={24}
                />
                <Text style={[s.small, { flex: 1 }]}>
                  I am 18 or older and agree to the beta terms, privacy policy
                  and community rules.
                </Text>
              </Pressable>
            )}
            {mode === "login" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/reset-password")}
                style={[
                  styles.textAction,
                  { alignItems: "flex-end", paddingTop: 0 },
                ]}
              >
                <Text style={s.link}>Forgot password?</Text>
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
              loading={st.loading}
              disabled={st.loading}
              onPress={() => void submit()}
            />
            {!!formError && (
              <Text
                accessibilityRole="alert"
                style={[s.small, { color: C.red, marginTop: 12 }]}
              >
                {formError}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setMode(mode === "register" ? "login" : "register")
              }
              style={styles.textAction}
            >
              <Text style={s.body}>
                {mode === "register" ? "Already a member? " : "New to Sangai? "}
                <Text style={s.link}>
                  {mode === "register" ? "Log in" : "Create an account"}
                </Text>
              </Text>
            </Pressable>
          </>
        )}
        <View style={styles.footer}>
          {st.demoMode && (
            <Button
              title="Explore demo accounts"
              secondary
              onPress={() => router.replace("/demo")}
            />
          )}
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(st.url + "/policies")}
            style={styles.footerLink}
          >
            <Text style={[s.small, { textAlign: "center" }]}>
              Privacy, safety & beta terms
            </Text>
          </Pressable>
          {connectionSettingsEnabled && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setServer(st.url);
                setSettings(!settings);
              }}
              style={styles.footerLink}
            >
              <Text style={[s.small, { textAlign: "center" }]}>
                Local beta · Connection settings
              </Text>
            </Pressable>
          )}
        </View>
      </Page>
      <BottomSheet
        visible={settings}
        onClose={() => setSettings(false)}
        title="Connection settings"
      >
        <Text style={[s.body, { marginBottom: 20 }]}>
          Connect this local beta to your running Sangai server.
        </Text>
        <Field label="Backend URL" value={server} onChangeText={setServer} />
        <Button
          title="Save & reconnect"
          onPress={() => {
            st.setUrl(server);
            setSettings(false);
            st.toast("Server address updated.");
          }}
        />
        <Text style={[s.small, { marginTop: 20 }]}>
          Android emulator: http://10.0.2.2:4100{"\n"}iOS Simulator:
          http://localhost:4100
        </Text>
      </BottomSheet>
    </>
  );
}
const styles = StyleSheet.create({
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: {
    fontSize: 30,
    fontWeight: "600",
    color: C.ink,
    letterSpacing: -1.2,
  },
  brandSymbol: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionArt: {
    height: 136,
    backgroundColor: C.peach,
    borderRadius: 28,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  connectionCircle: {
    position: "absolute",
    width: 94,
    height: 108,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  circleLeft: {
    backgroundColor: C.blush,
    transform: [{ translateX: -38 }, { rotate: "-12deg" }],
  },
  circleRight: {
    backgroundColor: C.lavender,
    transform: [{ translateX: 38 }, { rotate: "12deg" }],
  },
  connectionHeart: {
    width: 64,
    height: 64,
    borderRadius: 40,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: C.brandTextOnTint,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1.6,
    fontWeight: "700",
    marginBottom: 12,
  },
  display: {
    fontFamily: T.font.editorial,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "400",
    color: C.ink,
    letterSpacing: -1.2,
  },
  welcomeBody: {
    marginTop: 16,
    marginBottom: 28,
    maxWidth: 460,
    color: C.muted,
  },
  actionStack: { gap: 12 },
  textAction: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
  },
  demoEntry: { marginTop: 24, gap: 8 },
  inlineDemo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.blush,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
    marginBottom: 24,
  },
  centerCaption: {
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
  },
  formTitle: { marginTop: 12, marginBottom: 12 },
  policyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    marginBottom: 16,
    minHeight: 48,
  },
  demoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  demoError: { gap: 16, paddingVertical: 24 },
  footer: { marginTop: 24 },
  footerLink: { minHeight: 44, justifyContent: "center" },
});
