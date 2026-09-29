import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, C, Icon, Media, s } from "./ui";
import { useStore } from "../lib/store";
export function ConversationItem({
  item: m,
  target,
  reload,
  openSnap,
}: {
  item: any;
  target: string;
  reload: () => Promise<void>;
  openSnap: (id: string) => void;
}) {
  const st = useStore(),
    mine = m.sender === st.data?.me.id;
  if (m.type === "message")
    return (
      <View
        style={{
          alignSelf: mine ? "flex-end" : "flex-start",
          width: m.media_id ? "86%" : undefined,
          maxWidth: "86%",
          backgroundColor: mine ? C.blush : C.white,
          padding: 14,
          borderRadius: 19,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: C.line,
        }}
      >
        {!!m.media_id && <Media id={m.media_id} kind={m.kind} />}
        {!!m.body && <Text style={s.body}>{m.body}</Text>}
        {!!m.post_id && (
          <Button
            secondary
            title="View shared moment"
            onPress={() =>
              router.push({ pathname: "/post/[id]", params: { id: m.post_id } })
            }
          />
        )}
        {!m.post_id && !m.body && !m.media_id && (
          <Text style={s.small}>This attachment is no longer available.</Text>
        )}
        <Text style={[s.small, { marginTop: 8, fontSize: 10 }]}>
          {new Date(m.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  if (m.type === "snap")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          m.opened_at ? "Snap opened" : mine ? "Your snap sent" : "Open snap"
        }
        disabled={!!m.opened_at || mine}
        onPress={() => openSnap(m.id)}
        style={[s.card, s.row, { backgroundColor: C.lavender }]}
      >
        <Icon name="camera-outline" />
        <View style={{ flex: 1 }}>
          <Text style={s.label}>
            {m.opened_at
              ? "Snap opened"
              : mine
                ? "Your snap · waiting to be opened"
                : "A snap for you · tap to open"}
          </Text>
          <Text style={s.small}>View once · screenshots are possible</Text>
        </View>
      </Pressable>
    );
  if (m.type === "game") {
    const def = st.data?.games.find((g) => g.id === m.kind);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${def?.title || "Previous game"} · ${m.state}`}
        style={[s.card, { backgroundColor: C.peach }]}
        onPress={() =>
          router.push({ pathname: "/game/[id]", params: { id: m.id, target } })
        }
      >
        <Text style={s.h2}>
          {def?.emoji} {def?.title || "Previous game"}
        </Text>
        <Text style={[s.body, { marginTop: 10 }]}>
          {m.state === "invited"
            ? m.guest === st.data?.me.id
              ? "Invitation for you · accept or decline →"
              : "Invitation sent · waiting for acceptance"
            : m.complete
              ? "Your reveal is ready →"
              : m.state === "active"
                ? "Game in progress →"
                : `Game ${m.state}`}
        </Text>
      </Pressable>
    );
  }
  const act = (state: string) =>
    st
      .request(`/plan/${m.id}`, { state })
      .then(reload)
      .catch((e) => st.toast(e.message));
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>DATE IDEA · {m.state.toUpperCase()}</Text>
      <Text style={s.h2}>{m.title}</Text>
      <Text style={s.body}>{m.venue || "Location to decide together"}</Text>
      <Text style={[s.small, { marginVertical: 12 }]}>
        {new Date(m.scheduled_at).toLocaleString()} ·{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </Text>
      {m.state === "proposed" && m.guest === st.data?.me.id && (
        <View style={s.wrap}>
          <Button title="Sounds lovely" onPress={() => void act("accepted")} />
          <Button
            title="Another time"
            secondary
            onPress={() => void act("declined")}
          />
        </View>
      )}
      {["proposed", "accepted"].includes(m.state) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void act("cancelled")}
          style={{ paddingTop: 16 }}
        >
          <Text style={[s.small, s.danger]}>Cancel date</Text>
        </Pressable>
      )}
    </View>
  );
}
