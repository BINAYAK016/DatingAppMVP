import { useEffect, useState } from "react";
import { useStore } from "./store";
export function useGoogleConfig(enabled: boolean) {
  const { request } = useStore();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      void request<{ google: boolean }>("/auth/config")
        .then((config) => {
          if (active) setAvailable(config.google);
        })
        .catch(() => {
          if (active) {
            setAvailable(false);
            setError(true);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, request, attempt]);
  return {
    available: enabled && available,
    loading,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
