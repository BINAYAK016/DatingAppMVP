import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../../lib/store";
import {
  Avatar,
  Button,
  Empty,
  Field,
  Header,
  Page,
  Section,
  s,
} from "../../components/ui";
export default function Circle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const { request } = st;
  const [circle, setCircle] = useState<any>(null),
    [error, setError] = useState(""),
    [body, setBody] = useState("");
  const load = useCallback(
    () =>
      request(`/circles/${id}`)
        .then(setCircle)
        .catch((e) => {
          setCircle(null);
          setError(e.message);
        }),
    [id, request],
  );
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 7000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e: any) {
      st.toast(e.message);
    }
  };
  return (
    <Page>
      <Header
        back
        title={circle?.name || "Your circle."}
        eyebrow="EVERYONE HERE IS A MUTUAL MATCH"
      />
      {error && !circle ? (
        <>
          <Empty title="This circle is paused" body={error} />
          <Button
            title="Leave this circle"
            secondary
            onPress={() =>
              request(`/circles/${id}/leave`, {})
                .then(st.refresh)
                .then(() => router.back())
                .catch((e) => st.toast(e.message))
            }
          />
        </>
      ) : (
        circle && (
          <>
            <Text style={s.body}>{circle.description}</Text>
            <View style={[s.wrap, { marginVertical: 20 }]}>
              {circle.members.map((p: any) => (
                <View
                  key={p.id}
                  style={{ alignItems: "center", gap: 7, marginRight: 9 }}
                >
                  <Avatar person={p} />
                  <Text style={s.small}>{p.name}</Text>
                </View>
              ))}
            </View>
            <Field
              value={body}
              onChangeText={setBody}
              placeholder="Start a conversation in your circle…"
              multiline
            />
            <Button
              title="Post to circle"
              disabled={!body.trim()}
              onPress={() =>
                void act(async () => {
                  await request(`/circles/${id}/posts`, { body });
                  setBody("");
                })
              }
            />
            <Section title="Coming together" />
            <Button
              title="Plan a circle event"
              secondary
              icon="calendar-outline"
              onPress={() =>
                router.push({ pathname: "/plan", params: { circle: id } })
              }
            />
            {circle.events.map((e: any) => (
              <View key={e.id} style={[s.card, { marginTop: 14 }]}>
                <Text style={s.h2}>{e.title}</Text>
                <Text style={s.body}>{e.venue}</Text>
                <Text style={[s.small, { marginVertical: 10 }]}>
                  {new Date(e.scheduled_at).toLocaleString()} · {e.going.length}{" "}
                  going
                </Text>
                <Button
                  title={
                    e.going.includes(st.data?.me.id)
                      ? "Going ✓ · undo"
                      : "I’m in"
                  }
                  secondary
                  onPress={() =>
                    void act(() => request(`/events/${e.id}/rsvp`, {}))
                  }
                />
              </View>
            ))}
            <Section title="The conversation" />
            {circle.posts.map((p: any) => (
              <View key={p.id} style={s.card}>
                <View style={s.row}>
                  <Avatar person={p.author} size={32} />
                  <Text style={s.label}>{p.author.name}</Text>
                </View>
                <Text style={[s.body, { marginTop: 12 }]}>{p.body}</Text>
              </View>
            ))}
            <Button
              title={
                circle.owner === st.data?.me.id
                  ? "Close my circle"
                  : "Leave this circle"
              }
              secondary
              onPress={() =>
                request(`/circles/${id}/leave`, {})
                  .then(st.refresh)
                  .then(() => router.back())
                  .catch((e) => st.toast(e.message))
              }
            />
          </>
        )
      )}
    </Page>
  );
}
