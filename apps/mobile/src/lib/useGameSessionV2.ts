import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Crypto from "expo-crypto";
import { useStore } from "./store";
import { GameActionRequestV2, GameActionV2, GameSessionV2 } from "./gameV2";
import { gameDraftScope, readGameDraft, saveGameDraft } from "./gameDrafts";

export type GameFormV2 = {
  topic: string;
  choice: string;
  statements: string[];
  lie: number;
  text: string;
};
type Draft = { form: GameFormV2; pending: GameActionRequestV2 | null };
export const blankGameForm = (topic = ""): GameFormV2 => ({
  topic,
  choice: "",
  statements: ["", "", ""],
  lie: -1,
  text: "",
});
export function useGameSessionV2(id: string) {
  const { request, data } = useStore();
  const account = data?.me.id || "";
  const [scope] = useState(() => gameDraftScope(account));
  const [session, setSession] = useState<GameSessionV2 | null>(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [draft, setDraftState] = useState<Draft>({
    form: blankGameForm(),
    pending: null,
  });
  const draftRef = useRef(draft),
    sessionRef = useRef(session);
  const mounted = useRef(true),
    focused = useRef(false),
    acting = useRef(false),
    loading = useRef(false);
  const failures = useRef(0);
  const unavailableRef = useRef(false);
  const setDraft = useCallback((next: Draft) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);
  const accept = useCallback((next: GameSessionV2) => {
    if (!mounted.current) return;
    if (!sessionRef.current || next.revision >= sessionRef.current.revision) {
      sessionRef.current = next;
      setSession(next);
      unavailableRef.current = false;
      setUnavailable(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    if (account)
      void readGameDraft<Draft>(account, id, scope)
        .then((saved) => {
          if (
            alive &&
            !unavailableRef.current &&
            saved?.form &&
            typeof saved.form.topic === "string" &&
            saved.form.topic.length <= 200 &&
            typeof saved.form.text === "string" &&
            saved.form.text.length <= 500 &&
            typeof saved.form.choice === "string" &&
            saved.form.choice.length <= 100 &&
            Number.isInteger(saved.form.lie) &&
            Array.isArray(saved.form.statements) &&
            saved.form.statements.length === 3 &&
            saved.form.statements.every(
              (v) => typeof v === "string" && v.length <= 180,
            )
          ) {
            const previous = saved.pending;
            const validPending =
              previous &&
              typeof previous.clientId === "string" &&
              previous.clientId.length <= 100 &&
              Number.isInteger(previous.expectedRevision) &&
              previous.expectedRevision >= 0 &&
              [
                "accept",
                "decline",
                "cancel",
                "choice",
                "start-timer",
                "finish",
                "submit-truths",
                "guess",
                "set-answer",
                "ask",
                "respond",
              ].includes(previous.action)
                ? previous
                : null;
            setDraft({ form: saved.form, pending: validPending });
            if (validPending)
              setError(
                "An earlier action may still be pending. Retry it safely before making another choice.",
              );
          }
        })
        .catch(() => {
          if (alive)
            setError(
              "We couldn't restore this device's draft. Your saved game progress is safe.",
            );
        })
        .finally(() => {
          if (alive) setRestored(true);
        });
    return () => {
      alive = false;
      mounted.current = false;
    };
  }, [account, id, setDraft, scope]);
  const persist = useCallback(
    async (next: Draft) => {
      if (
        account &&
        mounted.current &&
        !unavailableRef.current &&
        (!sessionRef.current ||
          ["invited", "active"].includes(sessionRef.current.state))
      )
        await saveGameDraft(account, id, next, scope);
    },
    [account, id, scope],
  );
  useEffect(() => {
    if (
      !restored ||
      unavailable ||
      (session && !["invited", "active"].includes(session.state))
    )
      return;
    const timer = setTimeout(
      () =>
        void persist(draft).catch(() => {
          if (mounted.current)
            setError(
              "Your draft couldn't be saved on this device. Keep this screen open and try again.",
            );
        }),
      350,
    );
    return () => clearTimeout(timer);
  }, [draft, restored, persist, unavailable, session]);
  const reload = useCallback(
    async (preserveError = false) => {
      if (loading.current || !account || AppState.currentState !== "active")
        return;
      loading.current = true;
      try {
        const next = await request<GameSessionV2>(`/game/${id}`);
        if (mounted.current && focused.current) {
          accept(next);
          failures.current = 0;
          if (!preserveError && !draftRef.current.pending) setError("");
        }
      } catch (e: any) {
        failures.current++;
        if (mounted.current && focused.current) {
          if (e.status === 403 || e.status === 404) {
            unavailableRef.current = true;
            sessionRef.current = null;
            setSession(null);
            setUnavailable(true);
            setDraft({ form: blankGameForm(), pending: null });
            void saveGameDraft(account, id, null, scope).catch(() => {});
          } else
            setError(e.message || "Your game couldn't refresh. Try again.");
        }
      } finally {
        loading.current = false;
      }
    },
    [request, account, id, accept, setDraft, scope],
  );
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      let alive = true,
        timer: ReturnType<typeof setTimeout>;
      const poll = async () => {
        if (AppState.currentState === "active") await reload();
        if (
          alive &&
          !unavailableRef.current &&
          (!sessionRef.current ||
            ["invited", "active"].includes(sessionRef.current.state))
        )
          timer = setTimeout(
            () => void poll(),
            Math.min(
              30000,
              (sessionRef.current?.state === "invited" ? 10000 : 4000) *
                2 ** Math.min(failures.current, 3),
            ),
          );
      };
      void poll();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void reload();
        else void persist(draftRef.current).catch(() => {});
      });
      return () => {
        alive = false;
        focused.current = false;
        clearTimeout(timer);
        listener.remove();
      };
    }, [reload, persist]),
  );
  const act = useCallback(
    async (action: GameActionV2, payload: unknown = {}, retry = false) => {
      if (
        acting.current ||
        !mounted.current ||
        unavailableRef.current ||
        !sessionRef.current ||
        !restored
      )
        return;
      if (draftRef.current.pending && !retry) {
        setError("Retry the pending action before making another choice.");
        return;
      }
      acting.current = true;
      setBusy(true);
      const pending =
        retry && draftRef.current.pending
          ? {
              ...draftRef.current.pending,
              expectedRevision: sessionRef.current.revision,
            }
          : {
              clientId: Crypto.randomUUID(),
              expectedRevision: sessionRef.current.revision,
              action,
              payload,
            };
      const next = { ...draftRef.current, pending };
      setDraft(next);
      try {
        await persist(next);
        if (!mounted.current || unavailableRef.current) return;
        const result = await request<GameSessionV2>(
          `/game/${id}/action`,
          pending,
        );
        accept(result);
        const cleared = { form: blankGameForm(), pending: null };
        if (!mounted.current) return;
        setDraft(cleared);
        if (
          result.state === "complete" ||
          !["invited", "active"].includes(result.state)
        )
          await saveGameDraft(account, id, null, scope);
        else await persist(cleared);
        if (mounted.current) setError("");
      } catch (e: any) {
        if (mounted.current)
          setError(
            e.message ||
              "This action couldn't finish. Your draft is still here.",
          );
        if (mounted.current && [400, 409].includes(e.status)) {
          const editable = { ...draftRef.current, pending: null };
          setDraft(editable);
          await persist(editable).catch(() => {});
        }
        if (mounted.current) await reload(true);
      } finally {
        acting.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [restored, setDraft, persist, request, id, accept, reload, account, scope],
  );
  const setForm = useCallback(
    (form: GameFormV2) => {
      if (mounted.current && !unavailableRef.current)
        setDraft({ ...draftRef.current, form });
    },
    [setDraft],
  );
  const retry = () => {
    const p = draftRef.current.pending;
    if (p) void act(p.action, p.payload, true);
  };
  return {
    session,
    error,
    unavailable,
    busy,
    restored,
    form: draft.form,
    pending: draft.pending,
    setForm,
    act,
    retry,
    reload,
  };
}
