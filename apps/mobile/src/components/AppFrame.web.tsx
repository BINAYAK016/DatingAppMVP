import React from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { C, Icon, s } from "./ui";
import { useStore } from "../lib/store";
import "../web.css";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const wide = useWindowDimensions().width >= 1024;
  const { token } = useStore();
  return (
    <View style={styles.canvas}>
      {wide && (
        <View style={styles.rail}>
          <Text style={styles.brand}>sangai</Text>
          <Text style={[s.h2, { marginTop: 22 }]}>Find your together.</Text>
          <Text style={[s.body, { marginTop: 12, color: C.muted }]}>
            Good conversations. Shared moments. Connections at your pace.
          </Text>
          {token && (
            <View style={{ gap: 22, marginTop: 38 }}>
              <Link href="/(tabs)" style={s.label}>
                Discover
              </Link>
              <Link href="/(tabs)/chat" style={s.label}>
                Chat
              </Link>
              <Link href="/(tabs)/sangai" style={s.label}>
                Sangai
              </Link>
              <Link href="/(tabs)/profile" style={s.label}>
                Profile
              </Link>
            </View>
          )}
          <View
            style={[
              s.row,
              { marginTop: "auto", paddingTop: 40, alignItems: "flex-start" },
            ]}
          >
            <Icon name="lock-closed-outline" size={18} color={C.primary} />
            <Text style={[s.small, { flex: 1 }]}>
              Posts and stories stay between current matches. Private beta ·
              adults 18+.
            </Text>
          </View>
        </View>
      )}
      <View
        testID="sangai-app-frame"
        style={[styles.app, wide && styles.desktopApp]}
      >
        {children}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: C.peach,
  },
  rail: { width: 250, padding: 30, paddingLeft: 0, paddingVertical: 48 },
  brand: {
    color: C.primary,
    fontSize: 38,
    fontWeight: "600",
    letterSpacing: -1.4,
  },
  app: {
    flex: 1,
    width: "100%",
    maxWidth: 660,
    minWidth: 0,
    backgroundColor: C.bg,
  },
  desktopApp: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.line },
});
