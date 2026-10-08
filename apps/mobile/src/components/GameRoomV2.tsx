import React, { useEffect, useState } from "react";
import {
  Animated,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useIsFocused } from "expo-router";
import * as Haptics from "expo-haptics";
import { useStore } from "../lib/store";
import { blankGameForm, useGameSessionV2 } from "../lib/useGameSessionV2";
import { useReducedMotion } from "../lib/useReducedMotion";
import { prepareGameConversation } from "../lib/gameChatBridge";
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
  s,
  Skeleton,
  StepProgress,
  T,
} from "./ui";

export function GameRoomV2({ id, target }: { id: string; target?: string }) {
  const st = useStore(),
    account = st.data?.me.id || "";
  const game = useGameSessionV2(id),
    session = game.session;
  const { restored, pending, form, setForm, reload } = game;
  const focused = useIsFocused();
  const partnerTarget = session
    ? session.host === account
      ? session.guest
      : session.host
    : target;
  const [now, setNow] = useState(() => Date.now());
  const reducedMotion = useReducedMotion();
  const [fade] = useState(() => new Animated.Value(1));
  const topic = session
    ? `${session.state}:${session.view.phase}:${session.view.round}:${session.view.question?.id || ""}`
    : "";
  const person = st.data?.matches.find((p) => p.id === partnerTarget);
  const blocked = game.busy || !!game.pending || !game.restored;
  useEffect(() => {
    if (topic && restored && !pending && form.topic !== topic)
      setForm(blankGameForm(topic));
  }, [topic, restored, pending, form.topic, setForm]);
  useEffect(() => {
    fade.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: reducedMotion ? 0 : 160,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [topic, reducedMotion, fade]);
  useEffect(() => {
    const deadline = session?.view.deadline;
    if (!deadline || !focused) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== "active") return;
      setNow(Date.now());
      if (new Date(deadline).getTime() <= Date.now()) void reload();
    }, 1000);
    return () => clearInterval(timer);
  }, [session?.view.deadline, focused, reload]);
  const choose = (choice: string) => {
    game.setForm({ ...game.form, choice });
    if (Platform.OS !== "web" && !reducedMotion)
      void Haptics.selectionAsync().catch(() => {});
  };
  const backToChat = (prompt?: string) => {
    if (!partnerTarget) {
      router.replace("/(tabs)/chat");
      return;
    }
    if (prompt) prepareGameConversation(account, partnerTarget, prompt, st.url);
    router.dismissTo(`/chat/${partnerTarget}`);
  };
  const another = () => {
    if (partnerTarget)
      router.replace({ pathname: "/games", params: { target: partnerTarget } });
  };
  const playAgain = () => {
    if (partnerTarget && session)
      router.replace({
        pathname: "/games",
        params: { target: partnerTarget, kind: session.kind },
      });
  };
  const options = (values: { id: string; label: string }[]) => (
    <View style={{ gap: 12 }}>
      {values.map((option, i) => (
        <Pressable
          key={option.id}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{
            selected: game.form.choice === option.id,
            disabled: blocked,
          }}
          disabled={blocked}
          onPress={() => choose(option.id)}
          style={[
            styles.option,
            { backgroundColor: i % 2 ? C.lavender : C.blush },
            game.form.choice === option.id && styles.selected,
          ]}
        >
          <Text style={styles.optionText}>{option.label}</Text>
          {game.form.choice === option.id && (
            <Icon name="checkmark-circle" color={C.primary} />
          )}
        </Pressable>
      ))}
    </View>
  );
  const view = session?.view;
  const seconds = view?.deadline
    ? Math.max(0, Math.ceil((new Date(view.deadline).getTime() - now) / 1000))
    : null;
  const closed =
    session && !["invited", "active", "complete"].includes(session.state);
  return (
    <Page key={topic}>
      <Header
        back
        title={session?.definition.title || "Play together"}
        action={
          partnerTarget ? (
            <IconButton
              name="shield-checkmark-outline"
              label="Game safety"
              onPress={() =>
                router.push({
                  pathname: "/safety",
                  params: {
                    target: partnerTarget,
                    context: "game",
                    gameId: id,
                  },
                })
              }
            />
          ) : undefined
        }
      />
      {!!game.error && (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text style={s.body}>{game.error}</Text>
          <Button
            secondary
            title={game.pending ? "Retry last action" : "Refresh game"}
            disabled={game.busy}
            onPress={game.pending ? game.retry : () => void game.reload()}
          />
        </View>
      )}
      {game.unavailable ? (
        <>
          <Empty
            title="Game unavailable"
            body="This game or match is no longer available."
          />
          <Button
            title="Back to Chat"
            secondary
            onPress={() => router.replace("/(tabs)/chat")}
          />
        </>
      ) : !session && game.error ? (
        <Empty
          icon="dice-outline"
          title="Your game can wait"
          body="Refresh when your connection returns. Your saved progress stays with your game."
        />
      ) : !session || !game.restored ? (
        <View style={{ gap: 18 }}>
          <Skeleton height={60} />
          <Skeleton height={160} />
          <Skeleton height={100} />
        </View>
      ) : (
        <>
          <View style={[s.row, styles.pair]}>
            {person && <Avatar person={person} size={36} />}
            <View style={{ flex: 1 }}>
              <Text style={s.label}>You + {person?.name || "your match"}</Text>
              <Text style={s.small}>
                Play at your own pace · Private to this match
              </Text>
            </View>
          </View>
          {session.state === "invited" ? (
            <View style={[styles.invitation, { gap: 16 }]}>
              <Text style={styles.emoji}>{session.definition.emoji}</Text>
              <Text accessibilityRole="header" style={styles.headline}>
                {session.guest === account
                  ? `${person?.name || "Your match"} wants to play`
                  : "Your invitation is waiting"}
              </Text>
              <Text style={s.body}>{session.definition.subtitle}</Text>
              <Text style={s.small}>
                {session.definition.durationMinutes} min · Invite expires{" "}
                {new Date(session.expires_at).toLocaleString()}
              </Text>
              {session.guest === account ? (
                <>
                  <Button
                    title={game.busy ? "Joining…" : "Let’s play"}
                    loading={game.busy}
                    disabled={blocked}
                    onPress={() => void game.act("accept")}
                  />
                  <Button
                    title="Maybe Later"
                    secondary
                    disabled={blocked}
                    onPress={() => void game.act("decline")}
                  />
                </>
              ) : (
                <Text style={s.body}>
                  They can accept when they return. You don’t both need to be
                  online.
                </Text>
              )}
            </View>
          ) : closed ? (
            <>
              <Empty
                title={`Game ${session.state}`}
                body="You can start something new whenever you both feel like it."
              />
              <Button title="Try another game" onPress={another} />
            </>
          ) : session.complete && session.results ? (
            <>
              <View style={styles.result}>
                <Icon name="heart-outline" size={36} color={C.primary} />
                <Text
                  accessibilityRole="header"
                  style={[styles.headline, { marginTop: 16 }]}
                >
                  {session.results.heading}
                </Text>
                <Text style={[s.body, { marginTop: 12 }]}>
                  A conversation starter. These choices don’t measure how
                  compatible or safe someone is.
                </Text>
              </View>
              {!!session.results.agree.length && (
                <Text style={[s.h2, { marginTop: 24 }]}>You agreed on…</Text>
              )}
              {session.results.agree.map((answer) => (
                <View key={answer.question} style={styles.reveal}>
                  <Text style={s.label}>{answer.question}</Text>
                  <Text style={[s.body, { marginTop: 8 }]}>
                    You both picked {answer.choice}
                  </Text>
                </View>
              ))}
              {!!session.results.different.length && (
                <Text style={[s.h2, { marginTop: 24 }]}>
                  You see things differently on…
                </Text>
              )}
              {session.results.different.map((answer) => (
                <View key={answer.question} style={styles.reveal}>
                  <Text style={s.label}>{answer.question}</Text>
                  <Text style={[s.body, { marginTop: 8 }]}>
                    You: {answer.you}
                    {"\n"}
                    {person?.name || "Your match"}: {answer.partner}
                  </Text>
                </View>
              ))}
              {session.results.reveals.map((answer, i) => (
                <View key={i} style={styles.reveal}>
                  <Text style={s.label}>{answer.title}</Text>
                  <Text style={[s.body, { marginTop: 8 }]}>{answer.body}</Text>
                </View>
              ))}
              <View style={{ gap: 12, marginTop: 24 }}>
                <Button
                  title="Talk about it"
                  onPress={() =>
                    backToChat(session.results!.conversationPrompt)
                  }
                />
                <Button title="Play again" secondary onPress={playAgain} />
                <Button title="Try another game" secondary onPress={another} />
              </View>
            </>
          ) : (
            view && (
              <Animated.View style={{ opacity: fade }}>
                <StepProgress
                  current={Math.min(view.round + 1, view.total)}
                  total={view.total}
                />
                <Text
                  style={[
                    s.small,
                    {
                      color: C.brandTextOnTint,
                      marginTop: 16,
                      marginBottom: 12,
                    },
                  ]}
                >
                  ROUND {Math.min(view.round + 1, view.total)} / {view.total}
                  {seconds !== null ? ` · ${seconds}s left` : ""}
                </Text>
                {view.phase === "waiting" ? (
                  <Empty
                    icon="hourglass-outline"
                    title={`Waiting for ${person?.name || "your match"}…`}
                    body="Your saved progress is safe. Return to Chat or come back later."
                  />
                ) : view.phase === "start-timer" ? (
                  <>
                    <Text accessibilityRole="header" style={styles.headline}>
                      Ten choices. No overthinking.
                    </Text>
                    <Text style={[s.body, { marginTop: 12, marginBottom: 24 }]}>
                      Your 90 seconds start when you tap below. The timer keeps
                      running if you leave. Your match can play their own round
                      later.
                    </Text>
                    <Button
                      title="Start my 90 seconds"
                      disabled={blocked}
                      onPress={() => void game.act("start-timer")}
                    />
                  </>
                ) : ["choices", "set-answer", "guess-answer"].includes(
                    view.phase,
                  ) && view.question ? (
                  <>
                    <Text accessibilityRole="header" style={styles.headline}>
                      {view.phase === "guess-answer"
                        ? `Guess their answer: ${view.question.q}`
                        : view.question.q}
                    </Text>
                    <Text style={[s.body, { marginTop: 12, marginBottom: 24 }]}>
                      {view.phase === "set-answer"
                        ? "Pick your answer privately. Your match will guess next."
                        : view.phase === "guess-answer"
                          ? "Their answer stays hidden until your guess is locked."
                          : "Choose, then lock it in. Reveal happens after you both answer."}
                    </Text>
                    {options(view.question.options)}
                    <View style={{ marginTop: 24 }}>
                      <Button
                        title={
                          game.busy
                            ? "Saving answer…"
                            : view.phase === "guess-answer"
                              ? "Lock in my guess"
                              : "Lock in my answer"
                        }
                        disabled={blocked || !game.form.choice || seconds === 0}
                        onPress={() =>
                          void game.act(
                            view.phase === "choices"
                              ? "choice"
                              : view.phase === "set-answer"
                                ? "set-answer"
                                : "guess",
                            view.phase === "choices"
                              ? {
                                  questionId: view.question!.id,
                                  choiceId: game.form.choice,
                                }
                              : {
                                  round: view.round,
                                  choiceId: game.form.choice,
                                },
                          )
                        }
                      />
                    </View>
                    {session.definition.mechanic === "rapid" && (
                      <Button
                        title="Finish my round"
                        secondary
                        disabled={blocked || seconds === 0}
                        onPress={() => void game.act("finish")}
                      />
                    )}
                  </>
                ) : view.phase === "write-truths" ? (
                  <>
                    <Text accessibilityRole="header" style={styles.headline}>
                      Two truths. One little lie.
                    </Text>
                    <Text style={[s.body, { marginTop: 12, marginBottom: 24 }]}>
                      Write three different things about yourself. Mark the
                      invented one privately.
                    </Text>
                    {game.form.statements.map((value, i) => (
                      <View key={i} style={{ marginBottom: 20 }}>
                        <Field
                          label={`Statement ${i + 1}`}
                          value={value}
                          editable={!blocked}
                          onChangeText={(text) =>
                            game.setForm({
                              ...game.form,
                              statements: game.form.statements.map((old, n) =>
                                n === i ? text.slice(0, 180) : old,
                              ),
                            })
                          }
                        />
                        <Chip
                          label={`Statement ${i + 1} is the lie`}
                          selected={game.form.lie === i}
                          disabled={blocked}
                          onPress={() => game.setForm({ ...game.form, lie: i })}
                        />
                      </View>
                    ))}
                    <Button
                      title={
                        game.busy
                          ? "Locking statements…"
                          : "Lock in my statements"
                      }
                      disabled={
                        blocked ||
                        game.form.lie < 0 ||
                        game.form.statements.some((s) => !s.trim()) ||
                        new Set(
                          game.form.statements.map((s) =>
                            s.trim().toLowerCase(),
                          ),
                        ).size !== 3
                      }
                      onPress={() =>
                        void game.act("submit-truths", {
                          round: view.round,
                          statements: game.form.statements,
                          lie: game.form.lie,
                        })
                      }
                    />
                  </>
                ) : view.phase === "guess-truths" ? (
                  <>
                    <Text style={[styles.headline, { marginBottom: 24 }]}>
                      Which is their lie?
                    </Text>
                    {options(
                      (view.statements || []).map((label, i) => ({
                        id: String(i),
                        label,
                      })),
                    )}
                    <View style={{ marginTop: 24 }}>
                      <Button
                        title={
                          game.busy ? "Locking guess…" : "Lock in my guess"
                        }
                        disabled={blocked || !game.form.choice}
                        onPress={() =>
                          void game.act("guess", {
                            round: view.round,
                            value: Number(game.form.choice),
                          })
                        }
                      />
                    </View>
                  </>
                ) : view.phase === "ask" || view.phase === "respond" ? (
                  <>
                    <Text accessibilityRole="header" style={styles.headline}>
                      {view.phase === "ask"
                        ? "What are you curious about?"
                        : view.prompt}
                    </Text>
                    {view.phase === "ask" && (
                      <>
                        <Text style={[s.body, { marginVertical: 16 }]}>
                          Use a suggestion or ask your own.
                        </Text>
                        <View style={{ gap: 10, marginBottom: 20 }}>
                          {session.definition.suggestions
                            ?.slice(view.round % 3, (view.round % 3) + 3)
                            .map((suggestion) => (
                              <Button
                                key={suggestion}
                                title={suggestion}
                                secondary
                                disabled={blocked}
                                onPress={() =>
                                  game.setForm({
                                    ...game.form,
                                    text: suggestion,
                                  })
                                }
                              />
                            ))}
                        </View>
                      </>
                    )}
                    <Field
                      label={
                        view.phase === "ask" ? "Your question" : "Your answer"
                      }
                      value={game.form.text}
                      multiline
                      editable={!blocked}
                      onChangeText={(text) =>
                        game.setForm({
                          ...game.form,
                          text: text.slice(0, view.phase === "ask" ? 180 : 500),
                        })
                      }
                    />
                    <Button
                      title={
                        game.busy
                          ? "Sending…"
                          : view.phase === "ask"
                            ? "Ask my question"
                            : "Share my answer"
                      }
                      disabled={blocked || !game.form.text.trim()}
                      onPress={() =>
                        void game.act(
                          view.phase === "ask" ? "ask" : "respond",
                          { round: view.round, text: game.form.text },
                        )
                      }
                    />
                  </>
                ) : null}
                {!!view.revealed.length && (
                  <>
                    <Text style={[s.h2, { marginTop: 28 }]}>
                      What you’ve discovered
                    </Text>
                    {view.revealed.map((answer, i) => (
                      <View key={i} style={styles.reveal}>
                        <Text style={s.label}>{answer.title}</Text>
                        <Text style={[s.body, { marginTop: 8 }]}>
                          {answer.body}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </Animated.View>
            )
          )}
          {["invited", "active"].includes(session.state) && (
            <View style={{ marginTop: 28 }}>
              <Button
                title="Cancel game"
                secondary
                disabled={blocked}
                onPress={() => void game.act("cancel")}
              />
            </View>
          )}
          <View style={{ marginTop: 12 }}>
            <Button
              title="Back to conversation"
              secondary
              onPress={() => backToChat()}
            />
          </View>
        </>
      )}
    </Page>
  );
}
const styles = StyleSheet.create({
  headline: {
    ...T.type.title,
  },
  pair: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
  },
  invitation: {
    backgroundColor: C.peach,
    padding: 24,
    borderRadius: T.radius.card,
  },
  emoji: { fontSize: 42, marginVertical: 8 },
  option: {
    minHeight: 84,
    padding: 20,
    borderRadius: T.radius.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: { borderColor: C.primary },
  optionText: { flex: 1, fontSize: 18, lineHeight: 27, color: C.ink },
  notice: {
    backgroundColor: C.peach,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 12,
  },
  reveal: {
    padding: 20,
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  result: {
    padding: 24,
    backgroundColor: C.blush,
    borderRadius: T.radius.card,
  },
});
