import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useStore } from "./store";

export function useGameReady(target: string, initiallyReady = false) {
  const { request, toast } = useStore();
  const [enabled, setEnabled] = useState(initiallyReady);
  const [presence, setPresence] = useState({ self: false, partner: false });
  const update = useCallback(
    async (on: boolean) => {
      try {
        setPresence(await request(`/game-ready/${target}`, { enabled: on }));
        setEnabled(on);
      } catch (e: any) {
        toast(e.message);
        setEnabled(false);
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
          if (alive) setPresence(next);
        } catch {
          if (alive) setPresence({ self: false, partner: false });
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
  return { enabled, presence, update };
}
