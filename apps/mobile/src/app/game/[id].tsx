import React, { useCallback, useState } from "react";
import { AppState, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useStore } from "../../lib/store";
import { useGameReady } from "../../lib/useGameReady";
import {
  Button,
  C,
  Chip,
  Empty,
  Field,
  Header,
  Page,
  s,
} from "../../components/ui";

export default function Game() {
  const { id, target, ready } = useLocalSearchParams<{
    id: string;
    target: string;
    ready?: string;
  }>();
  return (
    <Session key={id} id={id} target={target} initiallyReady={ready === "1"} />
  );
}
function Session({
  id,
  target,
  initiallyReady,
}: {
  id: string;
  target: string;
  initiallyReady: boolean;
}) {
  const { request, data, toast } = useStore();
  const { enabled, presence, update } = useGameReady(target, initiallyReady);
  const [game, setGame] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState([-1, -1, -1, -1, -1]);
  const [statements, setStatements] = useState(["", "", ""]);
  const [lie, setLie] = useState(-1);
  const [guess, setGuess] = useState(-1);
  const load = useCallback(async () => {
    try {
      const chat = await request(`/chat/${target}`);
      setGame(chat.games.find((g: any) => g.id === id));
      setError("");
    } catch (e: any) {
      setGame(null);
      setError(e.message);
    }
  }, [request, target, id]);
  useFocusEffect(
    useCallback(() => {
      const first = setTimeout(() => void load(), 0);
      const timer = setInterval(() => {
        if (AppState.currentState === "active") void load();
      }, 3000);
      return () => {
        clearTimeout(first);
        clearInterval(timer);
      };
    }, [load]),
  );
  const act = async (path: string, body: unknown) => {
    setBusy(true);
    try {
      await request(`/game/${id}/${path}`, body);
      await load();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const me = data?.me.id || "";
  const def = data?.games.find((g) => g.id === game?.kind);
  const live = enabled && presence.self && presence.partner;
  const closed =
    game && !["invited", "active", "complete"].includes(game.state);
  return (
    <Page>
      <Header
        back
        title={def?.title || "Dating game"}
        eyebrow="A LITTLE CURIOSITY, TOGETHER"
      />
      {!!error && <Empty title="Game unavailable" body={error} />}
      {!game && !error && <Text style={s.body}>Loading your game…</Text>}
      {game && (
        <>
          {closed ? (
            <Empty
              title={`Game ${game.state}`}
              body="You can send a new invitation when you are both ready."
            />
          ) : (
            <>
              {!game.complete && (
                <View style={[s.card, { backgroundColor: C.lavender }]}>
                  <Text style={s.body}>
                    {live
                      ? "You’re both ready with each other."
                      : "Both players need to stay Ready to play."}
                  </Text>
                  <Text style={[s.small, { marginVertical: 12 }]}>
                    Only this match can see this temporary status. It expires
                    within 45 seconds after you leave. This game closes at{" "}
                    {new Date(game.expires_at).toLocaleTimeString()}.
                  </Text>
                  <Button
                    secondary
                    title={enabled ? "Stop being ready" : "I’m Ready to play"}
                    onPress={() => void update(!enabled)}
                  />
                </View>
              )}
              {game.state === "invited" && (
                <View style={s.card}>
                  <Text style={[s.h2, { marginBottom: 16 }]}>
                    {game.host === me
                      ? "Your invitation is waiting"
                      : "Your match wants to play"}
                  </Text>
                  {game.guest === me ? (
                    <>
                      <Button
                        title="Accept invitation"
                        disabled={busy || !live}
                        onPress={() =>
                          void act("respond", { response: "accept" })
                        }
                      />
                      <View style={{ height: 10 }} />
                      <Button
                        title="Decline"
                        secondary
                        disabled={busy}
                        onPress={() =>
                          void act("respond", { response: "decline" })
                        }
                      />
                    </>
                  ) : (
                    <Text style={s.body}>
                      The game begins only after your match accepts.
                    </Text>
                  )}
                </View>
              )}
              {(game.state === "active" || game.complete) && (
                <>
                  {game.complete && (
                    <View style={[s.card, { backgroundColor: C.blush }]}>
                      <Text style={s.h2}>A little more to talk about.</Text>
                      <Text style={s.body}>
                        Ask about the answer that surprised you. These games are
                        conversation starters, not compatibility scores.
                      </Text>
                    </View>
                  )}
                  {game.kind === "two-truths" ? (
                    <>
                      {!game.answered ? (
                        <View style={s.card}>
                          <Text style={[s.body, { marginBottom: 15 }]}>
                            Write two true statements and one invented one. Mark
                            the lie privately.
                          </Text>
                          {statements.map((v, i) => (
                            <View key={i}>
                              <Field
                                label={`Statement ${i + 1}`}
                                value={v}
                                onChangeText={(v) =>
                                  setStatements((a) =>
                                    a.map((old, n) =>
                                      n === i ? v.slice(0, 180) : old,
                                    ),
                                  )
                                }
                              />
                              <Chip
                                label={`Statement ${i + 1} is the lie`}
                                selected={lie === i}
                                onPress={() => setLie(i)}
                              />
                            </View>
                          ))}
                          <View style={{ height: 18 }} />
                          <Button
                            title="Lock in my statements"
                            disabled={
                              busy ||
                              !live ||
                              lie < 0 ||
                              statements.some((s) => !s.trim())
                            }
                            onPress={() =>
                              void act("answer", {
                                answers: { statements, lie },
                              })
                            }
                          />
                        </View>
                      ) : !game.bothAnswered ? (
                        <Text style={s.body}>
                          Your statements are locked. Waiting for your match to
                          write theirs.
                        </Text>
                      ) : (
                        <View style={s.card}>
                          <Text style={[s.h2, { marginBottom: 15 }]}>
                            Which is your match’s lie?
                          </Text>
                          {game.answers[target].statements.map(
                            (v: string, i: number) => (
                              <View key={i} style={{ marginBottom: 10 }}>
                                <Chip
                                  label={v}
                                  selected={
                                    guess === i || game.guesses[me] === i
                                  }
                                  onPress={() => setGuess(i)}
                                />
                                {game.complete &&
                                  game.answers[target].lie === i && (
                                    <Text style={s.small}>The lie ✓</Text>
                                  )}
                              </View>
                            ),
                          )}
                          {!game.complete &&
                            (game.guesses[me] === undefined ? (
                              <Button
                                title="Lock in my guess"
                                disabled={busy || !live || guess < 0}
                                onPress={() => void act("guess", { guess })}
                              />
                            ) : (
                              <Text style={s.body}>
                                Guess locked. Reveal happens after both guesses.
                              </Text>
                            ))}
                          {game.complete && (
                            <Text style={s.body}>
                              Your match guessed statement{" "}
                              {game.guesses[target] + 1}. Your lie was statement{" "}
                              {game.answers[me].lie + 1}.
                            </Text>
                          )}
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      {def?.questions.map((q, i) => (
                        <View key={q.q} style={s.card}>
                          <Text style={s.eyebrow}>QUESTION {i + 1} / 5</Text>
                          <Text style={[s.h2, { marginBottom: 15 }]}>
                            {q.q}
                          </Text>
                          {q.options.map((option, j) => (
                            <View key={option} style={{ marginBottom: 10 }}>
                              <Chip
                                label={option}
                                selected={
                                  (game.answered
                                    ? game.answers[me]?.[i]
                                    : choices[i]) === j
                                }
                                onPress={
                                  game.answered
                                    ? undefined
                                    : () =>
                                        setChoices((a) =>
                                          a.map((v, k) => (k === i ? j : v)),
                                        )
                                }
                              />
                              {game.complete &&
                                game.answers[target]?.[i] === j && (
                                  <Text style={s.small}>Your match ✓</Text>
                                )}
                            </View>
                          ))}
                        </View>
                      ))}
                      {!game.answered ? (
                        <Button
                          title="Lock in my choices"
                          disabled={busy || !live || choices.includes(-1)}
                          onPress={() =>
                            void act("answer", { answers: choices })
                          }
                        />
                      ) : (
                        !game.complete && (
                          <Text style={s.body}>
                            Your choices are locked. Your match’s answers stay
                            hidden until they finish too.
                          </Text>
                        )
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
          {["active", "invited"].includes(game.state) && (
            <View style={{ marginTop: 16 }}>
              <Button
                secondary
                title="Cancel game"
                disabled={busy}
                onPress={() => void act("respond", { response: "cancel" })}
              />
            </View>
          )}
          <View style={{ marginTop: 16 }}>
            <Button
              title="Back to conversation"
              onPress={() => router.replace(`/chat/${target}`)}
            />
          </View>
        </>
      )}
    </Page>
  );
}
