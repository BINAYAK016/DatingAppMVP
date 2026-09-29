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
import { C } from "../components/ui";
function Shell() {
  const { notice, token } = useStore();
  const insets = useSafeAreaInsets();
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
          animation: "slide_from_right",
        }}
      />
      {!!notice && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 20,
            right: 20,
            padding: 16,
            borderRadius: 16,
            backgroundColor: C.primary,
            zIndex: 100,
          }}
        >
          <Text style={{ color: "white", fontSize: 13 }}>{notice}</Text>
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
