import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
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
  Field,
  Header,
  Icon,
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
      await load();
    } catch (e: any) {
      st.toast(e.message + " Your draft is still here.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[s.page, { paddingBottom: 15 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Header
            back
            title={chat?.person.name || "Your conversation."}
            eyebrow="JUST THE TWO OF YOU"
            action={
              <Pressable
                accessibilityLabel="Chat safety"
                onPress={() =>
                  router.push({
                    pathname: "/safety",
                    params: { target: id, context: "chat" },
                  })
                }
              >
                <Icon name="shield-checkmark-outline" />
              </Pressable>
            }
          />
          {error ? (
            <Empty title="Conversation unavailable" body={error} />
          ) : (
            chat && (
              <>
                <View
                  style={[
                    s.row,
                    { justifyContent: "center", marginBottom: 22 },
                  ]}
                >
                  <Avatar person={st.data?.me || {}} size={42} />
                  <Icon name="heart" size={16} color="#BD758B" />
                  <Avatar person={chat.person} size={42} />
                </View>
                <Text
                  style={[s.small, { textAlign: "center", marginBottom: 24 }]}
                >
                  You chose each other. Say something that feels like you.
                </Text>
                {chat.hasMore && more && (
                  <Button
                    title={loadingHistory ? "Loading…" : "Earlier conversation"}
                    secondary
                    disabled={loadingHistory}
                    onPress={async () => {
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
            )
          )}
        </ScrollView>
        {chat && (
          <View
            style={{
              padding: 15,
              borderTopWidth: 1,
              borderColor: C.line,
              backgroundColor: C.bg,
            }}
          >
            {attachments && (
              <View style={[s.wrap, { marginBottom: 14 }]}>
                <Button
                  title="Photo or video"
                  secondary
                  icon="images-outline"
                  onPress={() =>
                    router.push({
                      pathname: "/compose",
                      params: { kind: "message", target: id },
                    })
                  }
                />
                <Button
                  title="Dating games"
                  secondary
                  icon="dice-outline"
                  onPress={() =>
                    router.push({ pathname: "/games", params: { target: id } })
                  }
                />
                <Button
                  title="Plan a Date"
                  secondary
                  icon="calendar-outline"
                  onPress={() =>
                    router.push({ pathname: "/plan", params: { target: id } })
                  }
                />
                <Button
                  title="View profile"
                  secondary
                  icon="person-outline"
                  onPress={() => router.push(`/profile/${id}`)}
                />
                <Button
                  title="Safety"
                  secondary
                  icon="shield-checkmark-outline"
                  onPress={() =>
                    router.push({
                      pathname: "/safety",
                      params: { target: id, context: "chat" },
                    })
                  }
                />
              </View>
            )}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chat camera"
                style={s.iconButton}
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: { kind: "snap", target: id },
                  })
                }
              >
                <Icon name="camera-outline" size={20} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Conversation actions"
                accessibilityState={{ expanded: attachments }}
                style={s.iconButton}
                onPress={() => setAttachments(!attachments)}
              >
                <Icon name={attachments ? "close" : "add"} size={20} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Field
                  value={body}
                  onChangeText={setBody}
                  placeholder="A thought, a question, a hello…"
                />
              </View>
              <Pressable
                disabled={busy || !body.trim()}
                accessibilityLabel="Send message"
                onPress={() => void send()}
                style={{
                  backgroundColor: C.primary,
                  padding: 16,
                  borderRadius: 15,
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Icon name="arrow-up" color="white" size={20} />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      <Modal
        visible={!!snap}
        animationType="fade"
        onRequestClose={() => void close()}
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: C.bg,
            padding: 22,
            justifyContent: "center",
          }}
        >
          <Text style={s.eyebrow}>ONE LITTLE MOMENT · UP TO 30 SECONDS</Text>
          {snap && (
            <>
              <Media id={snap.mediaId} kind={snap.kind} />
              <Text style={[s.h2, { marginBottom: 25 }]}>{snap.caption}</Text>
            </>
          )}
          <Button title="Close snap" onPress={() => void close()} />
          <Text style={[s.small, { textAlign: "center", marginTop: 15 }]}>
            Closing ends this viewing session.
          </Text>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
