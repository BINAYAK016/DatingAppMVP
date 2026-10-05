import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Link, usePathname } from "expo-router";
import { Avatar, C, Icon, s } from "./ui";
import { useStore } from "../lib/store";
import "../web.css";

const destinations = [
  { href: "/(tabs)", label: "Discover", icon: "heart-outline", path: "/" },
  {
    href: "/(tabs)/chat",
    label: "Chat",
    icon: "chatbubbles-outline",
    path: "/chat",
  },
  {
    href: "/(tabs)/sangai",
    label: "Sangai",
    icon: "flower-outline",
    path: "/sangai",
  },
  {
    href: "/(tabs)/profile",
    label: "Profile",
    icon: "person-outline",
    path: "/profile",
  },
] as const;
export function AppFrame({ children }: { children: React.ReactNode }) {
  const wide = useWindowDimensions().width >= 1024;
  const { data, token } = useStore();
  const pathname = usePathname();
  const signedIn =
    !!token &&
    !!data &&
    (data.me.demo || (!!data.me.email_verified_at && !!data.me.onboarded_at));
  return (
    <View style={[styles.canvas, wide && { paddingHorizontal: 24 }]}>
      <View style={styles.shell}>
        {wide && (
          <View style={styles.rail}>
            <Text style={styles.brand}>sangai</Text>
            {signedIn ? (
              <>
                <Text style={[s.small, { marginTop: 8 }]}>
                  Find your together.
                </Text>
                <View style={{ gap: 8, marginTop: 32 }}>
                  {destinations.map((item) => {
                    const selected =
                      item.path === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.path);
                    return (
                      <Link key={item.label} href={item.href} asChild>
                        <Pressable
                          accessibilityLabel={`Navigate to ${item.label}`}
                          style={StyleSheet.flatten([
                            styles.destination,
                            selected && {
                              backgroundColor: C.blush,
                            },
                          ])}
                        >
                          <Icon
                            name={item.icon}
                            size={21}
                            color={selected ? C.primary : C.muted}
                          />
                          <Text
                            style={[s.label, selected && { color: C.primary }]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      </Link>
                    );
                  })}
                </View>
                <View style={styles.account}>
                  <Avatar person={data.me} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={s.label}>
                      {data.me.name}
                    </Text>
                    <Text style={s.meta}>
                      {data.me.demo ? "Fictional demo" : "Your account"}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[s.h2, { marginTop: 32 }]}>
                  Find your together.
                </Text>
                <Text style={[s.body, { marginTop: 12, color: C.muted }]}>
                  Good conversations. Shared moments. Connections at your pace.
                </Text>
              </>
            )}
            <View
              style={[
                s.row,
                { marginTop: "auto", paddingTop: 32, alignItems: "flex-start" },
              ]}
            >
              <Icon name="lock-closed-outline" size={16} color={C.primary} />
              <Text style={[s.small, { flex: 1, fontSize: 12 }]}>
                Posts and stories stay between current matches. Beta for adults
                18+.
              </Text>
            </View>
          </View>
        )}
        <View
          testID="sangai-app-frame"
          style={[
            styles.app,
            wide && styles.desktopApp,
            wide && !signedIn && { maxWidth: 660 },
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.peach,
  },
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 1180,
    flexDirection: "row",
    justifyContent: "center",
    minWidth: 0,
  },
  rail: { width: 220, padding: 20, paddingVertical: 36 },
  brand: {
    color: C.primary,
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: -1.3,
  },
  destination: {
    minHeight: 48,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  account: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  app: {
    flex: 1,
    width: "100%",
    maxWidth: 760,
    minWidth: 0,
    backgroundColor: C.bg,
  },
  desktopApp: {
    maxWidth: 960,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.line,
  },
});
