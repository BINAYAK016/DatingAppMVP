import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { isForeground, listenForVisibility } from "./lifecycle";
import { useFocusEffect } from "expo-router";
export function useMediaVisible() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(isForeground());
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    return listenForVisibility(setForeground);
  }, []);
  // Android fullscreen pauses the React Activity, but still owns this player.
  // Expo handles real background playback pause; route blur still unmounts it.
  return focused && (Platform.OS === "android" || foreground);
}
