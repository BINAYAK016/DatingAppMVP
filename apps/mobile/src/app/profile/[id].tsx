import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../../lib/store";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  Field,
  Header,
  Page,
  s,
} from "../../components/ui";
export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false);
  const p = [
    ...(st.data?.discover || []),
    ...(st.data?.matches || []),
    ...(st.data?.requests.map((r) => r.from) || []),
    ...(st.data ? [st.data.me] : []),
  ].find((p) => p.id === id);
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
          <View style={{ height: 10 }} />
          <Button
            title={p.followed ? "Unfollow moments" : "Follow their moments"}
            secondary
            onPress={() =>
              st
                .request(`/follow/${id}`, {})
                .then(st.refresh)
                .catch((e) => st.toast(e.message))
            }
          />
        </>
      ) : (
        !own && (
          <>
            <Field
              label="Start with something real"
              value={note}
              onChangeText={setNote}
              placeholder="Your perfect Sunday sounds like mine…"
              multiline
            />
            <Button
              title={busy ? "Sending…" : "Send connection request"}
              disabled={!note.trim() || busy}
              icon="heart-outline"
              onPress={async () => {
                setBusy(true);
                try {
                  await st.request(`/connect/${id}`, { note });
                  await st.refresh();
                  st.toast("Your hello is on its way.");
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
