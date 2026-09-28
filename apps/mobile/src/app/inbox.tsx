import React from "react";
import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import {
  Avatar,
  Button,
  Empty,
  Header,
  Icon,
  Page,
  Section,
  s,
} from "../components/ui";
export default function Inbox() {
  const st = useStore();
  if (!st.data) return null;
  return (
    <Page refresh>
      <Header
        back
        title="Your connections."
        eyebrow="LET THE CONVERSATION HAPPEN"
      />
      {!!st.data.requests.length && (
        <>
          <Section
            title="A hello, just for you"
            aside={String(st.data.requests.length)}
          />
          {st.data.requests.map((r) => (
            <View key={r.from.id} style={s.card}>
              <View style={s.row}>
                <Avatar person={r.from} />
                <View>
                  <Text style={s.label}>{r.from.name}</Text>
                  <Text style={s.small}>{r.from.city}</Text>
                </View>
              </View>
              <Text style={[s.body, { marginVertical: 16 }]}>{r.note}</Text>
              <View style={s.row}>
                {[true, false].map((accept) => (
                  <View key={String(accept)} style={{ flex: 1 }}>
                    <Button
                      title={accept ? "Match back" : "Not for me"}
                      secondary={!accept}
                      onPress={() =>
                        st
                          .request(`/requests/${r.from.id}`, { accept })
                          .then(st.refresh)
                          .catch((e) => st.toast(e.message))
                      }
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      )}
      <Section
        title="Good conversations"
        aside={`${st.data.matches.length} matches`}
      />
      {st.data.matches.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`Chat with ${p.name}`}
          onPress={() => router.push(`/chat/${p.id}`)}
          style={[s.card, s.row]}
        >
          <Avatar person={p} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>{p.name}</Text>
            <Text style={s.small}>Chat, snap, or play something together</Text>
          </View>
          <Icon name="chevron-forward" size={18} />
        </Pressable>
      ))}
      {!st.data.matches.length && (
        <Empty
          title="Your next hello is out there"
          body="Mutual matches unlock chat, snaps, and your private social community."
        />
      )}
      <Section title="Little updates" />
      {st.data.notifications.slice(0, 12).map((n) => (
        <View key={n.id} style={[s.row, { paddingVertical: 12 }]}>
          <Icon
            name={
              n.kind === "game"
                ? "dice-outline"
                : n.kind === "snap"
                  ? "camera-outline"
                  : "heart-outline"
            }
            size={20}
          />
          <Text style={[s.body, { flex: 1 }]}>{n.body}</Text>
          {!n.read && <Text style={s.tag}>NEW</Text>}
        </View>
      ))}
      {!!st.data.notifications.length && (
        <Button
          title="Mark updates as read"
          secondary
          onPress={() =>
            st
              .request("/notifications/read", {})
              .then(st.refresh)
              .catch((e) => st.toast(e.message))
          }
        />
      )}
    </Page>
  );
}
