import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../../lib/store";
import {
  Avatar,
  Button,
  Empty,
  Header,
  Media,
  Page,
  s,
} from "../../components/ui";
export default function Story() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const { refresh } = st;
  const story = st.data?.stories.find((s) => s.id === id);
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <Page>
      <Header back title="A fleeting moment." eyebrow="JUST BETWEEN MATCHES" />
      {story && new Date(story.expires_at) > new Date() ? (
        <>
          <View style={[s.row, { marginBottom: 20 }]}>
            <Avatar person={story.author} />
            <View>
              <Text style={s.h2}>{story.author.name}</Text>
              <Text style={s.small}>
                Expires{" "}
                {new Date(story.expires_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
          {story.media_id && <Media id={story.media_id} kind={story.kind} />}
          <View
            style={[
              s.card,
              { backgroundColor: story.author.color, padding: 30 },
            ]}
          >
            <Text style={[s.title, { fontSize: 28, lineHeight: 37 }]}>
              {story.body}
            </Text>
          </View>
          {story.author.id === st.data?.me.id ? (
            <Button
              title="Delete story"
              secondary
              onPress={() =>
                st
                  .request(`/stories/${id}`, {}, "DELETE")
                  .then(refresh)
                  .then(() => router.back())
                  .catch((e) => st.toast(e.message))
              }
            />
          ) : (
            <Button
              title="Start a conversation"
              onPress={() => router.push(`/chat/${story.author.id}`)}
            />
          )}
        </>
      ) : (
        <Empty
          title="This moment has passed"
          body="Stories are visible for 24 hours, only while you are mutually matched."
        />
      )}
    </Page>
  );
}
