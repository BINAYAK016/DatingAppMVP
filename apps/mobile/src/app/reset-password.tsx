import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { Button, Field, Header, Page, s } from "../components/ui";
export default function Reset() {
  const { request, toast } = useStore();
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  const act = async (reset: boolean) => {
    setBusy(true);
    try {
      await request(
        reset ? "/auth/reset" : "/auth/forgot",
        reset ? { email, code: code.trim(), password } : { email },
      );
      if (reset) {
        toast("Password updated. Sign in with your new password.");
        router.replace("/");
      } else {
        setSent(true);
        toast("If an account exists, a reset code has been sent.");
      }
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page>
      <Header back title="Find your way back" eyebrow="RESET PASSWORD" />
      <Field
        label="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Button
        secondary
        title={sent ? "Resend reset code" : "Send reset code"}
        disabled={busy}
        onPress={() => void act(false)}
      />
      <View style={{ height: 24 }} />
      <Field
        label="Reset code from your email"
        value={code}
        onChangeText={setCode}
      />
      <Field
        label="New password · at least 10 characters"
        secure
        value={password}
        onChangeText={setPassword}
      />
      <Button
        title="Update password"
        disabled={busy || !code || password.length < 10}
        onPress={() => void act(true)}
      />
      <Text style={[s.small, { marginTop: 20 }]}>
        Codes expire in 15 minutes and work once. Resetting your password signs
        out existing sessions.
      </Text>
    </Page>
  );
}
