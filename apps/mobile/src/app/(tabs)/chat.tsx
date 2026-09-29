import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  C,
  Empty,
  Header,
  Icon,
  Page,
  Section,
  s,
} from "../../components/ui";
import { useStore } from "../../lib/store";

export default function ChatList() {
  const { data } = useStore();
  if (!data) return null;
  const authors = [
    ...new Map(data.stories.map((story) => [story.author.id, story])).values(),
  ];
  return (
    <Page refresh>
      <Header title="Chat" eyebrow="A LITTLE CLOSER" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 18, paddingBottom: 16 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add your story"
          style={{ alignItems: "center", gap: 8 }}
          onPress={() =>
            router.push({ pathname: "/compose", params: { kind: "story" } })
          }
        >
          <View
            style={{
              width: 62,
              height: 62,
              borderRadius: 31,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: C.blush,
              borderWidth: 1,
              borderColor: C.line,
            }}
          >
            <Icon name="add" size={26} />
          </View>
          <Text style={s.small}>Your story</Text>
        </Pressable>
        {authors.map((story) => (
          <Pressable
            key={story.author.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${story.author.name}'s story`}
            style={{ alignItems: "center", gap: 8 }}
            onPress={() => router.push(`/story/${story.id}`)}
          >
            <View
              style={{
                borderWidth: 2,
                borderColor: C.primary,
                padding: 3,
                borderRadius: 34,
              }}
            >
              <Avatar person={story.author} size={54} />
            </View>
            <Text style={s.small}>{story.author.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={[s.small, { marginBottom: 8 }]}>
        Stories last 24 hours and are visible only to your current matches.
      </Text>
      <Section
        title="Your conversations"
        aside={`${data.matches.length} matches`}
      />
      {data.matches.length ? (
        data.matches.map((person) => (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${person.name}`}
            onPress={() => router.push(`/chat/${person.id}`)}
            style={[s.card, s.row]}
          >
            <Avatar person={person} size={55} />
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>{person.name}</Text>
              <Text style={[s.small, { marginTop: 5 }]} numberOfLines={1}>
                {person.preview || "Send a hello, share a moment."}
              </Text>
            </View>
            {!!person.unread && <Text style={s.tag}>{person.unread} new</Text>}
            <Icon name="chevron-forward" size={18} />
          </Pressable>
        ))
      ) : (
        <>
          <Empty
            icon="chatbubbles-outline"
            title="Your next hello starts with a match"
            body="When you both choose each other, your conversation opens here."
          />
          <Button
            title="Discover people"
            onPress={() => router.navigate("/(tabs)")}
          />
        </>
      )}
    </Page>
  );
}
