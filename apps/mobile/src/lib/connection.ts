import { Platform } from "react-native";
const configured = process.env.EXPO_PUBLIC_API_URL;
export const defaultServer =
  configured?.replace(/\/$/, "") ||
  (Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : Platform.OS === "android"
      ? "http://10.0.2.2:4100"
      : "http://localhost:4100");
export const connectionSettingsEnabled =
  process.env.EXPO_PUBLIC_CONNECTION_SETTINGS === "true" ||
  (__DEV__ && process.env.EXPO_PUBLIC_CONNECTION_SETTINGS !== "false");
