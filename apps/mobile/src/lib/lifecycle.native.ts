import { AppState } from "react-native";
export const isForeground = () => AppState.currentState === "active";
export function listenForVisibility(callback: (visible: boolean) => void) {
  const subscription = AppState.addEventListener("change", (state) =>
    callback(state === "active"),
  );
  return () => subscription.remove();
}
export function listenForResume(callback: () => void) {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") callback();
  });
  return () => subscription.remove();
}
