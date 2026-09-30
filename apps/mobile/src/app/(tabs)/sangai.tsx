import React, { useCallback, useRef, useState } from "react";
import { FlatList, Text, View, ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Button,
  C,
  Empty,
  Header,
  Icon,
  IconButton,
  Skeleton,
  s,
} from "../../components/ui";
import { PostCard } from "../../components/PostCard";
import { useStore } from "../../lib/store";
import { Post } from "../../lib/types";
import { useMediaVisible } from "../../lib/useMediaVisible";

export default function Sangai() {
  const { token } = useStore();
  return <SangaiFeed key={token || "signed-out"} />;
}
function SangaiFeed() {
  const st = useStore();
  const visible = useMediaVisible();
  const [activeId, setActiveId] = useState<string | null>(null);
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
          <PostCard post={item} active={item.id === activeId && visible} />
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
          <View style={{ marginBottom: 24 }}>
            <Header
              title="Sangai"
              action={
                <IconButton
                  name="add"
                  label="Create a Sangai post"
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
            <View style={[s.row, { gap: 6 }]}>
              <Icon name="lock-closed-outline" size={13} color={C.muted} />
              <Text style={s.small}>
                Little moments, shared with your matches.
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          !st.data ? (
            <View style={{ gap: 20 }}>
              <Skeleton height={320} />
              <Skeleton height={180} />
            </View>
          ) : (
            <>
              <Empty
                icon="flower-outline"
                title="A little quiet, for now"
                body="Share a little of your everyday. Moments from you and your matches will appear here."
              />
              <Button
                title="Share a moment"
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: { kind: "post" },
                  })
                }
              />
            </>
          )
        }
        ListFooterComponent={
          loading ? (
            <Skeleton height={120} />
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
