import React from "react";
import { Tabs, Redirect } from "expo-router";
import { useStore } from "../../lib/store";
import { C, Icon, Loading } from "../../components/ui";
export default function Layout() {
  const { ready, token, data } = useStore();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/" />;
  if (!data) return <Loading />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: "#929B93",
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.line,
          height: 78,
          paddingTop: 8,
          paddingBottom: 16,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => <Icon name="heart-outline" color={color} />,
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
