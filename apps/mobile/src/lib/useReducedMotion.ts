import { useSyncExternalStore } from "react";
import { AccessibilityInfo, Platform } from "react-native";

function initialPreference() {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.matchMedia
  )
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Start quietly until native settings arrive. The shared snapshot means a
  // newly opened sheet uses the preference already read by the app shell.
  return true;
}
let reduced = initialPreference();
const listeners = new Set<() => void>();
let subscription:
  ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
let revision = 0;
function update(value: boolean) {
  if (reduced === value) return;
  reduced = value;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const pendingRevision = ++revision;
    subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        revision += 1;
        update(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        // A later system event or an unmount wins over this initial read.
        if (listeners.size && revision === pendingRevision) update(value);
      })
      .catch(() => {
        if (listeners.size && revision === pendingRevision) update(true);
      });
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      revision += 1;
      subscription?.remove();
      subscription = undefined;
    }
  };
}
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => reduced,
    () => true,
  );
}
