import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import * as Crypto from "expo-crypto";
import { useStore } from "../lib/store";
import { useGameReady } from "../lib/useGameReady";
import { GameCatalogV2, GameDefinitionV2, GameSessionV2 } from "../lib/gameV2";
import {
  gameDraftScope,
  readGameDraft,
  saveGameDraft,
} from "../lib/gameDrafts";
import {
  Avatar,
  BottomSheet,
  Button,
  C,
  Chip,
  Empty,
  Icon,
  s,
  Skeleton,
  T,
} from "./ui";

type InviteDraft = { kind: string; clientId: string };
export function GamePickerV2({
  target,
  initialKind,
}: {
  target: string;
  initialKind?: string;
}) {
  const st = useStore(),
    focused = useIsFocused();
  const request = st.request;
  const account = st.data?.me.id || "",
    person = st.data?.matches.find((p) => p.id === target);
  const [scope] = useState(() => gameDraftScope(account));
  const {
    enabled,
    update,
    pending: readyPending,
    error: readyError,
  } = useGameReady(target);
  const [catalog, setCatalog] = useState<GameCatalogV2 | null>(null);
  const [selected, setSelected] = useState<GameDefinitionV2 | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const preselected = useRef(false);
  const pending = useRef<InviteDraft | null>(null),
    sending = useRef(false),
    alive = useRef(true);
  const draftId = `invite.${target}`;
  useEffect(() => {
    alive.current = true;
    if (account)
      void readGameDraft<InviteDraft>(account, draftId, scope)
        .then((saved) => {
          if (
            alive.current &&
            typeof saved?.kind === "string" &&
            typeof saved.clientId === "string"
          )
            pending.current = saved;
        })
        .catch(() => {
          if (alive.current)
            setError(
              "Your previous invitation couldn’t restore. Check your conversation before sending again.",
            );
        })
        .finally(() => {
          if (alive.current) setRestored(true);
        });
    return () => {
      alive.current = false;
    };
  }, [account, draftId, scope]);
  const load = useCallback(async () => {
    try {
      const next = await request<GameCatalogV2>(
        `/game-catalog?target=${target}`,
      );
      if (alive.current) {
        setCatalog(next);
        setError("");
        if (initialKind && !preselected.current) {
          preselected.current = true;
          if (!next.current)
            setSelected(
              next.games.find((game) => game.id === initialKind) || null,
            );
        }
      }
    } catch (e: any) {
      if (alive.current) setError(e.message);
    }
  }, [request, target, initialKind]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const open = (id: string, version: number) =>
    router.push({
      pathname: "/game/[id]",
      params: { id, target, version: String(version) },
    });
  const send = async () => {
    if (!selected || sending.current || !account || !restored || !alive.current)
      return;
    sending.current = true;
    setBusy(true);
    const draft =
      pending.current?.kind === selected.id
        ? pending.current
        : { kind: selected.id, clientId: Crypto.randomUUID() };
    pending.current = draft;
    try {
      await saveGameDraft(account, draftId, draft, scope);
      if (!alive.current) return;
      const session = await st.request<GameSessionV2>(
        `/games/${target}/invite`,
        draft,
      );
      pending.current = null;
      await saveGameDraft(account, draftId, null, scope);
      if (alive.current) open(session.id, 2);
    } catch (e: any) {
      if (alive.current)
        setError(
          e.message + " Check your conversation or retry this invitation.",
        );
      // Retain the same invitation ID after an unknown network outcome.
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const list = category
    ? catalog?.games.filter((g) => g.category === category)
    : catalog?.recommendedIds.flatMap((id) =>
        catalog.games.filter((g) => g.id === id),
      );
  return (
    <BottomSheet
      visible={focused}
      onClose={() => router.back()}
      title={selected ? "Want to play?" : "Play together"}
    >
      {!person ? (
        <Empty
          title="It takes two"
          body="Open a current match’s conversation to play together."
        />
      ) : (
        <>
          <View style={[s.row, styles.pair]}>
            <Avatar person={person} size={40} />
            <Text style={[s.label, { flex: 1 }]}>You + {person.name}</Text>
            <Icon name="heart-outline" color={C.primary} size={20} />
          </View>
          {!!error && (
            <View accessibilityLiveRegion="polite" style={styles.notice}>
              <Text style={s.body}>{error}</Text>
              <Button
                title="Refresh games"
                secondary
                disabled={busy}
                onPress={() => void load()}
              />
            </View>
          )}
          {!catalog ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={90} />
              <Skeleton height={90} />
              <Skeleton height={90} />
            </View>
          ) : !catalog.enabled ? (
            <Empty
              title="Games are taking a moment"
              body="This server hasn’t enabled Games 2.0 yet. Check back later."
            />
          ) : selected ? (
            <>
              <Text style={styles.emoji}>{selected.emoji}</Text>
              <Text
                accessibilityRole="header"
                style={[T.type.title, { textAlign: "center" }]}
              >
                {selected.title}
              </Text>
              <Text style={[s.body, { textAlign: "center", marginTop: 12 }]}>
                {selected.subtitle}
              </Text>
              <Text
                style={[
                  s.small,
                  { textAlign: "center", marginTop: 12, marginBottom: 28 },
                ]}
              >
                {selected.durationMinutes} min · 2 players · Play when it suits
                you
              </Text>
              <Button
                title={busy ? "Sending invitation…" : "Send Invite"}
                loading={busy}
                disabled={busy || !restored || !!catalog.current}
                onPress={() => void send()}
              />
              <Button
                title="Cancel"
                secondary
                disabled={busy}
                onPress={() => setSelected(null)}
              />
              <Text style={[s.small, { marginTop: 16, textAlign: "center" }]}>
                {person.name} chooses whether to join. Invitations expire after
                24 hours.
              </Text>
            </>
          ) : (
            <>
              {catalog.current && (
                <View style={styles.notice}>
                  <Text style={s.label}>
                    {catalog.current.state === "invited"
                      ? "An invitation is waiting"
                      : "Your game is in progress"}
                  </Text>
                  <Text style={[s.small, { marginVertical: 10 }]}>
                    Resume it before starting another game together.
                  </Text>
                  <Button
                    compact
                    title="Resume game"
                    onPress={() =>
                      open(catalog.current!.id, catalog.current!.version)
                    }
                  />
                </View>
              )}
              <Text accessibilityRole="header" style={s.h2}>
                {category || "Quick Play"}
              </Text>
              <Text style={[s.body, { marginTop: 6, marginBottom: 16 }]}>
                Pick something fun. They can join when they’re back.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                <View style={[s.row, { gap: 8 }]}>
                  <Chip
                    label="Quick Play"
                    selected={!category}
                    onPress={() => setCategory(null)}
                  />
                  {[
                    "Get to know you",
                    "Make them laugh",
                    "See if you click",
                  ].map((value) => (
                    <Chip
                      key={value}
                      label={value}
                      selected={category === value}
                      onPress={() => setCategory(value)}
                    />
                  ))}
                </View>
              </ScrollView>
              <View style={{ gap: 10 }}>
                {list?.map((game) => (
                  <Pressable
                    key={game.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${game.title}`}
                    accessibilityState={{ disabled: !!catalog.current }}
                    disabled={!!catalog.current}
                    onPress={() => {
                      setError("");
                      setSelected(game);
                    }}
                    style={[
                      styles.game,
                      !!catalog.current && { opacity: 0.55 },
                    ]}
                  >
                    <View style={styles.gameArt}>
                      <Text style={styles.smallEmoji}>{game.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>{game.title}</Text>
                      <Text style={[s.small, { marginTop: 5 }]}>
                        {game.subtitle}
                      </Text>
                      <Text
                        style={[
                          s.small,
                          { marginTop: 8, color: C.brandTextOnTint },
                        ]}
                      >
                        {game.durationMinutes} min · You + your match
                      </Text>
                    </View>
                    <Icon name="arrow-forward" color={C.primary} size={20} />
                  </Pressable>
                ))}
              </View>
              <View style={styles.advisory}>
                <Text style={s.label}>Playing now? Let them know.</Text>
                <Text style={[s.small, { marginVertical: 10 }]}>
                  Optional, private to this match. Both of you can still play at
                  different times.
                </Text>
                <Button
                  secondary
                  title={
                    readyPending
                      ? "Updating status…"
                      : enabled
                        ? "Stop being ready"
                        : "I’m Ready to play"
                  }
                  disabled={readyPending}
                  onPress={() => void update(!enabled)}
                />
                {readyError && (
                  <Text style={[s.small, { marginTop: 8 }]}>
                    Ready status couldn’t update. Invitations still work.
                  </Text>
                )}
              </View>
            </>
          )}
        </>
      )}
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  pair: {
    marginBottom: 24,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.peach,
  },
  emoji: { fontSize: 48, textAlign: "center", marginVertical: 24 },
  gameArt: {
    width: 48,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.blush,
  },
  smallEmoji: { fontSize: 26 },
  game: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.white,
    padding: 16,
    borderRadius: T.radius.card,
    minHeight: 104,
    borderWidth: 1,
    borderColor: C.line,
  },
  notice: {
    backgroundColor: C.lavender,
    borderRadius: T.radius.card,
    padding: 20,
    marginBottom: 16,
    gap: 6,
  },
  advisory: {
    marginTop: 28,
    padding: 20,
    borderRadius: T.radius.card,
    backgroundColor: C.peach,
  },
});
