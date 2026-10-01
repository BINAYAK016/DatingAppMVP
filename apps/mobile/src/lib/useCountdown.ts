import { useEffect, useState } from "react";
export function useCountdown(until?: string | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [until]);
  return until
    ? Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000))
    : 0;
}
export const countdownLabel = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
