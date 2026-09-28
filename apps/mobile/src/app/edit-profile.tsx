import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { CITIES, INTERESTS } from "../lib/types";
import {
  Button,
  Chip,
  Field,
  Header,
  Page,
  Section,
  s,
} from "../components/ui";
export default function EditProfile() {
  const st = useStore();
  const me = st.data?.me;
  const [name, setName] = useState(me?.name || ""),
    [city, setCity] = useState(me?.city || "Kathmandu"),
    [bio, setBio] = useState(me?.bio || ""),
    [prompt, setPrompt] = useState(me?.prompt || ""),
    [intent, setIntent] = useState(me?.intent || "A meaningful relationship"),
    [gender, setGender] = useState(me?.gender || "Prefer not to say"),
    [interests, setInterests] = useState(me?.interests || []),
    [cities, setCities] = useState(me?.preferences.cities || []),
    [genders, setGenders] = useState(me?.preferences.genders || []),
    [minAge, setMinAge] = useState(String(me?.preferences.minAge || 18)),
    [maxAge, setMaxAge] = useState(String(me?.preferences.maxAge || 80)),
    [busy, setBusy] = useState(false);
  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((i) => i !== v) : [...arr, v];
  return (
    <Page>
      <Header
        back
        title="The real you."
        eyebrow="A LITTLE CONTEXT GOES A LONG WAY"
      />
      <Field label="First name" value={name} onChangeText={setName} />
      <Text style={[s.label, { marginBottom: 12 }]}>
        Your city · never your precise location
      </Text>
      <View style={[s.wrap, { marginBottom: 20 }]}>
        {CITIES.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={city === c}
            onPress={() => setCity(c)}
          />
        ))}
      </View>
      <Field label="About you" value={bio} onChangeText={setBio} multiline />
      <Field
        label="A little conversation starter"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        placeholder="The quickest way to my heart is…"
      />
      <Field
        label="What are you looking for?"
        value={intent}
        onChangeText={setIntent}
      />
      <Text style={[s.label, { marginBottom: 10 }]}>Your gender</Text>
      <View style={s.wrap}>
        {["Woman", "Man", "Non-binary", "Prefer not to say"].map((g) => (
          <Chip
            key={g}
            label={g}
            selected={g === gender}
            onPress={() => setGender(g)}
          />
        ))}
      </View>
      <Section title="Little things you love" />
      <View style={s.wrap}>
        {INTERESTS.map((i) => (
          <Chip
            key={i}
            label={i}
            selected={interests.includes(i)}
            onPress={() => setInterests(toggle(interests, i))}
          />
        ))}
      </View>
      <Section title="Discovery preferences" />
      <Text style={[s.body, { marginBottom: 12 }]}>
        Choose cities you want to discover. Selecting cities in another country
        explicitly includes long-distance possibilities. No selection includes
        all eight beta cities.
      </Text>
      <View style={s.wrap}>
        {CITIES.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={cities.includes(c)}
            onPress={() => setCities(toggle(cities, c))}
          />
        ))}
      </View>
      <Text style={[s.label, { marginTop: 20, marginBottom: 12 }]}>
        Who would you like to meet? · none selected = everyone
      </Text>
      <View style={s.wrap}>
        {["Woman", "Man", "Non-binary", "Prefer not to say"].map((g) => (
          <Chip
            key={g}
            label={g}
            selected={genders.includes(g)}
            onPress={() => setGenders(toggle(genders, g))}
          />
        ))}
      </View>
      <View style={[s.row, { marginTop: 20 }]}>
        <View style={{ flex: 1 }}>
          <Field
            label="Minimum age · 18+"
            value={minAge}
            onChangeText={setMinAge}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Maximum age"
            value={maxAge}
            onChangeText={setMaxAge}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <Button
        title={busy ? "Saving…" : "Save my profile"}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await st.request(
              "/profile",
              {
                name,
                city,
                bio,
                prompt,
                intent,
                gender,
                interests,
                preferences: {
                  cities,
                  genders,
                  minAge: Number(minAge),
                  maxAge: Number(maxAge),
                },
              },
              "PATCH",
            );
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
