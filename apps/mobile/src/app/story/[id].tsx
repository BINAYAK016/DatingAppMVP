import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useStore } from "../../lib/store";
import { StoryPlayer } from "../../components/StoryPlayer";
import {
  Avatar,
  BottomSheet,
  Button,
  C,
  Empty,
  IconButton,
  Skeleton,
  s,
} from "../../components/ui";

export default function Story() {
  const { id: entryId, moment } = useLocalSearchParams<{
    id: string;
    moment?: string;
  }>();
  const id = moment || entryId;
  const st = useStore();
  const { refresh } = st;
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [options, setOptions] = useState(false);
  const [held, setHeld] = useState(false);
  const [reading, setReading] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const [ready, setReady] = useState(false);
  const [replay, setReplay] = useState(0);
  const [progress, setProgress] = useState<{
    id: string;
    value: number;
  } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const story = st.data?.stories.find((moment) => moment.id === id);
  const now = clock;
  const valid = !!story && new Date(story.expires_at).getTime() > now;
  const moments = (st.data?.stories || [])
    .filter(
      (moment) =>
        moment.author.id === story?.author.id &&
        new Date(moment.expires_at).getTime() > now,
    )
    .sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  const position = moments.findIndex((moment) => moment.id === id);
  const previous = moments[position - 1];
  const next = moments[position + 1];
  const nextId = next?.id;
  const previousId = previous?.id;
  const paused = options || held || reading || manualPause;
  const active = focused && foreground && !!st.token;
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/chat");
  }, []);
  const go = useCallback((momentId?: string) => {
    if (!momentId) return;
    setHeld(false);
    setReading(false);
    setManualPause(false);
    setOptions(false);
    setReady(false);
    setProgress({ id: momentId, value: 0 });
    // Search params preserve this route; changing [id] would remount its players.
    router.setParams({ moment: momentId });
  }, []);
  const advance = () => (nextId ? go(nextId) : back());
  const rewind = () => {
    if (previousId) go(previousId);
    else {
      setReplay((value) => value + 1);
      go(id);
    }
  };
  const reportProgress = useCallback(
    (value: number) => setProgress({ id, value }),
    [id],
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      if (state === "active") setClock(Date.now());
      if (state !== "active") {
        setHeld(false);
        setReading(false);
      }
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!active) return;
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 10000);
    const tick = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      clearInterval(tick);
    };
  }, [active, refresh]);
  useEffect(() => {
    if (!story) return;
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.max(0, new Date(story.expires_at).getTime() - Date.now()) + 1,
    );
    return () => clearTimeout(timer);
  }, [story]);
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !reading &&
          gesture.dy > 12 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
        onPanResponderGrant: () => setHeld(true),
        onPanResponderRelease: (_, gesture) => {
          setHeld(false);
          if (gesture.dy > 64 || (gesture.dy > 24 && gesture.vy > 0.7)) back();
        },
        onPanResponderTerminate: () => setHeld(false),
      }),
    [back, reading],
  );
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      {story && valid ? (
        <>
          <View
            style={styles.progress}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Moment ${position + 1} of ${moments.length}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              (progress?.id === id ? progress.value : 0) * 100,
            )}
          >
            {moments.map((moment, index) => (
              <View key={moment.id} style={styles.segment}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${index < position ? 100 : index === position ? (progress?.id === id ? progress.value : 0) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.header}>
            <Avatar person={story.author} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>
                {story.author.name}
              </Text>
              <Text style={s.small}>Just your matches</Text>
            </View>
            <IconButton
              name={manualPause ? "play-outline" : "pause-outline"}
              label={manualPause ? "Resume story" : "Pause story"}
              onPress={() => setManualPause((value) => !value)}
            />
            {story.author.id === st.data?.me.id && (
              <IconButton
                name="ellipsis-horizontal"
                label="Story options"
                onPress={() => setOptions(true)}
              />
            )}
            <IconButton name="close" label="Go back" onPress={back} />
          </View>
          <View style={styles.content} {...swipe.panHandlers}>
            <StoryPlayer
              key={replay}
              item={story}
              next={next}
              active={active}
              paused={paused}
              onReady={setReady}
              onProgress={reportProgress}
              onEnd={advance}
              onSkip={advance}
            >
              <LinearGradient
                colors={[C.peach, C.blush, C.lavender]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.textMoment}
              >
                <ScrollView
                  onTouchStart={() => setReading(true)}
                  onTouchEnd={() => setReading(false)}
                  onTouchCancel={() => setReading(false)}
                  contentContainerStyle={styles.textContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.quote}>{story.body}</Text>
                </ScrollView>
              </LinearGradient>
            </StoryPlayer>
            <View
              pointerEvents={ready && active ? "box-none" : "none"}
              style={[
                styles.gestures,
                !story.media_id && { bottom: "35%" },
                story.kind === "video" && Platform.OS === "web" && { top: 60 },
              ]}
            >
              <StoryTap
                label="Previous story"
                onTap={rewind}
                onHold={setHeld}
              />
              <StoryTap label="Next story" onTap={advance} onHold={setHeld} />
            </View>
            {ready && !!story.media_id && !!story.body && (
              <ScrollView
                style={styles.caption}
                onTouchStart={() => setReading(true)}
                onTouchEnd={() => setReading(false)}
                onTouchCancel={() => setReading(false)}
                onScrollBeginDrag={() => setReading(true)}
                onMomentumScrollEnd={() => setReading(false)}
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                }}
              >
                <Text style={styles.captionText}>{story.body}</Text>
              </ScrollView>
            )}
          </View>
          {story.author.id !== st.data?.me.id && (
            <View style={styles.footer}>
              <Button
                title="Start a conversation"
                secondary
                icon="chatbubble-outline"
                onPress={() => router.push(`/chat/${story.author.id}`)}
              />
            </View>
          )}
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
                    back();
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
            {!st.data ? (
              <Skeleton height={280} />
            ) : (
              <Empty
                title={
                  story ? "This moment has passed" : "This story is unavailable"
                }
                body={
                  story
                    ? "Stories are here for 24 hours. There will be more little moments to share."
                    : "It may have expired or is no longer shared with you."
                }
              />
            )}
            <Button title="Back to Chat" onPress={back} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function StoryTap({
  label,
  onTap,
  onHold,
}: {
  label: string;
  onTap: () => void;
  onHold: (value: boolean) => void;
}) {
  const long = useRef(false);
  return (
    <Pressable
      style={{ flex: 1 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Tap to navigate. Hold to pause."
      delayLongPress={180}
      onPressIn={() => {
        long.current = false;
        onHold(true);
      }}
      onLongPress={() => {
        long.current = true;
      }}
      onPressOut={() => onHold(false)}
      onPress={() => {
        if (!long.current) onTap();
      }}
    />
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  name: { fontSize: 16, color: C.ink, fontWeight: "600", marginBottom: 2 },
  content: { flex: 1, overflow: "hidden", backgroundColor: C.blush },
  gestures: { ...StyleSheet.absoluteFill, bottom: 60, flexDirection: "row" },
  caption: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "30%",
    flexGrow: 0,
    backgroundColor: "rgba(255,251,248,0.94)",
  },
  captionText: { fontSize: 16, lineHeight: 24, color: C.ink },
  textMoment: { flex: 1 },
  textContent: { flexGrow: 1, justifyContent: "center", padding: 28 },
  quote: {
    fontSize: 28,
    lineHeight: 38,
    color: C.ink,
    fontWeight: "500",
    letterSpacing: -0.5,
  },
  footer: { paddingHorizontal: 16, paddingVertical: 10 },
  progress: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.line,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: C.primary },
  expired: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
});
