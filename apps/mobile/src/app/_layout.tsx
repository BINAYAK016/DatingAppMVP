import React, { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Provider, useStore } from "../lib/store";
import { C, humanMessage } from "../components/ui";
import { useReducedMotion } from "../lib/useReducedMotion";
function Shell() {
  const { notice, token } = useStore();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (Platform.OS === "web" || !token) return;
    const redirect = (response: Notifications.NotificationResponse) => {
      if (response.notification.request.content.data?.url === "/(tabs)/chat")
        router.push("/(tabs)/chat");
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      redirect(last);
      Notifications.clearLastNotificationResponse();
    }
    const listener =
      Notifications.addNotificationResponseReceivedListener(redirect);
    return () => listener.remove();
  }, [token]);
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: reduced ? "none" : "slide_from_right",
        }}
      >
        <Stack.Screen
          name="games"
          options={{
            presentation: "transparentModal",
            animation: "none",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </Stack>
      {!!notice && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: insets.bottom + 82,
            left: 20,
            right: 20,
            padding: 16,
            borderRadius: 16,
            backgroundColor: C.primary,
            zIndex: 100,
          }}
        >
          <Text
            accessibilityRole="alert"
            style={{ color: "white", fontSize: 14, lineHeight: 21 }}
          >
            {humanMessage(notice)}
          </Text>
        </View>
      )}
    </>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <Provider>
        <Shell />
      </Provider>
    </SafeAreaProvider>
  );
}
