import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Avatar,
  BottomSheet,
  Button,
  C,
  Chip,
  Field,
  Icon,
  PersonImage,
  PrivateImage,
  SelectionTile,
  s,
} from "./ui";
import { useStore } from "../lib/store";
import { CITIES, INTERESTS, State } from "../lib/types";

export const INTENTS = [
  "Serious relationship",
  "Marriage",
  "Casual dating",
  "Friendship first",
  "Still figuring it out",
];
export const SECTIONS = [
  "The basics",
  "Your first impression",
  "What matters to you",
  "Your preferences",
  "Your conversation starter",
];
export const draftFrom = (me: State["me"]) => ({
  name: me.name,
  birthDate: me.birth_date?.slice(0, 10) || "",
  city: me.city || "Kathmandu",
  gender: me.gender,
  adult: !!me.adult_declared_at,
  bio: me.bio,
  intent: me.intent,
  interests: me.interests,
  languages: me.languages || [],
  hobbies: me.hobbies || [],
  preferences: { ...me.preferences, intents: me.preferences.intents || [] },
  lifestyle: me.lifestyle || {},
  profession: me.profession || "",
  education: me.education || "",
  prompt: me.prompt,
});
export type ProfileDraft = ReturnType<typeof draftFrom>;

export function ProfileForm({
  step,
  draft: d,
  setDraft,
  me,
  editing = false,
}: {
  step: number;
  draft: ProfileDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProfileDraft>>;
  me: State["me"];
  editing?: boolean;
}) {
  const st = useStore();
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const removalPending = useRef(false);
  const removeMedia = async () => {
    if (!removeId || removalPending.current) return;
    removalPending.current = true;
    setRemoving(true);
    try {
      await st.request(`/profile/media/${removeId}`, {}, "DELETE");
      await st.refresh();
      setRemoveId(null);
      st.toast("Removed from your profile.");
    } catch (e: any) {
      st.toast(e.message);
    } finally {
      removalPending.current = false;
      setRemoving(false);
    }
  };
  const [preferencesTab, setPreferencesTab] = useState<
    "preferences" | "lifestyle"
  >("preferences");
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const toggle = (values: string[], v: string) =>
    values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
  const choices = (
    items: string[],
    current: string[],
    onChange: (values: string[]) => void,
  ) => (
    <View style={[s.wrap, { marginTop: 12, marginBottom: 24 }]}>
      {items.map((v) => (
        <Chip
          key={v}
          label={v}
          selected={current.includes(v)}
          onPress={() => onChange(toggle(current, v))}
        />
      ))}
    </View>
  );
  const group = (label: string) => (
    <Text style={[s.label, { marginTop: 12 }]}>{label}</Text>
  );
  const intentIcons: React.ComponentProps<typeof Icon>["name"][] = [
    "heart-outline",
    "diamond-outline",
    "sparkles-outline",
    "people-outline",
    "compass-outline",
  ];
  return (
    <>
      {step === 0 && (
        <>
          <Field
            label="First name"
            value={d.name}
            onChangeText={(v) => set("name", v)}
          />
          {!editing && (
            <>
              <Field
                label="Date of birth · YYYY-MM-DD"
                value={d.birthDate}
                onChangeText={(v) => set("birthDate", v)}
                placeholder="YYYY-MM-DD"
              />
              <Text style={[s.small, { marginBottom: 24 }]}>
                Your birth date stays private. Only your age appears on your
                profile.
              </Text>
            </>
          )}
          {group("Your city · no precise location")}
          <View style={[s.wrap, { marginVertical: 12, marginBottom: 24 }]}>
            {CITIES.map((v) => (
              <Chip
                key={v}
                label={v}
                selected={d.city === v}
                onPress={() => set("city", v)}
              />
            ))}
          </View>
          {group("Your gender")}
          <View style={[s.wrap, { marginVertical: 12, marginBottom: 24 }]}>
            {["Woman", "Man", "Non-binary", "Prefer not to say"].map((v) => (
              <Chip
                key={v}
                label={v}
                selected={d.gender === v}
                onPress={() => set("gender", v)}
              />
            ))}
          </View>
          {!editing && (
            <SelectionTile
              title="I declare that I am at least 18"
              subtitle="Sangai is for adults."
              icon="checkmark-circle-outline"
              selected={d.adult}
              onPress={() => set("adult", !d.adult)}
            />
          )}
        </>
      )}
      {step === 1 && (
        <>
          <View style={styles.photoIntro}>
            {editing ? (
              <View style={styles.avatarPhoto}>
                <PersonImage person={me} style={StyleSheet.absoluteFill} />
              </View>
            ) : (
              <Avatar person={me} size={100} />
            )}
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={s.label}>Your first hello</Text>
              <Text style={s.small}>Choose a photo that feels like you.</Text>
              <Button
                title={
                  me.avatar_id ? "Change profile photo" : "Add profile photo"
                }
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: { kind: "avatar" },
                  })
                }
              />
            </View>
          </View>
          {editing && (
            <>
              <View style={styles.gallery}>
                {me.media
                  ?.filter((m) => m.id !== me.avatar_id)
                  .map((m) => (
                    <View key={m.id} style={styles.galleryTile}>
                      {m.kind === "video" ? (
                        <View style={styles.videoTile}>
                          <Icon
                            name="videocam-outline"
                            size={32}
                            color={C.primary}
                          />
                          <Text style={s.small}>Profile video</Text>
                        </View>
                      ) : (
                        <PrivateImage
                          id={m.id}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove from profile"
                        accessibilityState={{ disabled: removing }}
                        disabled={removing}
                        style={styles.remove}
                        onPress={() => setRemoveId(m.id)}
                      >
                        <Icon name="close" size={18} color={C.ink} />
                      </Pressable>
                    </View>
                  ))}
              </View>
              <View style={{ marginBottom: 24 }}>
                <Button
                  secondary
                  icon="add-outline"
                  title="Add profile photo or video"
                  disabled={(me.media?.length || 0) >= 6}
                  onPress={() =>
                    router.push({
                      pathname: "/compose",
                      params: { kind: "gallery" },
                    })
                  }
                />
                <Text style={[s.small, { marginTop: 8 }]}>
                  {me.media?.length || 0} of 6 profile photos and videos
                </Text>
                <Text style={[s.small, { marginTop: 8 }]}>
                  Adding, changing or removing photos and videos saves
                  immediately.
                </Text>
              </View>
            </>
          )}
          <Field
            label="A little about you"
            multiline
            value={d.bio}
            onChangeText={(v) => set("bio", v)}
            placeholder="What would you love someone to know?"
          />
        </>
      )}
      {step === 2 && (
        <>
          <Text style={[s.label, { marginBottom: 12 }]}>
            What are you looking for?
          </Text>
          <View style={{ gap: 10, marginBottom: 24 }}>
            {INTENTS.map((v, i) => (
              <SelectionTile
                key={v}
                title={v}
                icon={intentIcons[i]}
                selected={d.intent === v}
                onPress={() => set("intent", v)}
              />
            ))}
          </View>
          {group("Interests · choose at least one")}
          {choices(INTERESTS, d.interests, (v) => set("interests", v))}
          <Field
            label="Languages · optional, comma separated"
            value={d.languages.join(",")}
            onChangeText={(v) => set("languages", v.split(","))}
          />
          <Field
            label="Hobbies · optional, comma separated"
            value={d.hobbies.join(",")}
            onChangeText={(v) => set("hobbies", v.split(","))}
          />
        </>
      )}
      {step === 3 && (
        <>
          {editing && (
            <View style={[s.row, { marginBottom: 20 }]}>
              <Chip
                label="Dating preferences"
                selected={preferencesTab === "preferences"}
                onPress={() => setPreferencesTab("preferences")}
              />
              <Chip
                label="Lifestyle"
                selected={preferencesTab === "lifestyle"}
                onPress={() => setPreferencesTab("lifestyle")}
              />
            </View>
          )}
          {(!editing || preferencesTab === "preferences") && (
            <>
              <Text style={[s.body, { marginBottom: 20 }]}>
                Your preferences stay private. Leave a group empty to welcome
                everyone.
              </Text>
              {group("Cities you want to discover")}
              {choices(CITIES, d.preferences.cities, (v) =>
                set("preferences", { ...d.preferences, cities: v }),
              )}
              {group("Who would you like to meet?")}
              {choices(
                ["Woman", "Man", "Non-binary", "Prefer not to say"],
                d.preferences.genders,
                (v) => set("preferences", { ...d.preferences, genders: v }),
              )}
              {group("Relationship intentions")}
              {choices(INTENTS, d.preferences.intents, (v) =>
                set("preferences", { ...d.preferences, intents: v }),
              )}
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Minimum age · 18+"
                    value={String(d.preferences.minAge)}
                    keyboardType="number-pad"
                    onChangeText={(v) =>
                      set("preferences", {
                        ...d.preferences,
                        minAge: Number(v),
                      })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Maximum age"
                    value={String(d.preferences.maxAge)}
                    keyboardType="number-pad"
                    onChangeText={(v) =>
                      set("preferences", {
                        ...d.preferences,
                        maxAge: Number(v),
                      })
                    }
                  />
                </View>
              </View>
            </>
          )}
          {(!editing || preferencesTab === "lifestyle") && (
            <>
              {!editing && <View style={s.divider} />}
              <Field
                label="Profession · optional"
                value={d.profession}
                onChangeText={(v) => set("profession", v)}
              />
              <Field
                label="Education · optional"
                value={d.education}
                onChangeText={(v) => set("education", v)}
              />
              <Text style={[s.small, { marginBottom: 20 }]}>
                Lifestyle answers appear on your profile. Leave them blank to
                keep them private.
              </Text>
              {["smoking", "drinking", "pets", "fitness"].map((key) => (
                <Field
                  key={key}
                  label={`${key[0].toUpperCase() + key.slice(1)} · optional`}
                  value={d.lifestyle[key] || ""}
                  onChangeText={(v) =>
                    set("lifestyle", { ...d.lifestyle, [key]: v })
                  }
                />
              ))}
            </>
          )}
        </>
      )}
      {step === 4 && (
        <>
          <View style={styles.promptNote}>
            <Icon
              name="chatbubble-ellipses-outline"
              color={C.primary}
              size={28}
            />
            <Text style={[s.body, { marginTop: 16 }]}>
              “My ideal weekend is…”{"\n"}“Something I could talk about for
              hours…”{"\n"}“What makes me laugh…”
            </Text>
          </View>
          <Field
            label="Your conversation starter"
            multiline
            value={d.prompt}
            onChangeText={(v) => set("prompt", v)}
          />
          <Text style={s.small}>
            Your profile appears in Discover. Your messages, posts and stories
            are shared only with current mutual matches.
          </Text>
        </>
      )}
      <BottomSheet
        visible={!!removeId}
        onClose={() => {
          if (!removing) setRemoveId(null);
        }}
        title="Remove from your profile?"
      >
        <Text style={[s.body, { marginBottom: 24 }]}>
          This photo or video will be removed immediately. Your written changes
          stay in this editor.
        </Text>
        <View style={{ gap: 12 }}>
          <Button
            title={removing ? "Removing…" : "Remove photo or video"}
            disabled={removing}
            onPress={() => void removeMedia()}
          />
          <Button
            title="Keep on profile"
            secondary
            disabled={removing}
            onPress={() => setRemoveId(null)}
          />
        </View>
      </BottomSheet>
    </>
  );
}
export const cleanDraft = (d: ProfileDraft) => ({
  ...d,
  languages: d.languages.map((v) => v.trim()).filter(Boolean),
  hobbies: d.hobbies.map((v) => v.trim()).filter(Boolean),
});
const styles = StyleSheet.create({
  photoIntro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 24,
  },
  avatarPhoto: {
    width: 100,
    height: 132,
    borderRadius: 14,
    backgroundColor: C.peach,
    overflow: "hidden",
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  galleryTile: {
    width: "47%",
    aspectRatio: 0.85,
    borderRadius: 14,
    backgroundColor: C.peach,
    overflow: "hidden",
  },
  remove: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  videoTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  promptNote: {
    backgroundColor: C.lavender,
    padding: 24,
    borderRadius: 18,
    marginBottom: 24,
  },
});
