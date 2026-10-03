import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  StyleSheet,
  View,
  ViewToken,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConversationItem } from "../../components/ConversationItem";
import { StoryPlayer } from "../../components/StoryPlayer";
import { useStore } from "../../lib/store";
import { consumeGameConversation } from "../../lib/gameChatBridge";
import {
  Avatar,
  Button,
  C,
  Empty,
  BottomSheet,
  IconButton,
  Icon,
  PrivateImage,
  Skeleton,
  s,
} from "../../components/ui";
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  return <ChatScreen key={`${id}:${st.sessionKey}`} id={id} />;
}
function ChatScreen({ id }: { id: string }) {
  const st = useStore();
  const { request } = st;
  const [chat, setChat] = useState<any>(null),
    [error, setError] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [snap, setSnap] = useState<any>(null),
    [attachments, setAttachments] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [more, setMore] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bodyRef = useRef(body);
  useEffect(() => {
    bodyRef.current = body;
  }, [body]);
  const account = st.data?.me.id;
  const conversationScroll = useRef<FlatList<any>>(null);
  const accessGeneration = useRef(0);
  const mounted = useRef(true),
    focused = useRef(false);
  const followNewest = useRef(true);
  const userScrolling = useRef(false);
  const [followSentId, setFollowSentId] = useState<string | null>(null);
  const sentFollow = useRef<{
    id: string;
    generation: number;
    ready: boolean;
  } | null>(null);
  const cancelSentFollow = useCallback(() => {
    sentFollow.current = null;
    if (mounted.current) setFollowSentId(null);
  }, []);
  const [sentViewability] = useState(() => ({
    viewAreaCoveragePercentThreshold: 1,
  }));
  const trackVisibleSent = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<any>[] }) => {
      const intent = sentFollow.current;
      if (
        mounted.current &&
        focused.current &&
        intent?.ready &&
        intent.generation === accessGeneration.current &&
        viewableItems.some(
          (item) => item.isViewable && item.item.id === intent.id,
        )
      ) {
        followNewest.current = true;
        cancelSentFollow();
      }
    },
    [cancelSentFollow],
  );
  const followEnd = useCallback(() => {
    const generation = accessGeneration.current;
    if (
      (!sentFollow.current?.ready && !followNewest.current) ||
      userScrolling.current
    )
      return;
    requestAnimationFrame(() => {
      // Wait for the committed list and its anchor/layout work. Content growth
      // is allowed to change ordinary follow state, but cannot cancel a send.
      requestAnimationFrame(() => {
        if (
          !mounted.current ||
          !focused.current ||
          AppState.currentState !== "active" ||
          generation !== accessGeneration.current ||
          userScrolling.current
        )
          return;
        const explicit =
          sentFollow.current?.ready &&
          sentFollow.current.generation === generation;
        if (!explicit && !followNewest.current) return;
        conversationScroll.current?.scrollToEnd({ animated: false });
        // Keep the explicit intent through virtualized cell measurement. The
        // viewability callback clears it only when the actual sent row appears.
      });
    });
  }, []);
  const trackScroll = (nativeEvent: {
    contentSize: { height: number };
    layoutMeasurement: { height: number };
    contentOffset: { y: number };
  }) => {
    if (sentFollow.current?.ready) return;
    followNewest.current =
      nativeEvent.contentSize.height -
        nativeEvent.layoutMeasurement.height -
        nativeEvent.contentOffset.y <
      100;
  };
  const pending = useRef<{ text: string; id: string } | null>(null);
  const loadSequence = useRef(0);
  const loadFailures = useRef(0);
  const initialLoad = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const invalidateAccess = useCallback(
    (e: any) => {
      if (
        ![401, 403, 404].includes(e.status) &&
        e.name !== "SessionChangedError"
      )
        return;
      accessGeneration.current++;
      cancelSentFollow();
      setChat(null);
      setHistory([]);
      setSnap(null);
      setBody("");
      pending.current = null;
      setAttachments(false);
    },
    [cancelSentFollow],
  );
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const generation = accessGeneration.current;
    try {
      const next = await request(`/chat/${id}`);
      if (
        !mounted.current ||
        sequence !== loadSequence.current ||
        generation !== accessGeneration.current
      )
        return false;
      if (initialLoad.current) {
        initialLoad.current = false;
        const newest = next.timeline.at(-1);
        if (newest) {
          // Like an explicit Send, initial entry must survive estimated cell
          // heights and layout scroll events until its target is visible.
          sentFollow.current = {
            id: newest.id,
            generation,
            ready: false,
          };
          setFollowSentId(newest.id);
        }
      }
      setChat(next);
      setError("");
      loadFailures.current = 0;
      return true;
    } catch (e: any) {
      if (
        !mounted.current ||
        sequence !== loadSequence.current ||
        generation !== accessGeneration.current
      )
        return false;
      loadFailures.current++;
      setError(e.message);
      invalidateAccess(e);
      return false;
    }
  }, [id, request, invalidateAccess]);
  useEffect(() => {
    const intent = sentFollow.current;
    if (
      !intent ||
      intent.id !== followSentId ||
      intent.generation !== accessGeneration.current ||
      !chat?.timeline.some((item: any) => item.id === intent.id)
    )
      return;
    intent.ready = true;
    followEnd();
  }, [chat, followSentId, followEnd]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (account) {
        const starter = consumeGameConversation(account, id, st.url);
        if (starter && !bodyRef.current.trim()) setBody(starter);
      }
      let alive = true,
        generation = 0;
      let timer: ReturnType<typeof setTimeout>;
      const poll = async (current: number) => {
        if (AppState.currentState === "active") await load();
        if (alive && current === generation)
          timer = setTimeout(
            () => void poll(current),
            Math.min(30000, 3000 * 2 ** Math.min(loadFailures.current, 3)),
          );
      };
      timer = setTimeout(() => void poll(generation), 0);
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          clearTimeout(timer);
          void poll(++generation);
        }
      });
      return () => {
        focused.current = false;
        cancelSentFollow();
        alive = false;
        generation++;
        clearTimeout(timer);
        listener.remove();
      };
    }, [load, account, id, st.url, cancelSentFollow]),
  );
  const close = useCallback(async () => {
    if (snap) {
      const old = snap;
      setSnap(null);
      await request(`/snaps/${old.id}/close`, {}).catch(() => {});
      void load();
    }
  }, [snap, request, load]);
  useEffect(() => {
    if (!snap) return;
    const t = setTimeout(
      () => void close(),
      Math.max(0, new Date(snap.viewUntil).getTime() - Date.now()),
    );
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") void close();
    });
    return () => {
      clearTimeout(t);
      listener.remove();
    };
  }, [snap, close]);
  const send = async () => {
    if (busy || !body.trim()) return;
    const generation = accessGeneration.current;
    setBusy(true);
    const message = body.trim();
    if (!pending.current || pending.current.text !== message)
      pending.current = {
        text: message,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    try {
      const sent = await request<{ id: string }>(`/chat/${id}`, {
        body: message,
        clientId: pending.current.id,
      });
      if (!mounted.current || generation !== accessGeneration.current) return;
      pending.current = null;
      setBody("");
      followNewest.current = true;
      sentFollow.current = { id: sent.id, generation, ready: false };
      setFollowSentId(sent.id);
      await load();
    } catch (e: any) {
      if (mounted.current && generation === accessGeneration.current) {
        const revoked =
          [401, 403, 404].includes(e.status) ||
          e.name === "SessionChangedError";
        if (revoked) invalidateAccess(e);
        st.toast(
          revoked ? e.message : e.message + " Your draft is still here.",
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const [options, setOptions] = useState(false);
  const timeline = chat
    ? [
        ...new Map(
          [...history, ...(chat?.timeline || [])].map((item: any) => [
            item.id,
            item,
          ]),
        ).values(),
      ].sort(
        (a: any, b: any) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      )
    : [];
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
      >
        <View style={styles.header}>
          <IconButton
            name="arrow-back"
            label="Go back"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/chat")
            }
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View profile"
            onPress={() => router.push(`/profile/${id}`)}
            style={styles.person}
          >
            <Avatar person={chat?.person || {}} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {chat?.person.name || "Conversation"}
              </Text>
              <Text style={styles.subtitle}>Just the two of you</Text>
            </View>
          </Pressable>
          <IconButton
            name="ellipsis-horizontal"
            label="Chat options"
            onPress={() => setOptions(true)}
          />
        </View>
        {chat && (
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderColor: C.line,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Play together"
              onPress={() =>
                router.push({ pathname: "/games", params: { target: id } })
              }
              style={[
                s.row,
                { minHeight: 40, justifyContent: "space-between" },
              ]}
            >
              <View style={s.row}>
                <Icon
                  name="game-controller-outline"
                  size={20}
                  color={C.primary}
                />
                <Text style={s.link}>Play together</Text>
              </View>
              <Text style={s.small}>Quick Play</Text>
            </Pressable>
          </View>
        )}
        <FlatList
          ref={conversationScroll}
          data={timeline}
          keyExtractor={(item) => item.id}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={7}
          viewabilityConfig={sentViewability}
          onViewableItemsChanged={trackVisibleSent}
          maintainVisibleContentPosition={
            followSentId ? undefined : { minIndexForVisible: 0 }
          }
          renderItem={({ item }) => (
            <ConversationItem
              item={item}
              target={id}
              reload={load}
              updateGame={(next) => {
                setHistory((old) =>
                  old.map((item) =>
                    item.id === next.id ? { ...item, ...next } : item,
                  ),
                );
                setChat(
                  (old: any) =>
                    old && {
                      ...old,
                      timeline: old.timeline.map((item: any) =>
                        item.id === next.id ? { ...item, ...next } : item,
                      ),
                    },
                );
              }}
              openSnap={async (snapId) => {
                const generation = accessGeneration.current;
                try {
                  const opened = await request(`/snaps/${snapId}/open`, {});
                  if (
                    !mounted.current ||
                    generation !== accessGeneration.current
                  )
                    return;
                  setSnap({
                    ...opened,
                    id: snapId,
                  });
                } catch (e: any) {
                  invalidateAccess(e);
                  st.toast(e.message);
                }
                void load();
              }}
            />
          )}
          onScrollBeginDrag={() => {
            cancelSentFollow();
            userScrolling.current = true;
          }}
          onScroll={({ nativeEvent }) => {
            if (Platform.OS === "web" || userScrolling.current)
              trackScroll(nativeEvent);
          }}
          onScrollEndDrag={({ nativeEvent }) => {
            trackScroll(nativeEvent);
            userScrolling.current = false;
          }}
          onMomentumScrollBegin={() => {
            cancelSentFollow();
            userScrolling.current = true;
          }}
          onMomentumScrollEnd={({ nativeEvent }) => {
            trackScroll(nativeEvent);
            userScrolling.current = false;
          }}
          scrollEventThrottle={100}
          onLayout={followEnd}
          onContentSizeChange={followEnd}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {error && !chat ? (
                <>
                  <Empty
                    icon="chatbubble-outline"
                    title="Let’s try that again"
                    body="Your conversation couldn’t load. Check your connection and try again."
                  />
                  <Button title="Retry" onPress={() => void load()} />
                </>
              ) : chat ? (
                <>
                  {!!error && (
                    <View style={{ gap: 8, paddingVertical: 12 }}>
                      <Text accessibilityRole="alert" style={s.small}>
                        Connection interrupted. Your conversation is still here.
                      </Text>
                      <Button
                        title="Reconnect"
                        secondary
                        onPress={() => void load()}
                      />
                    </View>
                  )}
                  {!chat.timeline.length && !history.length && (
                    <View style={styles.hello}>
                      <View
                        style={[
                          s.row,
                          { justifyContent: "center", marginBottom: 16 },
                        ]}
                      >
                        <Avatar person={st.data?.me || {}} size={56} />
                        <Icon
                          name="heart-outline"
                          color={C.primary}
                          size={20}
                        />
                        <Avatar person={chat.person} size={56} />
                      </View>
                      <Text style={[s.h2, { textAlign: "center" }]}>
                        A little hello goes a long way
                      </Text>
                      <Text
                        style={[s.body, { textAlign: "center", marginTop: 8 }]}
                      >
                        You chose each other. Start with something that feels
                        like you.
                      </Text>
                    </View>
                  )}
                  {chat.hasMore && more && (
                    <View style={{ paddingVertical: 16 }}>
                      <Button
                        title={
                          loadingHistory ? "Loading…" : "Earlier conversation"
                        }
                        secondary
                        disabled={loadingHistory}
                        onPress={async () => {
                          const generation = accessGeneration.current;
                          cancelSentFollow();
                          followNewest.current = false;
                          setLoadingHistory(true);
                          try {
                            const first = history[0] || chat.timeline[0];
                            const result = await request(
                              `/chat/${id}?before=${encodeURIComponent(first.created_at)}&beforeId=${first.id}`,
                            );
                            if (
                              !mounted.current ||
                              generation !== accessGeneration.current
                            )
                              return;
                            setHistory((old) => [...result.timeline, ...old]);
                            setMore(result.hasMore);
                          } catch (e: any) {
                            invalidateAccess(e);
                            st.toast(e.message);
                          } finally {
                            if (mounted.current) setLoadingHistory(false);
                          }
                        }}
                      />
                    </View>
                  )}
                </>
              ) : (
                <View style={{ gap: 14, paddingTop: 24 }}>
                  <Skeleton width="70%" height={54} />
                  <View style={{ alignItems: "flex-end" }}>
                    <Skeleton width="66%" height={74} />
                  </View>
                  <Skeleton width="78%" height={54} />
                </View>
              )}
            </>
          }
        />
        {chat && (
          <View style={styles.composer}>
            <IconButton
              name="add"
              label="Conversation actions"
              variant="soft"
              onPress={() => setAttachments(true)}
            />
            <TextInput
              accessibilityLabel="A thought, a question, a hello…"
              value={body}
              onChangeText={setBody}
              placeholder="A thought, a question, a hello…"
              placeholderTextColor={C.muted}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => void send()}
            />
            {body.trim() ? (
              <IconButton
                name="arrow-up"
                label="Send message"
                variant="primary"
                disabled={busy || !body.trim()}
                onPress={() => void send()}
              />
            ) : (
              <IconButton
                name="camera-outline"
                label="Chat camera"
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: { kind: "snap", target: id, camera: "photo" },
                  })
                }
              />
            )}
            {!!body.trim() && (
              <IconButton
                name="camera-outline"
                label="Chat camera"
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: { kind: "snap", target: id, camera: "photo" },
                  })
                }
              />
            )}
          </View>
        )}
      </KeyboardAvoidingView>
      <BottomSheet
        visible={attachments}
        onClose={() => setAttachments(false)}
        title="A little more together"
      >
        <View style={{ gap: 12 }}>
          <Button
            title="Photo or video"
            secondary
            icon="images-outline"
            onPress={() => {
              setAttachments(false);
              router.push({
                pathname: "/compose",
                params: { kind: "message", target: id },
              });
            }}
          />
          <Button
            title="Play together"
            secondary
            icon="dice-outline"
            onPress={() => {
              setAttachments(false);
              router.push({ pathname: "/games", params: { target: id } });
            }}
          />
          <Button
            title="Plan a Date"
            secondary
            icon="calendar-outline"
            onPress={() => {
              setAttachments(false);
              router.push({ pathname: "/plan", params: { target: id } });
            }}
          />
        </View>
      </BottomSheet>
      <BottomSheet
        visible={options}
        onClose={() => setOptions(false)}
        title="Conversation"
      >
        <View style={{ gap: 12 }}>
          <Button
            title="View profile"
            secondary
            icon="person-outline"
            onPress={() => {
              setOptions(false);
              router.push(`/profile/${id}`);
            }}
          />
          <Button
            title="Safety"
            secondary
            icon="shield-checkmark-outline"
            onPress={() => {
              setOptions(false);
              router.push({
                pathname: "/safety",
                params: { target: id, context: "chat" },
              });
            }}
          />
        </View>
      </BottomSheet>
      <Modal
        visible={!!snap}
        animationType="fade"
        onRequestClose={() => void close()}
      >
        <SafeAreaView style={styles.snap}>
          <View style={styles.snapHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>
                {chat?.person.name || "A moment for you"}
              </Text>
              <Text style={s.small}>View once · up to 30 seconds</Text>
            </View>
            <IconButton
              name="close"
              label="Close snap"
              onPress={() => void close()}
            />
          </View>
          {snap && chat && (
            <View style={styles.snapContent}>
              {snap.kind === "video" ? (
                <StoryPlayer
                  item={{
                    id: snap.id,
                    media_id: snap.mediaId,
                    kind: snap.kind,
                    body: "",
                  }}
                />
              ) : (
                <PrivateImage
                  id={snap.mediaId}
                  style={styles.snapPhoto}
                  resizeMode="contain"
                />
              )}
              {!!snap.caption && (
                <ScrollView style={{ maxHeight: 140, flexGrow: 0 }}>
                  <Text style={styles.snapCaption}>{snap.caption}</Text>
                </ScrollView>
              )}
            </View>
          )}
          <Text style={styles.snapHint}>
            Closing ends this viewing session.
          </Text>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minHeight: 48,
  },
  name: { fontSize: 17, fontWeight: "600", color: C.ink },
  subtitle: { fontSize: 12, lineHeight: 18, color: C.muted, marginTop: 2 },
  messages: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
  },
  hello: { paddingVertical: 36, maxWidth: 320, alignSelf: "center" },
  composer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.white,
    borderRadius: 24,
    color: C.ink,
    fontSize: 15,
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.line,
  },
  snap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  snapHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  snapContent: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
    overflow: "hidden",
    borderRadius: 20,
  },
  snapPhoto: { width: "100%", flex: 1, minHeight: 200, borderRadius: 20 },
  snapCaption: {
    fontSize: 20,
    color: C.ink,
    lineHeight: 28,
    textAlign: "center",
    paddingVertical: 12,
  },
  snapHint: {
    fontSize: 12,
    color: C.muted,
    textAlign: "center",
    paddingVertical: 20,
  },
});
