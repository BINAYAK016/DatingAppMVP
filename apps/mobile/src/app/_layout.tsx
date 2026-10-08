import React, { useEffect } from "react";
import { Stack, router, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { AppFrame } from "../components/AppFrame";
import { NotificationListener } from "../components/NotificationListener";
import { AuthRecovery } from "../components/AuthRecovery";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Provider, useStore } from "../lib/store";
import { C, T, s, humanMessage, Button, Loading } from "../components/ui";
import { useReducedMotion } from "../lib/useReducedMotion";
function Shell() {
  const {
    notice,
    token,
    data,
    ready,
    storageWarning,
    clearSavedSignIn,
    bootstrapError,
    retryBootstrap,
  } = useStore();
  const covered = !ready || !!bootstrapError || (!!token && !data);
  const pathname = usePathname();
  const segments = useSegments();
  const group = segments[0];
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  useEffect(() => {
    const publicRoute =
      (pathname === "/" && group !== "(tabs)") ||
      pathname === "/welcome" ||
      pathname === "/demo" ||
      pathname === "/reset-password";
    if (ready && !bootstrapError && !token && !publicRoute)
      router.replace("/welcome");
  }, [ready, token, pathname, group, bootstrapError]);
  return (
    <>
      <StatusBar style="dark" />
      <NotificationListener />
      <View
        style={{ flex: 1 }}
        aria-hidden={covered}
        importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
        pointerEvents={covered ? "none" : "auto"}
      >
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
      </View>
      {covered && !bootstrapError && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: C.bg,
            zIndex: 200,
          }}
        >
          {ready && token ? <AuthRecovery /> : <Loading />}
        </View>
      )}
      {!!bootstrapError && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: C.bg,
            zIndex: 200,
            justifyContent: "center",
            padding: 28,
            gap: 20,
          }}
        >
          <Text accessibilityRole="header" style={s.title}>
            Let’s reconnect
          </Text>
          <Text
            accessibilityRole="alert"
            style={{ color: C.muted, fontSize: 16, lineHeight: 25 }}
          >
            {bootstrapError}
          </Text>
          <Button title="Retry connection" onPress={retryBootstrap} />
        </View>
      )}
      {!token && storageWarning && (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + 20,
            left: 20,
            right: 20,
            padding: 16,
            borderRadius: 16,
            backgroundColor: C.peach,
            zIndex: 101,
            gap: 12,
          }}
        >
          <Text accessibilityRole="alert" style={{ color: C.ink }}>
            Signed out here. This device could not clear the saved sign-in.
            Retry before closing the app.
          </Text>
          <Button
            title="Clear saved sign-in"
            onPress={() => void clearSavedSignIn()}
          />
        </View>
      )}
      {!!notice && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: insets.bottom + 82,
            left: 20,
            right: 20,
            padding: 16,
            borderRadius: T.radius.card,
            backgroundColor: C.primary,
            ...T.shadow.raised,
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
        <AppFrame>
          <Shell />
        </AppFrame>
      </Provider>
    </SafeAreaProvider>
  );
}
