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
        tabBarActiveTintColor: C.green,
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
          title: "Together",
          tabBarIcon: ({ color }) => <Icon name="leaf-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => (
            <Icon name="sparkles-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: "Circles",
          tabBarIcon: ({ color }) => (
            <Icon name="people-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: "Play",
          tabBarIcon: ({ color }) => <Icon name="dice-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "You",
          tabBarIcon: ({ color }) => (
            <Icon name="person-outline" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
