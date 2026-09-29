import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../lib/store";
import { useGameReady } from "../lib/useGameReady";
import { Button, C, Empty, Header, Page, s } from "../components/ui";

export default function Games() {
  const { target = "" } = useLocalSearchParams<{ target?: string }>();
  return <GameLobby key={target} target={target} />;
}
function GameLobby({ target }: { target: string }) {
  const st = useStore();
  const { enabled, presence, update } = useGameReady(target);
  const [busy, setBusy] = useState(false);
  const person = st.data?.matches.find((p) => p.id === target);
  return (
    <Page>
      <Header back title="Dating games" eyebrow="LESS SMALL TALK. MORE YOU." />
      {!person ? (
        <Empty
          title="It takes two"
          body="Open a match’s conversation to invite them to a game."
        />
      ) : (
        <>
          <View style={[s.card, { backgroundColor: C.lavender }]}>
            <Text style={s.h2}>A little play, with {person.name}</Text>
            <Text style={[s.body, { marginVertical: 12 }]}>
              Ready to play is shared only with this match. It expires within 45
              seconds of leaving games or going offline.
            </Text>
            <Button
              title={enabled ? "Stop being ready" : "I’m Ready to play"}
              secondary
              onPress={() => void update(!enabled)}
            />
            <Text
              accessibilityLiveRegion="polite"
              style={[s.small, { marginTop: 14 }]}
            >
              {presence.partner
                ? `${person.name} is ready with you.`
                : `${person.name} hasn’t marked ready with you yet.`}
            </Text>
          </View>
          {st.data?.games.map((game, i) => (
            <View
              key={game.id}
              style={[
                s.card,
                { backgroundColor: [C.blush, C.peach, C.lavender][i] },
              ]}
            >
              <Text style={{ fontSize: 30 }}>{game.emoji}</Text>
              <Text style={[s.h2, { marginTop: 12 }]}>{game.title}</Text>
              <Text style={[s.body, { marginVertical: 14 }]}>
                {game.subtitle}
              </Text>
              <Button
                title={`Invite to ${game.title}`}
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
              />
            </View>
          ))}
          <Text style={[s.small, { textAlign: "center" }]}>
            Your match still needs to accept. Invitations expire after two
            minutes. Four more standard games will follow in the next increment.
          </Text>
        </>
      )}
    </Page>
  );
}
