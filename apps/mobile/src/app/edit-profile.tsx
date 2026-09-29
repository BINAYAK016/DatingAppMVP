import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { Button, Chip, Header, Loading, Page, s } from "../components/ui";
import {
  cleanDraft,
  draftFrom,
  ProfileForm,
  SECTIONS,
} from "../components/ProfileForm";
export default function EditProfile() {
  const { data } = useStore();
  return data ? <Editor key={data.me.id} /> : <Loading />;
}
function Editor() {
  const st = useStore(),
    me = st.data!.me;
  const [draft, setDraft] = useState(() => draftFrom(me));
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false);
  return (
    <Page>
      <Header back title="The real you" eyebrow="EDIT YOUR PROFILE" />
      <View style={[s.wrap, { marginBottom: 24 }]}>
        {SECTIONS.map((name, i) => (
          <Chip
            key={name}
            label={name}
            selected={step === i}
            onPress={() => setStep(i)}
          />
        ))}
      </View>
      <ProfileForm
        step={step}
        draft={draft}
        setDraft={setDraft}
        me={me}
        editing
      />
      <View style={{ height: 24 }} />
      <Button
        title={busy ? "Saving…" : "Save my profile"}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await st.request("/profile", cleanDraft(draft), "PATCH");
            await st.refresh();
            st.toast("Your profile is updated.");
            router.back();
          } catch (e: any) {
            st.toast(e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Page>
  );
}
