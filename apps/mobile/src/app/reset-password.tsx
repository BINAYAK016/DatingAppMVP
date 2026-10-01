import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { maskEmail, OTPInput } from "../components/OTPInput";
import { countdownLabel, useCountdown } from "../lib/useCountdown";
import { authMessage } from "../lib/authMessage";
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
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState<string | null>(null);
  const seconds = useCountdown(resendAt);
  const act = async (reset: boolean) => {
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("Enter a valid email address.");
    setBusy(true);
    try {
      const result = await request<{ resendAt?: string }>(
        reset ? "/auth/reset" : "/auth/forgot",
        reset
          ? { email: email.trim(), code: code.trim(), password }
          : { email: email.trim() },
      );
      if (reset) {
        toast("Password updated. Sign in with your new password.");
        router.replace("/welcome");
      } else {
        setSent(true);
        setCode("");
        setResendAt(result.resendAt || null);
        toast("If an account exists, a reset code has been sent.");
      }
    } catch (e: any) {
      setError(authMessage(e));
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
          disabled={
            busy || (sent && (code.length !== 6 || password.length < 10))
          }
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
      {!sent && (
        <Field
          label="Email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      )}
      {sent && (
        <>
          <Text style={s.h2}>{maskEmail(email.trim())}</Text>
          <OTPInput
            label="Reset code from your email"
            value={code}
            onChange={(value) => {
              setCode(value);
              setError("");
            }}
            disabled={busy}
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
            disabled={busy || seconds > 0}
            onPress={() => void act(false)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <Text style={seconds ? s.small : s.link}>
              {seconds
                ? `Resend in ${countdownLabel(seconds)}`
                : "Resend reset code"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use another email"
            disabled={busy}
            onPress={() => {
              setSent(false);
              setCode("");
              setError("");
            }}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={s.link}>Use another email</Text>
          </Pressable>
        </>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={[s.small, { color: C.red, marginTop: 12 }]}
        >
          {error}
        </Text>
      )}
      <Text style={[s.small, { marginTop: 20 }]}>
        Codes expire in 15 minutes and work once. Resetting your password signs
        out existing sessions.
      </Text>
    </Page>
  );
}
