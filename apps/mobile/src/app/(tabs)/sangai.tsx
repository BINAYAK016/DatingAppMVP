import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  Text,
  View,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Avatar, Button, C, Empty, Header, Icon, s } from "../../components/ui";
import { PostCard } from "../../components/PostCard";
import { useStore } from "../../lib/store";
import { Post } from "../../lib/types";

export default function Sangai() {
  const { token } = useStore();
  return <SangaiFeed key={token || "signed-out"} />;
}
function SangaiFeed() {
  const st = useStore();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  const [viewabilityConfig] = useState(() => ({
    itemVisiblePercentThreshold: 65,
    minimumViewTime: 250,
  }));
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Post>[] }) =>
      setActiveId(viewableItems[0]?.item.id || null),
    [],
  );
  const refreshState = st.refresh;
  const [older, setOlder] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const busy = useRef(false);
  const epoch = useRef(0);
  const initial = st.data?.feed || [];
  const posts = [
    ...new Map([...initial, ...older].map((p) => [p.id, p])).values(),
  ].filter(
    (p) =>
      p.author.id === st.data?.me.id ||
      st.data?.matches.some((m) => m.id === p.author.id),
  );
  const refresh = useCallback(async () => {
    epoch.current++;
    setOlder([]);
    setFinished(false);
    setRefreshing(true);
    try {
      await refreshState();
    } finally {
      setRefreshing(false);
    }
  }, [refreshState]);
  const more = async () => {
    if (busy.current || finished || !posts.length || initial.length < 30)
      return;
    busy.current = true;
    setLoading(true);
    const started = epoch.current;
    const last = posts[posts.length - 1];
    try {
      const result = await st.request<Post[]>(
        `/feed?before=${encodeURIComponent(last.created_at)}&beforeId=${last.id}`,
      );
      if (started === epoch.current) {
        setOlder((p) => [
          ...new Map([...p, ...result].map((x) => [x.id, x])).values(),
        ]);
        setFinished(result.length < 30);
      }
    } catch (e: any) {
      st.toast(e.message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            active={item.id === activeId && focused && foreground}
          />
        )}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        windowSize={5}
        onEndReached={() => void more()}
        onEndReachedThreshold={0.4}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        ListHeaderComponent={
          <>
            <Header title="Sangai" eyebrow="MORE TO KNOW. MORE TO SHARE." />
            <Text style={[s.body, { marginBottom: 20 }]}>
              A little window into your matches’ everyday.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a Sangai post"
              onPress={() =>
                router.push({ pathname: "/compose", params: { kind: "post" } })
              }
              style={[s.card, s.row]}
            >
              <Avatar person={st.data?.me || {}} size={40} />
              <Text style={[s.body, { flex: 1 }]}>
                What’s your little moment?
              </Text>
              <Icon name="images-outline" />
            </Pressable>
            <View style={[s.row, { marginBottom: 18 }]}>
              <Icon name="lock-closed-outline" size={13} />
              <Text style={s.small}>
                Shared only with current mutual matches
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <>
            <Empty
              title="Your shared space starts small"
              body="Moments from you and your matches will appear here. Discover someone to start a connection."
            />
            <Button
              title="Discover people"
              onPress={() => router.navigate("/(tabs)")}
            />
          </>
        }
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color={C.primary} />
          ) : posts.length > 0 ? (
            <Text
              style={[s.small, { textAlign: "center", marginVertical: 20 }]}
            >
              {finished || initial.length < 30
                ? "You’re caught up with your matches."
                : "More moments below"}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
