import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useStore } from "../../lib/store";
import { GameRoomV2 } from "../../components/GameRoomV2";
import { useGameReady } from "../../lib/useGameReady";
import { useReducedMotion } from "../../lib/useReducedMotion";
import { findConversationGame } from "../../lib/gameHistory";
import { isUnavailable } from "../../lib/screenErrors";
import {
  Avatar,
  Button,
  C,
  Chip,
  Empty,
  Field,
  Header,
  Icon,
  IconButton,
  Page,
  Skeleton,
  StepProgress,
  s,
} from "../../components/ui";
export default function Game() {
  const { id, target, ready, created_at, version } = useLocalSearchParams<{
    id: string;
    target: string;
    ready?: string;
    created_at?: string;
    version?: string;
  }>();
  const { sessionKey } = useStore();
  if (version === "2")
    return <GameRoomV2 key={`${sessionKey}:${id}`} id={id} target={target} />;
  return (
    <Session
      key={`${sessionKey}:${id}`}
      id={id}
      target={target}
      createdAt={created_at}
      initiallyReady={ready === "1"}
    />
  );
}
function Session({
  id,
  target,
  initiallyReady,
  createdAt,
}: {
  id: string;
  target: string;
  initiallyReady: boolean;
  createdAt?: string;
}) {
  const { request, data, toast } = useStore();
  const {
    enabled,
    presence,
    update,
    pending: readyPending,
    error: readyError,
  } = useGameReady(target, initiallyReady);
  const [game, setGame] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  const loading = useRef<Promise<void> | null>(null);
  const acting = useRef(false);
  const [choices, setChoices] = useState([-1, -1, -1, -1, -1]),
    [statements, setStatements] = useState(["", "", ""]),
    [lie, setLie] = useState(-1),
    [guess, setGuess] = useState(-1);
  const [question, setQuestion] = useState(0),
    [review, setReview] = useState(false);
  const [entrance] = useState(() => new Animated.Value(1));
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    entrance.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: reducedMotion ? 0 : 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [question, review, entrance, reducedMotion]);
  const load = useCallback(
    async (afterAction = false) => {
      if (loading.current) {
        await loading.current;
        if (!afterAction) return;
      }
      const task = (async () => {
        try {
          const next = await findConversationGame(
            request,
            target,
            id,
            createdAt,
          );
          setGame(next);
          setUnavailable(!next);
          setError("");
        } catch (e: any) {
          setGame(null);
          setUnavailable(isUnavailable(e));
          setError(isUnavailable(e) ? "" : e.message);
        }
      })();
      loading.current = task;
      await task;
      if (loading.current === task) loading.current = null;
    },
    [request, target, id, createdAt],
  );
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
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    try {
      await request(`/game/${id}/${path}`, body);
      await load(true);
    } catch (e: any) {
      toast(e.message);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };
  const me = data?.me.id || "";
  const def = data?.games.find((g) => g.id === game?.kind);
  const person = data?.matches.find((p) => p.id === target);
  const live = enabled && presence.self && presence.partner;
  const closed =
    game && !["invited", "active", "complete"].includes(game.state);
  const currentQuestion = def?.questions[question];
  const choiceSummary = (editable: boolean) =>
    def?.questions.map((q, i) => (
      <View key={q.q} style={styles.summary}>
        <Text style={[s.small, { marginBottom: 8 }]}>QUESTION {i + 1}</Text>
        <Text style={[s.label, { marginBottom: 10 }]}>{q.q}</Text>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={[s.body, { flex: 1, color: C.ink }]}>
            {q.options[game.answered ? game.answers[me]?.[i] : choices[i]] ||
              "Not chosen"}
          </Text>
          {editable && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit answer ${i + 1}`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              style={styles.edit}
              onPress={() => {
                setQuestion(i);
                setReview(false);
              }}
            >
              <Icon name="create-outline" color={C.primary} size={20} />
            </Pressable>
          )}
        </View>
        {game.complete && (
          <View style={[s.row, { marginTop: 8 }]}>
            <Icon name="heart-outline" color={C.primary} size={16} />
            <Text style={[s.body, { flex: 1 }]}>
              {q.options[game.answers[target]?.[i]]}
            </Text>
            <Text style={s.small}>Your match ✓</Text>
          </View>
        )}
      </View>
    ));
  return (
    <Page key={`${question}:${review}:${game?.state}:${game?.answered}`}>
      <Header back title={def?.title || "Dating game"} action={<View />} />
      {!!error && (
        <>
          <Empty
            icon="cloud-offline-outline"
            title="Let’s try that again"
            body="We couldn’t open your game. Check your connection and try again."
          />
          <Button title="Retry game" secondary onPress={() => void load()} />
        </>
      )}
      {unavailable && (
        <>
          <Empty
            title="Game unavailable"
            body="This game could not be found, or the match is no longer available."
          />
          <Button
            secondary
            title="Back to Chat"
            onPress={() => router.replace("/(tabs)/chat")}
          />
        </>
      )}
      {!game && !error && !unavailable && (
        <View style={{ gap: 20 }}>
          <Skeleton height={64} />
          <Skeleton height={120} />
          <Skeleton height={180} />
        </View>
      )}
      {game && (
        <>
          {closed ? (
            <Empty
              title={`Game ${game.state}`}
              body="Send a new invitation when you’re both ready."
            />
          ) : (
            <>
              {!game.complete && (
                <View style={styles.ready}>
                  <View style={s.row}>
                    {person && <Avatar person={person} size={36} />}
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>
                        {live ? "You’re both ready." : "Ready, together?"}
                      </Text>
                      <Text style={s.small}>
                        Game closes at{" "}
                        {new Date(game.expires_at).toLocaleTimeString()}
                      </Text>
                    </View>
                    {game.state === "active" ? (
                      <IconButton
                        name={enabled ? "pause-outline" : "play-outline"}
                        label={
                          enabled ? "Stop being ready" : "I’m Ready to play"
                        }
                        variant="soft"
                        disabled={readyPending || busy}
                        onPress={() => void update(!enabled)}
                      />
                    ) : (
                      <View
                        style={[
                          styles.dot,
                          live && { backgroundColor: C.primary },
                        ]}
                      />
                    )}
                  </View>
                  {game.state !== "active" && (
                    <View style={{ marginTop: 16 }}>
                      <Button
                        secondary
                        title={
                          readyPending
                            ? "Updating readiness…"
                            : enabled
                              ? "Stop being ready"
                              : "I’m Ready to play"
                        }
                        disabled={readyPending || busy}
                        onPress={() => void update(!enabled)}
                      />
                    </View>
                  )}
                  {game.state !== "active" && (
                    <Text style={[s.small, { marginTop: 10 }]}>
                      Only this match sees your temporary status. Both players
                      must stay ready; it expires within 45 seconds of leaving.
                    </Text>
                  )}
                  {readyError && (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[s.small, { marginTop: 10 }]}
                    >
                      Readiness is unavailable. Check your connection, then try
                      your ready status again.
                    </Text>
                  )}
                </View>
              )}
              {game.state === "invited" && (
                <View style={styles.invitation}>
                  <Icon name="sparkles-outline" size={36} color={C.primary} />
                  <Text
                    style={[
                      styles.headline,
                      { textAlign: "center", marginTop: 24 },
                    ]}
                  >
                    {game.host === me
                      ? "Your invitation is waiting"
                      : "Your match wants to play"}
                  </Text>
                  <Text
                    style={[
                      s.body,
                      { textAlign: "center", marginTop: 12, marginBottom: 28 },
                    ]}
                  >
                    {game.host === me
                      ? "The game begins after your match accepts."
                      : `A little ${def?.title.toLowerCase() || "curiosity"} with ${person?.name || "your match"}?`}
                  </Text>
                  {game.guest === me && (
                    <View style={{ gap: 12, width: "100%" }}>
                      <Button
                        title={
                          busy ? "Updating invitation…" : "Accept invitation"
                        }
                        disabled={busy || readyPending || !live}
                        onPress={() =>
                          void act("respond", { response: "accept" })
                        }
                      />
                      <Button
                        title="Decline"
                        secondary
                        disabled={busy}
                        onPress={() =>
                          void act("respond", { response: "decline" })
                        }
                      />
                    </View>
                  )}
                </View>
              )}
              {(game.state === "active" || game.complete) && (
                <>
                  {game.complete && (
                    <View style={styles.complete}>
                      <Icon name="heart-outline" color={C.primary} size={32} />
                      <Text style={[s.h2, { marginTop: 16 }]}>
                        A little more to talk about.
                      </Text>
                      <Text style={[s.body, { marginTop: 8 }]}>
                        Ask about an answer that surprised you. These are
                        conversation starters, not compatibility scores.
                      </Text>
                    </View>
                  )}
                  {game.kind === "two-truths" ? (
                    <>
                      {!game.answered ? (
                        <>
                          <Text style={[styles.headline, { marginTop: 28 }]}>
                            Two truths.{"\n"}One little lie.
                          </Text>
                          <Text
                            style={[
                              s.body,
                              { marginTop: 12, marginBottom: 24 },
                            ]}
                          >
                            Write three things about yourself. Mark the invented
                            one privately.
                          </Text>
                          {statements.map((v, i) => (
                            <View key={i} style={styles.statement}>
                              <Field
                                label={`Statement ${i + 1}`}
                                value={v}
                                editable={!busy}
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
                                disabled={busy}
                                onPress={() => setLie(i)}
                              />
                            </View>
                          ))}
                          <Button
                            title={
                              busy
                                ? "Locking statements…"
                                : "Lock in my statements"
                            }
                            disabled={
                              busy ||
                              readyPending ||
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
                        </>
                      ) : !game.bothAnswered ? (
                        <Empty
                          icon="hourglass-outline"
                          title="Your statements are locked."
                          body="Your match is writing theirs. The reveal is worth the wait."
                        />
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.headline,
                              { marginTop: 28, marginBottom: 24 },
                            ]}
                          >
                            Which is your match’s lie?
                          </Text>
                          {game.answers[target].statements.map(
                            (v: string, i: number) => (
                              <View key={i} style={{ marginBottom: 12 }}>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={v}
                                  disabled={
                                    game.complete ||
                                    busy ||
                                    game.guesses[me] !== undefined
                                  }
                                  style={[
                                    styles.option,
                                    (guess === i || game.guesses[me] === i) &&
                                      styles.selected,
                                  ]}
                                  onPress={() => setGuess(i)}
                                >
                                  <Text style={styles.optionText}>{v}</Text>
                                  {(guess === i || game.guesses[me] === i) && (
                                    <Icon
                                      name="checkmark-circle"
                                      color={C.primary}
                                    />
                                  )}
                                </Pressable>
                                {game.complete &&
                                  game.answers[target].lie === i && (
                                    <Text
                                      style={[
                                        s.small,
                                        { marginTop: 8, color: C.primary },
                                      ]}
                                    >
                                      The lie ✓
                                    </Text>
                                  )}
                              </View>
                            ),
                          )}
                          {!game.complete &&
                            (game.guesses[me] === undefined ? (
                              <Button
                                title={
                                  busy ? "Locking guess…" : "Lock in my guess"
                                }
                                disabled={
                                  busy || readyPending || !live || guess < 0
                                }
                                onPress={() => void act("guess", { guess })}
                              />
                            ) : (
                              <Text style={s.body}>
                                Guess locked. Reveal happens after both guesses.
                              </Text>
                            ))}
                          {game.complete && (
                            <Text style={[s.body, { marginTop: 12 }]}>
                              Your match guessed statement{" "}
                              {game.guesses[target] + 1}. Your lie was statement{" "}
                              {game.answers[me].lie + 1}.
                            </Text>
                          )}
                        </>
                      )}
                    </>
                  ) : game.answered ? (
                    <>
                      {!game.complete && (
                        <View
                          style={[
                            styles.complete,
                            { backgroundColor: C.lavender },
                          ]}
                        >
                          <Icon
                            name="hourglass-outline"
                            color={C.primary}
                            size={28}
                          />
                          <Text style={[s.h2, { marginTop: 16 }]}>
                            Your choices are locked.
                          </Text>
                          <Text style={[s.body, { marginTop: 8 }]}>
                            Your match’s answers stay hidden until they finish
                            too.
                          </Text>
                        </View>
                      )}
                      {choiceSummary(false)}
                    </>
                  ) : review ? (
                    <>
                      <Text style={[styles.headline, { marginTop: 28 }]}>
                        Feels like you?
                      </Text>
                      <Text
                        style={[s.body, { marginTop: 12, marginBottom: 8 }]}
                      >
                        Review your choices before the reveal.
                      </Text>
                      {choiceSummary(true)}
                      <View style={{ marginTop: 24 }}>
                        <Button
                          title={
                            busy ? "Locking choices…" : "Lock in my choices"
                          }
                          disabled={
                            busy ||
                            readyPending ||
                            !live ||
                            choices.includes(-1)
                          }
                          onPress={() =>
                            void act("answer", { answers: choices })
                          }
                        />
                      </View>
                    </>
                  ) : (
                    currentQuestion && (
                      <Animated.View
                        style={{ opacity: entrance, marginTop: 28 }}
                      >
                        <StepProgress
                          current={question + 1}
                          total={def?.questions.length || 5}
                        />
                        <Text
                          style={[s.small, { color: C.primary, marginTop: 20 }]}
                        >
                          QUESTION {question + 1} / {def?.questions.length || 5}
                        </Text>
                        <Text
                          style={[
                            styles.headline,
                            { marginTop: 12, marginBottom: 28 },
                          ]}
                        >
                          {currentQuestion.q}
                        </Text>
                        <View style={{ gap: 12 }}>
                          {currentQuestion.options.map((option, j) => (
                            <Pressable
                              key={option}
                              accessibilityRole="button"
                              accessibilityLabel={option}
                              accessibilityState={{
                                selected: choices[question] === j,
                                disabled: busy,
                              }}
                              disabled={busy}
                              onPress={() =>
                                setChoices((a) =>
                                  a.map((v, k) => (k === question ? j : v)),
                                )
                              }
                              style={({ pressed }) => [
                                styles.option,
                                {
                                  backgroundColor: j % 2 ? C.lavender : C.blush,
                                  opacity: pressed ? 0.8 : 1,
                                },
                                choices[question] === j && styles.selected,
                              ]}
                            >
                              <Text style={styles.optionText}>{option}</Text>
                              {choices[question] === j && (
                                <Icon
                                  name="checkmark-circle"
                                  color={C.primary}
                                />
                              )}
                            </Pressable>
                          ))}
                        </View>
                        <View style={{ marginTop: 28, gap: 12 }}>
                          <Button
                            title={
                              question === (def?.questions.length || 5) - 1
                                ? "Review my choices"
                                : "Next question"
                            }
                            disabled={busy || choices[question] < 0}
                            onPress={() =>
                              question === (def?.questions.length || 5) - 1
                                ? setReview(true)
                                : setQuestion(question + 1)
                            }
                          />
                          {question > 0 && (
                            <Button
                              title="Previous question"
                              secondary
                              disabled={busy}
                              onPress={() => setQuestion(question - 1)}
                            />
                          )}
                        </View>
                      </Animated.View>
                    )
                  )}
                </>
              )}
            </>
          )}
          {["active", "invited"].includes(game.state) && (
            <View style={{ marginTop: 28 }}>
              <Button
                secondary
                title="Cancel game"
                disabled={busy}
                onPress={() => void act("respond", { response: "cancel" })}
              />
            </View>
          )}
          <View style={{ marginTop: 12 }}>
            <Button
              secondary
              title="Back to conversation"
              onPress={() => router.replace(`/chat/${target}`)}
            />
          </View>
        </>
      )}
    </Page>
  );
}
const styles = StyleSheet.create({
  headline: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "600",
    color: C.ink,
    letterSpacing: -0.7,
  },
  ready: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.line },
  invitation: { alignItems: "center", paddingVertical: 36 },
  option: {
    minHeight: 100,
    padding: 24,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: C.blush,
  },
  selected: { borderColor: C.primary },
  optionText: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "500",
    color: C.ink,
  },
  summary: {
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  edit: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  statement: { marginBottom: 24 },
  complete: {
    padding: 24,
    backgroundColor: C.blush,
    borderRadius: 18,
    marginTop: 24,
  },
});
