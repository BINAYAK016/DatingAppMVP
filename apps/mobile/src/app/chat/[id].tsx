import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  StyleSheet,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConversationItem } from "../../components/ConversationItem";
import { useStore } from "../../lib/store";
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
  Media,
  s,
} from "../../components/ui";
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  const conversationScroll = useRef<ScrollView>(null);
  const followNewest = useRef(true);
  const userScrolling = useRef(false);
  const followEnd = useCallback(() => {
    if (!followNewest.current || userScrolling.current) return;
    requestAnimationFrame(() => {
      if (followNewest.current && !userScrolling.current)
        conversationScroll.current?.scrollToEnd({ animated: false });
    });
  }, []);
  const trackScroll = (nativeEvent: {
    contentSize: { height: number };
    layoutMeasurement: { height: number };
    contentOffset: { y: number };
  }) => {
    followNewest.current =
      nativeEvent.contentSize.height -
        nativeEvent.layoutMeasurement.height -
        nativeEvent.contentOffset.y <
      100;
  };
  const pending = useRef<{ text: string; id: string } | null>(null);
  const load = useCallback(async () => {
    try {
      setChat(await request(`/chat/${id}`));
      setError("");
    } catch (e: any) {
      setError(e.message);
      setChat(null);
      setHistory([]);
    }
  }, [id, request]);
  useFocusEffect(
    useCallback(() => {
      const first = setTimeout(() => void load(), 0);
      const t = setInterval(() => {
        if (AppState.currentState === "active") void load();
      }, 3000);
      return () => {
        clearTimeout(first);
        clearInterval(t);
      };
    }, [load]),
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
    setBusy(true);
    const message = body.trim();
    if (!pending.current || pending.current.text !== message)
      pending.current = {
        text: message,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    try {
      await request(`/chat/${id}`, {
        body: message,
        clientId: pending.current.id,
      });
      pending.current = null;
      setBody("");
      followNewest.current = true;
      await load();
    } catch (e: any) {
      st.toast(e.message + " Your draft is still here.");
    } finally {
      setBusy(false);
    }
  };
  const [options, setOptions] = useState(false);
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
        <ScrollView
          ref={conversationScroll}
          onScrollBeginDrag={() => {
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
        >
          {error ? (
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
              {!chat.timeline.length && !history.length && (
                <View style={styles.hello}>
                  <View
                    style={[
                      s.row,
                      { justifyContent: "center", marginBottom: 16 },
                    ]}
                  >
                    <Avatar person={st.data?.me || {}} size={56} />
                    <Icon name="heart-outline" color={C.primary} size={20} />
                    <Avatar person={chat.person} size={56} />
                  </View>
                  <Text style={[s.h2, { textAlign: "center" }]}>
                    A little hello goes a long way
                  </Text>
                  <Text style={[s.body, { textAlign: "center", marginTop: 8 }]}>
                    You chose each other. Start with something that feels like
                    you.
                  </Text>
                </View>
              )}
              {chat.hasMore && more && (
                <View style={{ paddingVertical: 16 }}>
                  <Button
                    title={loadingHistory ? "Loading…" : "Earlier conversation"}
                    secondary
                    disabled={loadingHistory}
                    onPress={async () => {
                      followNewest.current = false;
                      setLoadingHistory(true);
                      try {
                        const first = history[0] || chat.timeline[0];
                        const result = await request(
                          `/chat/${id}?before=${encodeURIComponent(first.created_at)}&beforeId=${first.id}`,
                        );
                        setHistory((old) => [...result.timeline, ...old]);
                        setMore(result.hasMore);
                      } catch (e: any) {
                        st.toast(e.message);
                      } finally {
                        setLoadingHistory(false);
                      }
                    }}
                  />
                </View>
              )}
              {[
                ...new Map(
                  [...history, ...chat.timeline].map((m: any) => [m.id, m]),
                ).values(),
              ]
                .sort(
                  (a: any, b: any) =>
                    a.created_at.localeCompare(b.created_at) ||
                    a.id.localeCompare(b.id),
                )
                .map((item: any) => (
                  <ConversationItem
                    key={item.id}
                    item={item}
                    target={id}
                    reload={load}
                    openSnap={async (snapId) => {
                      try {
                        setSnap({
                          ...(await request(`/snaps/${snapId}/open`, {})),
                          id: snapId,
                        });
                      } catch (e: any) {
                        st.toast(e.message);
                      }
                      void load();
                    }}
                  />
                ))}
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
        </ScrollView>
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
                    params: { kind: "snap", target: id },
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
                    params: { kind: "snap", target: id },
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
            title="Dating games"
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
          {snap && (
            <View style={styles.snapContent}>
              {snap.kind === "video" ? (
                <Media
                  id={snap.mediaId}
                  kind={snap.kind}
                  style={styles.snapPhoto}
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
