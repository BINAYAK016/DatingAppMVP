import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import {
  Button,
  C,
  Field,
  Header,
  Icon,
  Page,
  StepProgress,
  s,
} from "../components/ui";
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
    <Page
      footer={
        <Button
          title={
            busy ? "Please wait…" : sent ? "Update password" : "Send reset code"
          }
          disabled={busy || (sent && (!code || password.length < 10))}
          onPress={() => void act(sent)}
        />
      }
    >
      <Header
        back
        title={sent ? "A fresh start" : "Find your way back"}
        eyebrow="RESET PASSWORD"
      />
      <StepProgress current={sent ? 2 : 1} total={2} />
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: C.blush,
          justifyContent: "center",
          alignItems: "center",
          marginVertical: 24,
        }}
      >
        <Icon
          name={sent ? "key-outline" : "mail-outline"}
          size={32}
          color={C.primary}
        />
      </View>
      <Text style={[s.body, { marginBottom: 24 }]}>
        {sent
          ? "Check your inbox for a reset code, then choose a new password."
          : "Enter the email you use for Sangai. We’ll help you get back to your connections."}
      </Text>
      <Field
        label="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {sent && (
        <>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resend reset code"
            disabled={busy}
            onPress={() => void act(false)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <Text style={s.link}>Resend reset code</Text>
          </Pressable>
        </>
      )}
      <Text style={[s.small, { marginTop: 20 }]}>
        Codes expire in 15 minutes and work once. Resetting your password signs
        out existing sessions.
      </Text>
    </Page>
  );
}
