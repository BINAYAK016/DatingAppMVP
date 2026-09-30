import React, { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  C,
  Empty,
  Header,
  Icon,
  s,
  Skeleton,
} from "../../components/ui";
import { useStore } from "../../lib/store";

export default function ChatList() {
  const { data, refresh } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const authors = (data?.stories || []).filter(
    (story, index, all) =>
      all.findIndex((candidate) => candidate.author.id === story.author.id) ===
      index,
  );
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={data?.matches || []}
        keyExtractor={(person) => person.id}
        contentContainerStyle={[s.page, { paddingBottom: 32 }]}
        initialNumToRender={7}
        maxToRenderPerBatch={5}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void refresh().finally(() => setRefreshing(false));
        }}
        ListHeaderComponent={
          <>
            <Header title="Chat" />
            {data ? (
              <FlatList
                horizontal
                data={authors}
                keyExtractor={(story) => story.author.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stories}
                initialNumToRender={5}
                maxToRenderPerBatch={3}
                windowSize={3}
                ListHeaderComponent={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add your story"
                    style={styles.story}
                    onPress={() =>
                      router.push({
                        pathname: "/compose",
                        params: { kind: "story" },
                      })
                    }
                  >
                    <View style={styles.addStory}>
                      <Avatar person={data.me} size={60} />
                      <View style={styles.plus}>
                        <Icon name="add" size={15} color={C.white} />
                      </View>
                    </View>
                    <Text style={styles.storyName}>Your story</Text>
                  </Pressable>
                }
                renderItem={({ item: story }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${story.author.name}'s story`}
                    style={styles.story}
                    onPress={() => router.push(`/story/${story.id}`)}
                  >
                    <View style={styles.ring}>
                      <Avatar person={story.author} size={60} />
                    </View>
                    <Text style={styles.storyName} numberOfLines={1}>
                      {story.author.id === data.me.id
                        ? "You"
                        : story.author.name}
                    </Text>
                  </Pressable>
                )}
              />
            ) : (
              <Skeleton height={88} />
            )}
            {!!data && !authors.length && (
              <Text style={styles.storyHint}>
                Your matches’ moments will appear here.
              </Text>
            )}
            <View style={styles.section}>
              <Text style={s.h2}>Conversations</Text>
              <Icon name="lock-closed-outline" size={14} color={C.muted} />
            </View>
          </>
        }
        renderItem={({ item: person }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${person.name}`}
            onPress={() => router.push(`/chat/${person.id}`)}
            style={({ pressed }) => [
              styles.conversation,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Avatar person={person} size={62} />
            <View style={styles.preview}>
              <Text
                style={[styles.name, !!person.unread && { fontWeight: "600" }]}
              >
                {person.name}
              </Text>
              <Text
                style={[
                  styles.lastMessage,
                  !!person.unread && { color: C.ink },
                ]}
                numberOfLines={1}
              >
                {person.preview || "A new connection. Say hello."}
              </Text>
            </View>
            {!!person.unread && (
              <View
                style={styles.unread}
                accessibilityLabel={`${person.unread} unread messages`}
              >
                <Text style={styles.unreadText}>
                  {person.unread > 99 ? "99+" : person.unread}
                </Text>
              </View>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          !data ? (
            <View style={{ gap: 16 }}>
              <Skeleton height={76} />
              <Skeleton height={76} />
              <Skeleton height={76} />
            </View>
          ) : (
            <>
              <Empty
                icon="chatbubbles-outline"
                title="Your next hello starts here"
                body="When you both choose each other, your conversation opens here."
              />
              <Button
                title="Discover people"
                onPress={() => router.navigate("/(tabs)")}
              />
            </>
          )
        }
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  stories: { gap: 18, paddingTop: 4, paddingBottom: 20 },
  story: { alignItems: "center", gap: 8, width: 72 },
  storyName: { fontSize: 13, color: C.ink, textAlign: "center" },
  addStory: { padding: 4, width: 70, height: 70 },
  plus: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: C.primary,
    borderWidth: 3,
    borderColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    right: 0,
    bottom: 1,
  },
  ring: {
    borderWidth: 2,
    borderColor: C.primary,
    padding: 3,
    borderRadius: 36,
  },
  storyHint: { color: C.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 8,
  },
  conversation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 92,
    paddingVertical: 14,
  },
  preview: { flex: 1, gap: 5 },
  name: { fontSize: 17, fontWeight: "500", color: C.ink },
  lastMessage: { fontSize: 13, lineHeight: 20, color: C.muted },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.primary,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { fontSize: 11, color: C.white, fontWeight: "600" },
});
