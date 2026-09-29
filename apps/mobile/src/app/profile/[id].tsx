import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Person } from "../../lib/types";
import { useStore } from "../../lib/store";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  Header,
  Media,
  Page,
  s,
} from "../../components/ui";
export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const [p, setPerson] = useState<Person | null>(null);
  const { request } = st;
  useEffect(() => {
    let alive = true;
    request<Person>(`/profiles/${id}`)
      .then((p) => {
        if (alive) setPerson(p);
      })
      .catch(() => {
        if (alive) setPerson(null);
      });
    return () => {
      alive = false;
    };
  }, [id, request]);
  if (!p)
    return (
      <Page>
        <Header back title="Profile" />
        <Empty
          title="Profile unavailable"
          body="This person may no longer be visible to you."
        />
      </Page>
    );
  const isMatch = st.data?.matches.some((m) => m.id === id),
    own = st.data?.me.id === id;
  return (
    <Page>
      <Header
        back
        title={p.name}
        eyebrow={p.demo ? "DEMO PROFILE" : "THE PERSON BEHIND THE PROFILE"}
      />
      <View style={[s.card, { alignItems: "center", paddingVertical: 30 }]}>
        <Avatar person={p} size={110} />
        <Text style={[s.h2, { marginTop: 17 }]}>
          {p.name}, {p.age}
        </Text>
        <Text style={[s.body, { marginTop: 5 }]}>{p.city}</Text>
        <View style={{ height: 15 }} />
        <Chip label={p.intent} />
      </View>
      {p.media
        ?.filter((m) => m.id !== p.avatar_id)
        .map((m) => (
          <Media key={m.id} id={m.id} kind={m.kind} />
        ))}
      {!!p.languages?.length && (
        <Text style={s.body}>Languages: {p.languages.join(", ")}</Text>
      )}
      {!!p.hobbies?.length && (
        <Text style={s.body}>Hobbies: {p.hobbies.join(", ")}</Text>
      )}
      {!!p.profession && <Text style={s.body}>{p.profession}</Text>}
      {!!p.education && <Text style={s.body}>{p.education}</Text>}
      {Object.entries(p.lifestyle || {})
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <Text key={k} style={s.body}>
            {k}: {v}
          </Text>
        ))}
      <Text style={[s.body, { marginBottom: 20 }]}>{p.bio}</Text>
      <View style={[s.wrap, { marginBottom: 20 }]}>
        {p.interests.map((i) => (
          <Chip key={i} label={i} />
        ))}
      </View>
      <View style={s.card}>
        <Text style={s.eyebrow}>A CONVERSATION STARTER</Text>
        <Text style={[s.h2, { lineHeight: 28 }]}>
          {p.prompt || "What is one little thing that made your week?"}
        </Text>
      </View>
      {isMatch ? (
        <>
          <Button
            title="Open your conversation"
            icon="chatbubble-outline"
            onPress={() => router.push(`/chat/${id}`)}
          />
        </>
      ) : (
        !own && (
          <>
            <Button
              title="Back to Discover"
              disabled={busy}
              icon="heart-outline"
              onPress={async () => {
                setBusy(true);
                try {
                  router.back();
                } catch (e: any) {
                  st.toast(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        )
      )}
      {!own && (
        <View style={{ marginTop: 18 }}>
          <Button
            title="Safety & privacy"
            secondary
            icon="shield-checkmark-outline"
            onPress={() =>
              router.push({ pathname: "/safety", params: { target: id } })
            }
          />
        </View>
      )}
      <Text style={[s.small, { textAlign: "center", marginTop: 18 }]}>
        Posts, stories, and community activity become visible only after a
        mutual match.
      </Text>
    </Page>
  );
}
