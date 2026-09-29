import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Avatar, Button, Chip, Field, Media, s } from "./ui";
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
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const toggle = (values: string[], v: string) =>
    values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
  const choices = (
    items: string[],
    current: string[],
    onChange: (values: string[]) => void,
  ) => (
    <View style={[s.wrap, { marginBottom: 20 }]}>
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
            <Field
              label="Date of birth · YYYY-MM-DD"
              value={d.birthDate}
              onChangeText={(v) => set("birthDate", v)}
              placeholder="YYYY-MM-DD"
            />
          )}
          <Text style={[s.small, { marginBottom: 16 }]}>
            Your birth date stays private. Only your age appears on your
            profile.
          </Text>
          <Text style={s.label}>Your city · no precise location</Text>
          <View style={[s.wrap, { marginVertical: 12 }]}>
            {CITIES.map((v) => (
              <Chip
                key={v}
                label={v}
                selected={d.city === v}
                onPress={() => set("city", v)}
              />
            ))}
          </View>
          <Text style={s.label}>Your gender</Text>
          <View style={[s.wrap, { marginVertical: 12 }]}>
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
            <Chip
              label="I declare that I am at least 18"
              selected={d.adult}
              onPress={() => set("adult", !d.adult)}
            />
          )}
        </>
      )}
      {step === 1 && (
        <>
          <View style={{ alignItems: "center", gap: 18, marginBottom: 22 }}>
            <Avatar person={me} size={100} />
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
          {editing && (
            <>
              {me.media
                ?.filter((m) => m.id !== me.avatar_id)
                .map((m) => (
                  <View key={m.id}>
                    <Media id={m.id} kind={m.kind} />
                    <Button
                      secondary
                      title="Remove from profile"
                      onPress={() =>
                        void st
                          .request(`/profile/media/${m.id}`, {}, "DELETE")
                          .then(st.refresh)
                          .catch((e) => st.toast(e.message))
                      }
                    />
                  </View>
                ))}
              <View style={{ marginBottom: 18 }}>
                <Button
                  secondary
                  title="Add profile photo or video"
                  disabled={(me.media?.length || 0) >= 6}
                  onPress={() =>
                    router.push({
                      pathname: "/compose",
                      params: { kind: "gallery" },
                    })
                  }
                />
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
          <View style={[s.wrap, { marginBottom: 22 }]}>
            {INTENTS.map((v) => (
              <Chip
                key={v}
                label={v}
                selected={d.intent === v}
                onPress={() => set("intent", v)}
              />
            ))}
          </View>
          <Text style={[s.label, { marginBottom: 12 }]}>
            Interests · choose at least one
          </Text>
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
          <Text style={[s.body, { marginBottom: 18 }]}>
            These preferences stay private. Both people’s preferences must fit.
            No cities, genders or intentions selected means all are welcome.
          </Text>
          <Text style={s.label}>Cities you want to discover</Text>
          {choices(CITIES, d.preferences.cities, (v) =>
            set("preferences", { ...d.preferences, cities: v }),
          )}
          <Text style={s.label}>Who would you like to meet?</Text>
          {choices(
            ["Woman", "Man", "Non-binary", "Prefer not to say"],
            d.preferences.genders,
            (v) => set("preferences", { ...d.preferences, genders: v }),
          )}
          <Text style={s.label}>Relationship intentions</Text>
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
                  set("preferences", { ...d.preferences, minAge: Number(v) })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Maximum age"
                value={String(d.preferences.maxAge)}
                keyboardType="number-pad"
                onChangeText={(v) =>
                  set("preferences", { ...d.preferences, maxAge: Number(v) })
                }
              />
            </View>
          </View>
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
          <Text style={[s.small, { marginBottom: 12 }]}>
            Optional lifestyle answers appear on your profile. Leave blank to
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
      {step === 4 && (
        <>
          <Text style={[s.body, { marginBottom: 18 }]}>
            Finish a thought: “My ideal weekend is…”, “Something I could talk
            about for hours…”, or “What makes me laugh…”
          </Text>
          <Field
            label="Your conversation starter"
            multiline
            value={d.prompt}
            onChangeText={(v) => set("prompt", v)}
          />
          <Text style={s.small}>
            Your profile is visible in Discover. Messages, posts and stories are
            only for current mutual matches. Email verification confirms inbox
            access; it does not verify identity.
          </Text>
        </>
      )}
    </>
  );
}
export const cleanDraft = (d: ProfileDraft) => ({
  ...d,
  languages: d.languages.map((v) => v.trim()).filter(Boolean),
  hobbies: d.hobbies.map((v) => v.trim()).filter(Boolean),
});
