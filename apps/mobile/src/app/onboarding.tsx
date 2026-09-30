import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useStore } from "../lib/store";
import {
  Button,
  C,
  Field,
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
  if (!st.ready || (st.token && !st.data)) return <Loading />;
  if (!st.token || !st.data) return <Redirect href="/" />;
  if (
    st.data.me.demo ||
    (st.data.me.email_verified_at && st.data.me.onboarded_at)
  )
    return <Redirect href="/(tabs)" />;
  return <Setup key={st.data.me.id} />;
}
function Setup() {
  const st = useStore(),
    me = st.data!.me;
  const [draft, setDraft] = useState(() => draftFrom(me));
  const [step, setStep] = useState(Math.min(me.onboarding_step, 4));
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
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
            disabled={busy || !code.trim()}
            onPress={() =>
              void run(async () => {
                await st.request("/verification/confirm", {
                  code: code.trim(),
                });
                await st.refresh();
              })
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
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: C.blush,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Icon name="mail-outline" size={36} color={C.primary} />
          </View>
          <Text style={[s.body, { marginBottom: 8 }]}>
            We’ll send a code to your inbox.
          </Text>
          <Text style={[s.h2, { marginBottom: 24 }]}>{me.email}</Text>
          <Text style={[s.small, { marginBottom: 24 }]}>
            Confirm your email to start building your profile. This confirms
            inbox access; identity verification comes later.
          </Text>
          <Button
            title={sent ? "Resend code" : "Send verification code"}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await st.request("/verification/send", {});
                setSent(true);
                st.toast(
                  "Code sent. Check your inbox or the local beta mail inbox.",
                );
              })
            }
          />
          <View style={{ height: 32 }} />
          <Field
            label="Verification code"
            value={code}
            onChangeText={setCode}
          />
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
