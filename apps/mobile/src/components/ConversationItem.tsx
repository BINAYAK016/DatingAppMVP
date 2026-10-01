import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Button, C, Icon, Media, s } from "./ui";
import { useStore } from "../lib/store";
import { useReducedMotion } from "../lib/useReducedMotion";
import { randomUUID } from "expo-crypto";
import { GameSessionV2 } from "../lib/gameV2";
export function ConversationItem({
  item: m,
  target,
  reload,
  openSnap,
  updateGame,
}: {
  item: any;
  target: string;
  reload: () => Promise<void | boolean>;
  openSnap: (id: string) => void;
  updateGame?: (session: GameSessionV2) => void;
}) {
  const st = useStore(),
    mine = m.sender === st.data?.me.id;
  const reducedMotion = useReducedMotion();
  const [appearance] = useState(() => new Animated.Value(1));
  const [gameBusy, setGameBusy] = useState(false);
  const mounted = useRef(true),
    acting = useRef(false),
    sessionKey = useRef(st.sessionKey);
  useEffect(() => {
    mounted.current = true;
    sessionKey.current = st.sessionKey;
    return () => {
      mounted.current = false;
    };
  }, [st.sessionKey]);
  const gameAction = async (action: "accept" | "decline") => {
    if (acting.current) return;
    const startedSession = st.sessionKey;
    const current = () =>
      mounted.current && startedSession === sessionKey.current;
    acting.current = true;
    setGameBusy(true);
    try {
      const next = await st.request<GameSessionV2>(`/game/${m.id}/action`, {
        clientId: randomUUID(),
        expectedRevision: m.revision,
        action,
        payload: {},
      });
      if (!current()) return;
      updateGame?.(next);
      const refreshed = await reload();
      if (!current() || refreshed === false) return;
      if (action === "accept" && next.state === "active")
        router.push({
          pathname: "/game/[id]",
          params: { id: next.id, target, version: "2" },
        });
    } catch (e: any) {
      if (!current()) return;
      st.toast(e.message);
      await reload();
    } finally {
      acting.current = false;
      if (current()) setGameBusy(false);
    }
  };
  useEffect(() => {
    // A cancelled entrance must never leave a keyed, still-mounted message dim.
    appearance.setValue(1);
    if (
      reducedMotion ||
      !mine ||
      m.type !== "message" ||
      Date.now() - new Date(m.created_at).getTime() > 5000
    )
      return;
    appearance.setValue(0.75);
    let active = true;
    const animation = Animated.timing(appearance, {
      toValue: 1,
      duration: 180,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start(() => {
      if (active) appearance.setValue(1);
    });
    return () => {
      active = false;
      animation.stop();
      appearance.setValue(1);
    };
  }, [appearance, mine, m.id, m.type, m.created_at, reducedMotion]);
  if (m.type === "message")
    return (
      <Animated.View
        style={[
          styles.bubble,
          { opacity: appearance },
          mine ? styles.sent : styles.received,
          m.media_id && { width: "86%" },
        ]}
      >
        {!!m.media_id && <Media id={m.media_id} kind={m.kind} />}
        {!!m.body && <Text style={styles.message}>{m.body}</Text>}
        {!!m.post_id && (
          <Button
            secondary
            title="View shared moment"
            onPress={() =>
              router.push({ pathname: "/post/[id]", params: { id: m.post_id } })
            }
          />
        )}
        {!m.post_id && !m.body && !m.media_id && (
          <Text style={s.small}>This attachment is no longer available.</Text>
        )}
        <Text style={[styles.time, { textAlign: mine ? "right" : "left" }]}>
          {new Date(m.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </Animated.View>
    );
  if (m.type === "snap")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          m.opened_at ? "Snap opened" : mine ? "Your snap sent" : "Open snap"
        }
        disabled={!!m.opened_at || mine}
        onPress={() => openSnap(m.id)}
        style={[styles.snap, { alignSelf: mine ? "flex-end" : "flex-start" }]}
      >
        <View style={styles.snapIcon}>
          <Icon
            name={m.opened_at ? "camera" : "camera-outline"}
            color={C.primary}
            size={24}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.snapTitle}>
            {m.opened_at
              ? "Snap opened"
              : mine
                ? "Your snap is on its way"
                : "A little moment for you"}
          </Text>
          <Text style={s.small}>
            {m.opened_at
              ? "This moment has passed"
              : mine
                ? "Waiting to be opened · view once"
                : "View once · screenshots are possible"}
          </Text>
        </View>
        {!m.opened_at && !mine && (
          <Icon name="chevron-forward" size={16} color={C.primary} />
        )}
      </Pressable>
    );
  if (m.type === "game") {
    const def = m.definition || st.data?.games.find((g) => g.id === m.kind);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${def?.title || "Previous game"} · ${m.state}`}
        style={[styles.connection, { backgroundColor: C.lavender }]}
        onPress={() =>
          router.push({
            pathname: "/game/[id]",
            params: {
              id: m.id,
              target,
              created_at: m.created_at,
              ...(m.version === 2 ? { version: "2" } : {}),
            },
          })
        }
      >
        <View style={[s.row, { marginBottom: 12 }]}>
          <Icon name="dice-outline" size={22} color={C.primary} />
          <Text style={s.small}>
            {m.state === "invited"
              ? "A game invitation"
              : "A little more to know"}
          </Text>
        </View>
        <Text style={s.h2}>{def?.title || "Previous game"}</Text>
        {m.version === 2 && (
          <Text style={[s.small, { marginTop: 8 }]}>
            {def?.durationMinutes} min · 2 players
          </Text>
        )}
        <Text style={[s.body, { marginTop: 8 }]}>
          {m.state === "invited"
            ? m.guest === st.data?.me.id
              ? "Your match wants to play with you."
              : "Invitation sent. A good time for two?"
            : m.complete
              ? "Your reveal is ready."
              : m.state === "active"
                ? "Your game is in progress."
                : `Game ${m.state}`}
        </Text>
        {m.version === 2 &&
          m.state === "invited" &&
          m.guest === st.data?.me.id && (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Button
                title={gameBusy ? "Opening…" : "Accept & play"}
                disabled={gameBusy}
                onPress={(event?: any) => {
                  event?.stopPropagation?.();
                  void gameAction("accept");
                }}
              />
              <Button
                title="Maybe later"
                secondary
                disabled={gameBusy}
                onPress={(event?: any) => {
                  event?.stopPropagation?.();
                  void gameAction("decline");
                }}
              />
            </View>
          )}
        <View
          style={[s.row, { marginTop: 16, justifyContent: "space-between" }]}
        >
          <Text style={s.link}>
            {m.state === "invited" && m.guest === st.data?.me.id
              ? "View invitation"
              : m.complete
                ? "See your reveal"
                : "Open game"}
          </Text>
          <Icon name="arrow-forward" size={18} color={C.primary} />
        </View>
      </Pressable>
    );
  }
  const act = (state: string) =>
    st
      .request(`/plan/${m.id}`, { state })
      .then(reload)
      .catch((e) => st.toast(e.message));
  return (
    <View style={[styles.connection, { backgroundColor: C.peach }]}>
      <View style={[s.row, { marginBottom: 14 }]}>
        <Icon name="calendar-outline" size={21} color={C.primary} />
        <Text style={s.small}>A date idea · {m.state}</Text>
      </View>
      <Text style={s.h2}>{m.title}</Text>
      <Text style={[s.body, { marginTop: 8 }]}>
        {m.venue || "Find a place together"}
      </Text>
      <Text style={[s.small, { marginVertical: 14 }]}>
        {new Date(m.scheduled_at).toLocaleString()} ·{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </Text>
      {m.state === "proposed" && m.guest === st.data?.me.id && (
        <View style={{ gap: 10 }}>
          <Button title="Sounds lovely" onPress={() => void act("accepted")} />
          <Button
            title="Another time"
            secondary
            onPress={() => void act("declined")}
          />
        </View>
      )}
      {["proposed", "accepted"].includes(m.state) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel date"
          onPress={() => void act("cancelled")}
          style={{ paddingTop: 16, minHeight: 44 }}
        >
          <Text style={[s.small, s.danger]}>Cancel date</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  bubble: {
    maxWidth: "86%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  sent: {
    alignSelf: "flex-end",
    backgroundColor: C.blush,
    borderBottomRightRadius: 6,
  },
  received: {
    alignSelf: "flex-start",
    backgroundColor: C.white,
    borderBottomLeftRadius: 6,
  },
  message: { fontSize: 16, lineHeight: 24, color: C.ink },
  time: { fontSize: 10, lineHeight: 14, color: C.muted, marginTop: 6 },
  snap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "86%",
    backgroundColor: C.lavender,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  snapIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.white,
  },
  snapTitle: { fontSize: 15, fontWeight: "500", color: C.ink },
  connection: {
    borderRadius: 18,
    padding: 22,
    width: "92%",
    alignSelf: "center",
    marginVertical: 12,
  },
});
