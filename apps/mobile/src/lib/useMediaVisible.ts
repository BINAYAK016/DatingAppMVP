import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
export function useMediaVisible() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (s) =>
      setForeground(s === "active"),
    );
    return () => subscription.remove();
  }, []);
  // Android fullscreen pauses the React Activity, but still owns this player.
  // Expo handles real background playback pause; route blur still unmounts it.
  return focused && (Platform.OS === "android" || foreground);
}
