import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Redirect } from "expo-router";
import { useStore } from "../lib/store";
import { AuthRecovery } from "../components/AuthRecovery";
import { maskEmail, OTPInput } from "../components/OTPInput";
import { countdownLabel, useCountdown } from "../lib/useCountdown";
import { authMessage } from "../lib/authMessage";
import {
  Button,
  C,
  Header,
  Icon,
  Loading,
  Page,
  StepProgress,
  s,
} from "../components/ui";
import {
  cleanDraft,
  draftFrom,
  ProfileForm,
  SECTIONS,
} from "../components/ProfileForm";
export default function Onboarding() {
  const st = useStore();
  if (!st.ready) return <Loading />;
  if (st.token && !st.data) return <AuthRecovery />;
  if (!st.token || !st.data) return <Loading />;
  if (
    st.data.me.demo ||
    (st.data.me.email_verified_at && st.data.me.onboarded_at)
  )
    return <Redirect href="/(tabs)" />;
  return <Setup key={st.data.me.id} />;
}
function Setup() {
  const compact = useWindowDimensions().height < 740;
  const st = useStore(),
    me = st.data!.me;
  const { request, toast } = st;
  const [draft, setDraft] = useState(() => draftFrom(me));
  const [step, setStep] = useState(Math.min(me.onboarding_step, 4));
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const initialSend = useRef(false);
  const seconds = useCountdown(resendAt);
  const sendCode = useCallback(
    async (notify = false) => {
      setBusy(true);
      setVerifyError("");
      try {
        const result = await request<{
          sent?: boolean;
          sending?: boolean;
          resendAt?: string;
        }>("/verification/send", {});
        setSent(!result.sending);
        setResendAt(result.resendAt || null);
        if (result.sent) {
          setCode("");
          if (notify) toast("Code sent. Check your inbox.");
        } else if (result.sending)
          setVerifyError("Your email is being sent. Check your inbox shortly.");
      } catch (e: any) {
        setVerifyError(authMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [request, toast],
  );
  useEffect(() => {
    if (!me.email_verified_at && !initialSend.current) {
      initialSend.current = true;
      void sendCode();
    }
  }, [me.email_verified_at, sendCode]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      st.toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      key={me.email_verified_at ? `profile-step-${step}` : "verify-email"}
      footer={
        me.email_verified_at ? (
          <View style={{ gap: 8 }}>
            <Button
              title={
                busy
                  ? "Saving…"
                  : step === 4
                    ? "Finish profile & Discover"
                    : "Save & continue"
              }
              disabled={busy}
              icon="arrow-forward"
              onPress={() =>
                void run(async () => {
                  await st.request(
                    "/onboarding",
                    { step, data: cleanDraft(draft) },
                    "PATCH",
                  );
                  await st.refresh();
                  setStep(Math.min(step + 1, 4));
                })
              }
            />
            {step > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous step"
                disabled={busy}
                onPress={() => setStep(step - 1)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={s.link}>Previous step</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Button
            title="Verify email"
            disabled={busy || code.length !== 6}
            onPress={() =>
              void (async () => {
                setBusy(true);
                setVerifyError("");
                try {
                  await st.request("/verification/confirm", { code });
                  st.toast("Email verified. Let’s build your profile.");
                  await st.refresh();
                } catch (e: any) {
                  setVerifyError(authMessage(e));
                } finally {
                  setBusy(false);
                }
              })()
            }
          />
        )
      }
    >
      {me.email_verified_at && (
        <View style={{ marginTop: 8 }}>
          <StepProgress current={step + 1} total={5} />
        </View>
      )}
      <Header
        title={me.email_verified_at ? SECTIONS[step] : "Verify your email"}
        eyebrow={
          me.email_verified_at
            ? `STEP ${step + 1} OF 5`
            : "YOUR ACCOUNT, YOUR INBOX"
        }
        action={<View />}
      />
      {!me.email_verified_at ? (
        <>
          <View
            style={{
              width: compact ? 56 : 80,
              height: compact ? 56 : 80,
              borderRadius: compact ? 18 : 24,
              backgroundColor: C.blush,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: compact ? 16 : 24,
            }}
          >
            <Icon
              name="mail-outline"
              size={compact ? 28 : 36}
              color={C.primary}
            />
          </View>
          <Text style={[s.body, { marginBottom: 8 }]}>
            {sent
              ? "We sent a six-digit code to"
              : "We’ll send a six-digit code to"}
          </Text>
          <Text style={[s.h2, { marginBottom: compact ? 16 : 24 }]}>
            {maskEmail(me.email)}
          </Text>
          <Text style={[s.small, { marginBottom: compact ? 8 : 24 }]}>
            {compact
              ? "Confirm your inbox to start your profile. Identity verification comes later."
              : "Confirm your email to start building your profile. This confirms inbox access; identity verification comes later."}
          </Text>
          <OTPInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setVerifyError("");
            }}
            disabled={busy}
          />
          {!!verifyError && (
            <Text
              accessibilityRole="alert"
              style={[s.small, { color: C.red, marginBottom: 16 }]}
            >
              {verifyError}
            </Text>
          )}
          <Button
            title={
              busy
                ? "Please wait…"
                : seconds
                  ? `Resend in ${countdownLabel(seconds)}`
                  : sent
                    ? "Resend code"
                    : "Send verification code"
            }
            secondary
            disabled={busy || seconds > 0}
            onPress={() => void sendCode(true)}
          />
          <Text style={[s.small, { textAlign: "center", marginTop: 16 }]}>
            Check spam, too. Codes expire after 15 minutes.
          </Text>
        </>
      ) : (
        <>
          <ProfileForm step={step} draft={draft} setDraft={setDraft} me={me} />
          <Text style={[s.small, { marginTop: 18, textAlign: "center" }]}>
            Saved after each step. Make yourself at home.
          </Text>
        </>
      )}
      <View style={{ marginTop: 24 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => void st.signOut()}
          style={{
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={s.small}>Sign out</Text>
        </Pressable>
      </View>
    </Page>
  );
}
