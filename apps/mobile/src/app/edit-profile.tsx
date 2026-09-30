import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../lib/store";
import {
  Button,
  C,
  Header,
  Icon,
  IconButton,
  Loading,
  Page,
  s,
} from "../components/ui";
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
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [draft, setDraft] = useState(() => draftFrom(me));
  const [step, setStep] = useState<number | null>(() =>
      section && /^[0-4]$/.test(section) ? Number(section) : null,
    ),
    [busy, setBusy] = useState(false);
  const save = async () => {
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
  };
  const icons = [
    "person-outline",
    "images-outline",
    "heart-outline",
    "options-outline",
    "chatbubble-ellipses-outline",
  ] as const;
  const summaries = [
    [draft.name, draft.city].filter(Boolean).join(" · "),
    "Photos, videos & your bio",
    [draft.intent, `${draft.interests.length} interests`]
      .filter(Boolean)
      .join(" · "),
    "Dating preferences & lifestyle",
    draft.prompt || "Give someone a reason to say hello",
  ];
  return (
    <Page
      key={step === null ? "sections" : step}
      footer={
        <Button
          title={busy ? "Saving…" : "Save my profile"}
          disabled={busy}
          onPress={() => void save()}
        />
      }
    >
      <Header
        back
        title="Edit profile"
        action={
          step !== null ? (
            <IconButton
              name="grid-outline"
              label="All profile sections"
              onPress={() => setStep(null)}
            />
          ) : (
            <View />
          )
        }
      />
      {step === null ? (
        <>
          <Text style={[s.body, { marginBottom: 24 }]}>
            A few good details make it easier to find your people.
          </Text>
          <View>
            {SECTIONS.map((name, i) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={name}
                onPress={() => setStep(i)}
                style={({ pressed }) => [
                  styles.section,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Icon name={icons[i]} size={24} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { fontSize: 16 }]}>{name}</Text>
                  <Text style={[s.small, { marginTop: 5 }]}>
                    {summaries[i]}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={C.muted} />
              </Pressable>
            ))}
          </View>
          <Text style={[s.small, { marginTop: 24 }]}>
            Changes are saved together when you tap Save my profile.
          </Text>
        </>
      ) : (
        <>
          <Text style={[s.small, { color: C.primary, marginBottom: 8 }]}>
            SECTION {step + 1} OF 5
          </Text>
          <Text style={[s.h2, { marginBottom: 24 }]}>{SECTIONS[step]}</Text>
          <ProfileForm
            step={step}
            draft={draft}
            setDraft={setDraft}
            me={me}
            editing
          />
          <View style={{ marginTop: 24 }}>
            <Button
              title="All profile sections"
              secondary
              onPress={() => setStep(null)}
            />
          </View>
        </>
      )}
    </Page>
  );
}
const styles = StyleSheet.create({
  section: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 84,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
});
