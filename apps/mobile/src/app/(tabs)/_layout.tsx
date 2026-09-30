import React from "react";
import { Tabs, Redirect } from "expo-router";
import { useStore } from "../../lib/store";
import { C, Icon, Loading } from "../../components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function Layout() {
  const { ready, token, data } = useStore();
  const insets = useSafeAreaInsets();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/" />;
  if (!data) return <Loading />;
  if (!data.me.demo && (!data.me.email_verified_at || !data.me.onboarded_at))
    return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.line,
          height: 58 + Math.max(insets.bottom, 12),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
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
  );
}
