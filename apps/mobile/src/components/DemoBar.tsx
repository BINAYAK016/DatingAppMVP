import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../lib/store";
import { C, Icon, s } from "./ui";

export function DemoBar() {
  const st = useStore();
  const insets = useSafeAreaInsets();
  if (!st.demoMode || !st.data?.me.demo) return null;
  return (
    <View
      style={{
        backgroundColor: C.blush,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom,
        borderTopWidth: 1,
        borderTopColor: C.line,
      }}
    >
      <View
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="flask-outline" size={16} color={C.primary} />
        <Text numberOfLines={1} style={[s.small, { flex: 1, color: C.ink }]}>
          DEMO MODE · {st.data.me.name}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch demo user"
          onPress={() => router.push("/demo")}
          style={{
            minHeight: 44,
            minWidth: 60,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 12,
          }}
        >
          <Text style={[s.link, { color: C.brandTextOnTint }]}>Switch</Text>
        </Pressable>
      </View>
    </View>
  );
}
