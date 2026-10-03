export const isForeground = () =>
  typeof document !== "undefined" && document.visibilityState === "visible";
export function listenForVisibility(callback: (visible: boolean) => void) {
  const changed = () => callback(isForeground());
  document.addEventListener("visibilitychange", changed);
  return () => document.removeEventListener("visibilitychange", changed);
}
export function listenForResume(callback: () => void) {
  const visible = () => {
    if (isForeground()) callback();
  };
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("online", visible);
  return () => {
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("online", visible);
  };
}
