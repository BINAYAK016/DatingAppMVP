import type { ExpoConfig, ConfigContext } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Sangai Beta",
  slug: "sangai-beta",
  version: "0.1.0",
  icon: "./assets/sangai-icon.png",
  scheme: "sangai",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.sangai.beta",
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  android: {
    package: "com.sangai.beta",
    predictiveBackGestureEnabled: true,
    adaptiveIcon: {
      foregroundImage: "./assets/sangai-icon.png",
      backgroundColor: "#203E36",
    },
  },
  web: { favicon: "./assets/sangai-icon.png" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-video",
    "expo-notifications",
    ["expo-build-properties", { android: { usesCleartextTraffic: true } }],
    [
      "expo-image-picker",
      {
        photosPermission: "Choose a photo or video to share with your matches.",
        cameraPermission: "Capture a moment for your matches.",
        microphonePermission: "Record audio with your video snaps.",
      },
    ],
  ],
  experiments: { typedRoutes: false },
  extra: process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
    : {},
});
