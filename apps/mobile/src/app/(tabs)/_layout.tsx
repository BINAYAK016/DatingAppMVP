import React from "react";
import { Platform, Text, View, useWindowDimensions } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { useStore } from "../../lib/store";
import { C, Icon, Loading } from "../../components/ui";
import { DemoBar } from "../../components/DemoBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function Layout() {
  const { ready, token, data, demoMode, sessionKey } = useStore();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const wideWeb = Platform.OS === "web" && width >= 1024;
  if (!ready) return <Loading />;
  if (!token) return <Loading />;
  if (!data) return <Loading />;
  if (!data.me.demo && (!data.me.email_verified_at || !data.me.onboarded_at))
    return <Redirect href="/onboarding" />;
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        key={sessionKey}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: C.brandTextOnTint,
          tabBarInactiveTintColor: C.textOnTint,
          tabBarStyle: {
            display: wideWeb ? "none" : "flex",
            backgroundColor: C.bg,
            borderTopColor: C.line,
            // Browser text zoom does not change RNW fontScale. Let the real
            // label height size the bar; native uses the system font scale.
            height:
              Platform.OS === "web"
                ? "auto"
                : 54 +
                  16 *
                    fontScale *
                    Math.max(
                      1,
                      Math.ceil(
                        (56 * fontScale) / Math.max(44, width / 4 - 18),
                      ),
                    ) +
                  (demoMode && data.me.demo ? 12 : Math.max(insets.bottom, 12)),
            minHeight: 82,
            flexShrink: 0,
            paddingTop: 8,
            paddingBottom:
              demoMode && data.me.demo ? 12 : Math.max(insets.bottom, 12),
          },
          tabBarLabelPosition: "below-icon",
          tabBarItemStyle: { borderRadius: 14, marginHorizontal: 4 },
          tabBarActiveBackgroundColor: C.blush,
          tabBarAllowFontScaling: true,
          // The default navigation Label forces one line. A wrapping Text
          // keeps every destination readable when text is enlarged.
          tabBarLabel: ({ children, color }) => (
            <Text
              style={{
                color,
                fontSize: 12,
                lineHeight: 16,
                fontWeight: "600",
                textAlign: "center",
                width: "100%",
                minWidth: 0,
                flexShrink: 0,
              }}
            >
              {children}
            </Text>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Discover",
            tabBarIcon: ({ color }) => (
              <Icon name="heart-outline" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: "Chat",
            tabBarIcon: ({ color }) => (
              <Icon name="chatbubbles-outline" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="sangai"
          options={{
            title: "Sangai",
            tabBarIcon: ({ color }) => (
              <Icon name="flower-outline" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => (
              <Icon name="person-outline" color={color} />
            ),
          }}
        />
      </Tabs>
      <DemoBar />
    </View>
  );
}
