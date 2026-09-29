import React, { useState } from "react";
import { Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useStore } from "../lib/store";
import { Button, C, Field, Header, Loading, Page, s } from "../components/ui";
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
    <Page>
      <Header
        title={me.email_verified_at ? SECTIONS[step] : "Verify your email"}
        eyebrow={
          me.email_verified_at
            ? `STEP ${step + 1} OF 5`
            : "YOUR ACCOUNT, YOUR INBOX"
        }
      />
      {!me.email_verified_at ? (
        <>
          <Text style={[s.body, { marginBottom: 20 }]}>
            We’ll send a code to {me.email}. Verification confirms access to
            your inbox. Identity verification will come later.
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
          <View style={{ height: 24 }} />
          <Field
            label="Verification code"
            value={code}
            onChangeText={setCode}
          />
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
        </>
      ) : (
        <>
          <View style={[s.row, { marginBottom: 24 }]}>
            {SECTIONS.map((_, i) => (
              <View
                key={i}
                style={{
                  height: 4,
                  flex: 1,
                  borderRadius: 2,
                  backgroundColor: i <= step ? C.primary : C.line,
                }}
              />
            ))}
          </View>
          <ProfileForm step={step} draft={draft} setDraft={setDraft} me={me} />
          <View style={{ height: 24 }} />
          <Button
            title={
              busy
                ? "Saving…"
                : step === 4
                  ? "Finish profile & Discover"
                  : "Save & continue"
            }
            disabled={busy}
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
            <View style={{ marginTop: 12 }}>
              <Button
                title="Previous step"
                secondary
                disabled={busy}
                onPress={() => setStep(step - 1)}
              />
            </View>
          )}
          <Text style={[s.small, { marginTop: 18, textAlign: "center" }]}>
            Each completed step is saved. You can come back later.
          </Text>
        </>
      )}
      <View style={{ marginTop: 24 }}>
        <Button title="Sign out" secondary onPress={() => void st.signOut()} />
      </View>
    </Page>
  );
}
