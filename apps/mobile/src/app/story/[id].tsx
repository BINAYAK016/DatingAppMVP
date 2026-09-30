import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../../lib/store";
import {
  Avatar,
  BottomSheet,
  Button,
  C,
  Empty,
  IconButton,
  Media,
  PrivateImage,
  s,
} from "../../components/ui";

export default function Story() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const { refresh } = st;
  const story = st.data?.stories.find((s) => s.id === id);
  const [options, setOptions] = useState(false);
  const moments = (st.data?.stories || [])
    .filter(
      (moment) =>
        moment.author.id === story?.author.id &&
        new Date(moment.expires_at) > new Date(),
    )
    .sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  const position = moments.findIndex((moment) => moment.id === id);
  const previous = moments[position - 1],
    next = moments[position + 1];
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/(tabs)/chat");
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      {story && new Date(story.expires_at) > new Date() ? (
        <>
          {moments.length > 1 && (
            <View
              style={styles.progress}
              accessibilityLabel={`Moment ${position + 1} of ${moments.length}`}
            >
              {moments.map((moment) => (
                <View
                  key={moment.id}
                  style={[
                    styles.segment,
                    moment.id === id && { backgroundColor: C.primary },
                  ]}
                />
              ))}
            </View>
          )}
          <View style={styles.header}>
            <Avatar person={story.author} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{story.author.name}</Text>
              <Text style={s.small}>
                Until{" "}
                {new Date(story.expires_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · just your matches
              </Text>
            </View>
            {story.author.id === st.data?.me.id && (
              <IconButton
                name="ellipsis-horizontal"
                label="Story options"
                onPress={() => setOptions(true)}
              />
            )}
            <IconButton name="close" label="Go back" onPress={back} />
          </View>
          <View style={styles.content}>
            {story.media_id ? (
              <>
                {story.kind === "video" ? (
                  <View style={styles.video}>
                    <Media
                      id={story.media_id}
                      kind={story.kind}
                      style={{
                        width: "100%",
                        height: "100%",
                        marginVertical: 0,
                        borderRadius: 0,
                      }}
                    />
                  </View>
                ) : (
                  <PrivateImage
                    id={story.media_id}
                    style={styles.photo}
                    resizeMode="contain"
                  />
                )}
                {!!story.body && (
                  <ScrollView
                    style={styles.caption}
                    contentContainerStyle={{
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                    }}
                  >
                    <Text style={styles.captionText}>{story.body}</Text>
                  </ScrollView>
                )}
              </>
            ) : (
              <LinearGradient
                colors={[C.peach, C.blush, C.lavender]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.textMoment}
              >
                <ScrollView
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "center",
                    padding: 28,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.quote}>{story.body}</Text>
                </ScrollView>
              </LinearGradient>
            )}
          </View>
          <View style={styles.footer}>
            {moments.length > 1 && (
              <IconButton
                name="chevron-back"
                label="Previous story"
                disabled={!previous}
                onPress={() =>
                  previous && router.replace(`/story/${previous.id}`)
                }
              />
            )}
            <View style={{ flex: 1 }}>
              {story.author.id === st.data?.me.id ? (
                <Text style={[s.small, { textAlign: "center" }]}>
                  A little window into your everyday.
                </Text>
              ) : (
                <Button
                  title="Start a conversation"
                  secondary
                  icon="chatbubble-outline"
                  onPress={() => router.push(`/chat/${story.author.id}`)}
                />
              )}
            </View>
            {moments.length > 1 && (
              <IconButton
                name="chevron-forward"
                label="Next story"
                disabled={!next}
                onPress={() => next && router.replace(`/story/${next.id}`)}
              />
            )}
          </View>
          <BottomSheet
            visible={options}
            onClose={() => setOptions(false)}
            title="Your story"
          >
            <Button
              title="Delete story"
              secondary
              icon="trash-outline"
              onPress={() =>
                st
                  .request(`/stories/${id}`, {}, "DELETE")
                  .then(refresh)
                  .then(() => {
                    setOptions(false);
                    router.back();
                  })
                  .catch((e) => st.toast(e.message))
              }
            />
          </BottomSheet>
        </>
      ) : (
        <>
          <View style={[styles.header, { justifyContent: "flex-end" }]}>
            <IconButton name="close" label="Go back" onPress={back} />
          </View>
          <View style={styles.expired}>
            <Empty
              title="This moment has passed"
              body="Stories are here for 24 hours. There will be more little moments to share."
            />
            <Button title="Back to Chat" onPress={back} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
  },
  name: { fontSize: 16, color: C.ink, fontWeight: "600", marginBottom: 3 },
  content: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: C.blush,
  },
  photo: { flex: 1, width: "100%", minHeight: 200 },
  video: { flex: 1, justifyContent: "center", padding: 8 },
  caption: { maxHeight: 160, flexGrow: 0, backgroundColor: C.white },
  captionText: { fontSize: 17, lineHeight: 25, color: C.ink },
  textMoment: { flex: 1 },
  quote: {
    fontSize: 29,
    lineHeight: 39,
    color: C.ink,
    fontWeight: "500",
    letterSpacing: -0.5,
  },
  footer: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progress: { flexDirection: "row", gap: 4, paddingTop: 10 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.line },
  expired: { flex: 1, justifyContent: "center", paddingHorizontal: 8 },
});
