import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useStore } from "../lib/store";
import { useGameReady } from "../lib/useGameReady";
import {
  Avatar,
  BottomSheet,
  Button,
  C,
  Empty,
  Icon,
  s,
} from "../components/ui";
export default function Games() {
  const { target = "" } = useLocalSearchParams<{ target?: string }>();
  return <GameLobby key={target} target={target} />;
}
function GameLobby({ target }: { target: string }) {
  const st = useStore();
  const focused = useIsFocused();
  const { enabled, presence, update } = useGameReady(target);
  const [busy, setBusy] = useState(false);
  const person = st.data?.matches.find((p) => p.id === target);
  return (
    <BottomSheet
      visible={focused}
      onClose={() => router.back()}
      title="Dating games"
    >
      {!person ? (
        <Empty
          icon="people-outline"
          title="It takes two"
          body="Open a match’s conversation to invite them to a game."
        />
      ) : (
        <>
          <View style={styles.pair}>
            <Avatar person={st.data!.me} size={68} />
            <View style={styles.between}>
              <Icon name="sparkles-outline" color={C.primary} size={22} />
            </View>
            <Avatar person={person} size={68} />
          </View>
          <Text style={styles.headline}>
            Less small talk.{"\n"}More you two.
          </Text>
          <Text
            style={[
              s.body,
              { textAlign: "center", marginTop: 12, marginBottom: 28 },
            ]}
          >
            A little curiosity, together with {person.name}.
          </Text>
          <View style={styles.ready}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Ready to play?</Text>
              <Text
                accessibilityLiveRegion="polite"
                style={[s.small, { marginTop: 6 }]}
              >
                {presence.partner
                  ? `${person.name} is ready with you.`
                  : `${person.name} hasn’t marked ready with you yet.`}
              </Text>
            </View>
            <View
              style={[
                styles.dot,
                presence.self && { backgroundColor: C.primary },
              ]}
            />
          </View>
          <Button
            title={enabled ? "Stop being ready" : "I’m Ready to play"}
            secondary
            onPress={() => void update(!enabled)}
          />
          <Text style={[s.small, { marginTop: 12, marginBottom: 28 }]}>
            Only this match sees your temporary status. It expires within 45
            seconds of leaving or going offline.
          </Text>
          <Text style={[s.h2, { marginBottom: 16 }]}>Pick your icebreaker</Text>
          <View style={{ gap: 16 }}>
            {st.data?.games.map((game, i) => (
              <Pressable
                key={game.id}
                accessibilityRole="button"
                accessibilityLabel={`Invite to ${game.title}`}
                accessibilityState={{
                  disabled: busy || !presence.self || !presence.partner,
                }}
                disabled={busy || !presence.self || !presence.partner}
                onPress={async () => {
                  setBusy(true);
                  try {
                    const result = await st.request(`/games/${target}`, {
                      kind: game.id,
                    });
                    router.push({
                      pathname: "/game/[id]",
                      params: { id: result.id, target, ready: "1" },
                    });
                  } catch (e: any) {
                    st.toast(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
                style={({ pressed }) => [
                  styles.game,
                  {
                    backgroundColor: [C.blush, C.peach, C.lavender][i % 3],
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={styles.gameNumber}>0{i + 1}</Text>
                <Text style={styles.gameEmoji}>{game.emoji}</Text>
                <Text style={[s.h2, { marginTop: 24 }]}>{game.title}</Text>
                <Text style={[s.body, { marginTop: 8 }]}>{game.subtitle}</Text>
                <View style={[s.row, { marginTop: 24 }]}>
                  <Text
                    style={[
                      s.label,
                      {
                        flex: 1,
                        color:
                          !busy && presence.self && presence.partner
                            ? C.primary
                            : C.muted,
                      },
                    ]}
                  >
                    {busy
                      ? "Sending…"
                      : presence.self && presence.partner
                        ? "Invite to play"
                        : "Both players need to be ready"}
                  </Text>
                  <Icon
                    name="arrow-forward"
                    size={20}
                    color={
                      !busy && presence.self && presence.partner
                        ? C.primary
                        : C.muted
                    }
                  />
                </View>
              </Pressable>
            ))}
          </View>
          <Text style={[s.small, { textAlign: "center", marginTop: 24 }]}>
            Every game starts with an accepted invitation. Invites expire after
            two minutes.
          </Text>
        </>
      )}
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  pair: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  between: { width: 56, alignItems: "center" },
  headline: {
    color: C.ink,
    fontSize: 32,
    lineHeight: 39,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.8,
    marginTop: 24,
  },
  ready: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.line },
  game: { padding: 24, borderRadius: 18 },
  gameNumber: { fontSize: 11, color: C.muted, letterSpacing: 1.5 },
  gameEmoji: { position: "absolute", right: 24, top: 22, fontSize: 30 },
});
