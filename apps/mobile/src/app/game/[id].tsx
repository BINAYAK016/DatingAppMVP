import React, { useCallback, useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../../lib/store";
import { Button, C, Empty, Header, Page, s } from "../../components/ui";
export default function Game() {
  const { id, target } = useLocalSearchParams<{ id: string; target: string }>();
  const st = useStore();
  const { request } = st;
  const [game, setGame] = useState<any>(null),
    [choices, setChoices] = useState<number[]>([-1, -1, -1, -1, -1]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const chat = await request(`/chat/${target}`);
      setGame(chat.games.find((g: any) => g.id === id));
    } catch (e: any) {
      setError(e.message);
      setGame(null);
    }
  }, [id, target, request]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 5000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);
  const def = st.data?.games.find((g) => g.id === game?.kind);
  const me = st.data?.me.id || "";
  const other = game?.host === me ? game?.guest : game?.host;
  const score = game?.complete
    ? game.answers[me].filter(
        (v: number, i: number) => v === game.answers[other][i],
      ).length
    : 0;
  return (
    <Page>
      <Header
        back
        title={def?.title || "A little game."}
        eyebrow="CHOOSE IN SECRET. REVEAL TOGETHER."
      />
      {error ? (
        <Empty title="Game unavailable" body={error} />
      ) : (
        game &&
        def && (
          <>
            {game.complete ? (
              <View style={[s.card, { backgroundColor: C.blush, padding: 28 }]}>
                <Text style={[s.title, { fontSize: 48 }]}>{score} / 5</Text>
                <Text style={s.h2}>Little things in common.</Text>
                <Text style={[s.body, { marginTop: 12 }]}>
                  The differences are conversation starters too. Ask your match
                  about the choice that surprised you.
                </Text>
              </View>
            ) : (
              <Text style={[s.body, { marginBottom: 22 }]}>
                {game.answered
                  ? "Your choices are locked. Your match’s answers remain private until they play too."
                  : "Five small choices. Pick what feels like you. Your match cannot see your answers until both of you finish."}
              </Text>
            )}
            {def.questions.map((q, i) => (
              <View key={q.q} style={s.card}>
                <Text style={s.eyebrow}>QUESTION {i + 1} / 5</Text>
                <Text style={[s.h2, { marginBottom: 15 }]}>{q.q}</Text>
                {q.options.map((option, j) => {
                  const selected = game.answered
                    ? game.answers[me]?.[i] === j
                    : choices[i] === j;
                  const theirs =
                    game.complete && game.answers[other]?.[i] === j;
                  return (
                    <Pressable
                      key={option}
                      disabled={game.answered}
                      onPress={() =>
                        setChoices(choices.map((v, k) => (k === i ? j : v)))
                      }
                      style={{
                        padding: 15,
                        borderRadius: 13,
                        marginBottom: 9,
                        borderWidth: 1,
                        borderColor: selected ? C.primary : C.line,
                        backgroundColor: selected ? "#FBE4EB" : C.bg,
                      }}
                    >
                      <Text style={[s.body, { color: C.ink }]}>{option}</Text>
                      {selected && game.answered && (
                        <Text style={s.small}>You ✓</Text>
                      )}
                      {theirs && <Text style={s.small}>Your match ✓</Text>}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {!game.answered && (
              <Button
                title={busy ? "Locking in…" : "Lock in my choices"}
                disabled={busy || choices.includes(-1)}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await request(`/game/${id}/answer`, { answers: choices });
                    await load();
                  } catch (e: any) {
                    st.toast(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {game.complete && (
              <>
                <Button
                  title="Talk about your choices"
                  onPress={() => router.replace(`/chat/${target}`)}
                />
                {game.kind === "date-builder" && (
                  <View style={{ marginTop: 12 }}>
                    <Button
                      title="Turn it into a date"
                      secondary
                      onPress={() =>
                        router.push({
                          pathname: "/plan",
                          params: { target, title: "Our date, together" },
                        })
                      }
                    />
                  </View>
                )}
              </>
            )}
          </>
        )
      )}
    </Page>
  );
}
