import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import type { Person } from "../lib/types";
import { Avatar, Button, C, Icon, s } from "./ui";

// A ring means an accessible story exists, never online/play availability.
export function MatchStrip({ inbox = false }: { inbox?: boolean }) {
  const st = useStore(),
    data = st.data;
  if (!data) return null;
  const available = data.stories.filter(
    (story) => new Date(story.expires_at) > new Date(),
  );
  const authors = available.filter(
    (story, index, all) =>
      all.findIndex((candidate) => candidate.author.id === story.author.id) ===
      index,
  );
  const people: { person: Person; storyId?: string }[] = authors.length
    ? authors.map((story) => ({ person: story.author, storyId: story.id }))
    : inbox
      ? data.matches
          .slice(0, 8)
          .map((person) => ({ person, storyId: undefined }))
      : [];
  return (
    <View style={styles.section}>
      <Text style={[s.label, { marginBottom: 10 }]}>
        {inbox
          ? authors.length
            ? "Matches & moments"
            : "Your matches"
          : "Stories"}
      </Text>
      <FlatList
        horizontal
        data={people}
        keyExtractor={(item) => item.person.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={3}
        ListHeaderComponent={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add your story"
            onPress={() =>
              router.push({ pathname: "/compose", params: { kind: "story" } })
            }
            style={styles.person}
          >
            <View style={styles.add}>
              <Avatar person={data.me} size={46} />
              <View style={styles.plus}>
                <Icon name="add" size={12} color={C.white} />
              </View>
            </View>
            <Text style={styles.name}>Your story</Text>
          </Pressable>
        }
        ListFooterComponent={
          data.storiesNextCursor ? (
            <Button
              title="More stories"
              compact
              secondary
              onPress={() =>
                void st
                  .loadMoreStories()
                  .catch((error) => st.toast(error.message))
              }
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              item.storyId
                ? `View ${item.person.name}'s story`
                : `Open conversation with ${item.person.name}`
            }
            style={styles.person}
            onPress={() => {
              if (item.storyId) {
                const first = available
                  .filter((story) => story.author.id === item.person.id)
                  .sort((a, b) => a.expires_at.localeCompare(b.expires_at))[0];
                if (first) router.push(`/story/${first.id}`);
              } else router.push(`/chat/${item.person.id}`);
            }}
          >
            <View
              style={[
                styles.ring,
                !!item.storyId && { borderColor: C.primary },
              ]}
            >
              <Avatar person={item.person} size={46} />
            </View>
            <Text numberOfLines={1} style={styles.name}>
              {item.person.id === data.me.id ? "You" : item.person.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  section: { paddingTop: 4, paddingBottom: 16 },
  person: { width: 62, alignItems: "center", gap: 6 },
  ring: {
    borderWidth: 1.5,
    borderColor: "transparent",
    padding: 3,
    borderRadius: 28,
  },
  add: { width: 55, height: 55, padding: 4 },
  plus: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 11, lineHeight: 16, color: C.muted, textAlign: "center" },
});
