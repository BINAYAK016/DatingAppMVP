import React, { useCallback, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  Button,
  C,
  Empty,
  Header,
  IconButton,
  Skeleton,
  s,
} from "../components/ui";
import { PostCard } from "../components/PostCard";
import { useStore } from "../lib/store";
import { Post } from "../lib/types";

export default function MyPosts() {
  const { token } = useStore();
  return <MyMoments key={token || "signed-out"} />;
}
function MyMoments() {
  const { request } = useStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const epoch = useRef(0);
  const load = useCallback(
    async (last?: Post) => {
      const run = ++epoch.current;
      setLoading(true);
      setError("");
      try {
        const page = await request<Post[]>(
          "/feed?scope=mine" +
            (last
              ? `&before=${encodeURIComponent(last.created_at)}&beforeId=${last.id}`
              : ""),
        );
        if (run !== epoch.current) return;
        setPosts((p) =>
          last
            ? [...new Map([...p, ...page].map((x) => [x.id, x])).values()]
            : page,
        );
        setFinished(page.length < 30);
      } catch (e: any) {
        if (run === epoch.current) setError(e.message);
      } finally {
        if (run === epoch.current) setLoading(false);
      }
    },
    [request],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        epoch.current++;
      };
    }, [load]),
  );
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={s.page}
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        windowSize={5}
        refreshing={loading && !posts.length}
        onRefresh={() => void load()}
        ListHeaderComponent={
          <>
            <Header
              back
              title="My moments"
              action={
                <IconButton
                  name="add"
                  label="Share a moment"
                  variant="soft"
                  onPress={() =>
                    router.push({
                      pathname: "/compose",
                      params: { kind: "post" },
                    })
                  }
                />
              }
            />
          </>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Empty
              title="A little moment goes a long way"
              body="Your posts will appear here. Only your current mutual matches can see them when sharing is on."
            />
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View style={{ gap: 16 }}>
              <Skeleton height={220} />
              <Skeleton height={140} />
            </View>
          ) : error ? (
            <>
              <Empty
                title="Let’s try that again"
                body="Your moments couldn’t load. Check your connection and try again."
              />
              <Button
                title="Try again"
                onPress={() => void load(posts.at(-1))}
              />
            </>
          ) : !finished ? (
            <Button
              title="Earlier moments"
              secondary
              onPress={() => void load(posts.at(-1))}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
