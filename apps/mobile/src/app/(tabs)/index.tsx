import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import {
  Avatar,
  Banner,
  Button,
  C,
  Chip,
  Empty,
  Header,
  Icon,
  Page,
  Section,
  s,
} from "../../components/ui";
import { useStore } from "../../lib/store";
import { PostCard } from "../../components/PostCard";
import { State } from "../../lib/types";
export default function Together() {
  const { data, request, toast } = useStore();
  const [filter, setFilter] = useState("All moments");
  const [cursors, setCursors] = useState<string[]>([]);
  const [older, setOlder] = useState<State["feed"]>([]);
  const cursor = cursors.at(-1);
  useEffect(() => {
    if (!cursor) return;
    let active = true;
    request<State["feed"]>("/feed?" + cursor)
      .then((p) => {
        if (active) setOlder(p);
      })
      .catch((e) => {
        if (active) {
          setOlder([]);
          toast(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [cursor, data, request, toast]);
  if (!data) return null;
  const page = (cursor ? older : data.feed).filter(
    (p) =>
      p.author.id === data.me.id ||
      data.matches.some((m) => m.id === p.author.id),
  );
  const filtered = page.filter((p) =>
    filter === "Short videos"
      ? p.kind === "video"
      : filter === "Following"
        ? data.matches.some((m) => m.id === p.author.id && m.followed)
        : true,
  );
  return (
    <Page refresh>
      <Header
        title="Better, together."
        eyebrow={`NAMASTE, ${data.me.name.toUpperCase()}`}
      />
      <Banner
        title={"Your people.\nYour little world."}
        body="Stories, small joys, and the people who choose you back."
        emoji="✳"
      />
      <Section title="In the moment" aside="Just your matches" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 19, paddingBottom: 8 }}
      >
        <Pressable
          onPress={() =>
            router.push({ pathname: "/compose", params: { kind: "story" } })
          }
          style={{ alignItems: "center", gap: 8 }}
        >
          <View
            style={{
              height: 64,
              width: 64,
              borderRadius: 32,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: C.green,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="add" />
          </View>
          <Text style={s.small}>Your story</Text>
        </Pressable>
        {data.stories.map((story) => (
          <Pressable
            key={story.id}
            onPress={() => router.push(`/story/${story.id}`)}
            style={{ alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                padding: 3,
                borderRadius: 35,
                borderWidth: 2,
                borderColor: "#B5C47E",
              }}
            >
              <Avatar person={story.author} size={54} />
            </View>
            <Text style={s.small}>{story.author.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        onPress={() =>
          router.push({ pathname: "/compose", params: { kind: "post" } })
        }
        style={[s.card, s.row, { marginTop: 18, padding: 14 }]}
      >
        <Avatar person={data.me} size={38} />
        <Text style={[s.body, { flex: 1 }]}>A moment worth sharing?</Text>
        <Icon name="images-outline" color={C.green} />
      </Pressable>
      <View style={[s.wrap, { marginBottom: 18 }]}>
        {["All moments", "Following", "Short videos"].map((label) => (
          <Chip
            key={label}
            label={label}
            selected={filter === label}
            onPress={() => setFilter(label)}
          />
        ))}
      </View>
      {filtered.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {!filtered.length && (
        <Empty
          title="A little quiet here"
          body="Your social world opens up with mutual matches. Share a moment or discover someone new."
        />
      )}
      <View style={[s.row, { marginVertical: 12 }]}>
        {!!cursor && (
          <View style={{ flex: 1 }}>
            <Button
              title="Newer moments"
              secondary
              onPress={() => {
                setOlder([]);
                setCursors((c) => c.slice(0, -1));
              }}
            />
          </View>
        )}
        {page.length === 30 && (
          <View style={{ flex: 1 }}>
            <Button
              title="Older moments"
              secondary
              onPress={() => {
                const last = page[page.length - 1];
                setOlder([]);
                setCursors((c) => [
                  ...c,
                  `before=${encodeURIComponent(last.created_at)}&beforeId=${last.id}`,
                ]);
              }}
            />
          </View>
        )}
      </View>
      <View style={[s.row, { alignSelf: "center", marginTop: 12 }]}>
        <Icon name="lock-closed-outline" size={12} />
        <Text style={s.small}>Your community starts with mutual consent.</Text>
      </View>
    </Page>
  );
}
