import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useStore } from "./store";

export function useGameReady(target: string, initiallyReady = false) {
  const { request, toast } = useStore();
  const [enabled, setEnabled] = useState(initiallyReady);
  const [presence, setPresence] = useState({ self: false, partner: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const updating = useRef(false);
  const update = useCallback(
    async (on: boolean) => {
      if (updating.current) return;
      updating.current = true;
      setPending(true);
      try {
        setPresence(await request(`/game-ready/${target}`, { enabled: on }));
        setEnabled(on);
        setError(false);
      } catch (e: any) {
        toast(e.message);
        setEnabled(false);
        setPresence({ self: false, partner: false });
        setError(true);
      } finally {
        updating.current = false;
        setPending(false);
      }
    },
    [request, target, toast],
  );
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = async () => {
        if (!target || AppState.currentState !== "active") return;
        try {
          const next = enabled
            ? await request(`/game-ready/${target}`, { enabled: true })
            : await request(`/game-ready/${target}`);
          if (alive && !updating.current) {
            setPresence(next);
            setError(false);
          }
        } catch {
          if (alive && !updating.current) {
            setPresence({ self: false, partner: false });
            setError(true);
          }
        }
      };
      void load();
      const timer = setInterval(() => void load(), 10000);
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void load();
      });
      return () => {
        alive = false;
        clearInterval(timer);
        listener.remove();
      };
    }, [enabled, target, request]),
  );
  return { enabled, presence, update, pending, error };
}
