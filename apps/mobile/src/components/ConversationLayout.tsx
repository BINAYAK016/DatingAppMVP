import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { Avatar, C, Icon, s } from "./ui";

// The conversation remains the same mounted screen. Desktop adds navigation
// using the existing match page; native keeps its single-column chat layout.
export function ConversationLayout({
  target,
  children,
}: {
  target: string;
  children: React.ReactNode;
}) {
  const wide = useWindowDimensions().width >= 1280 && Platform.OS === "web";
  const st = useStore();
  return (
    <View style={styles.layout}>
      {wide && (
        <View testID="conversation-sidebar" style={styles.sidebar}>
          <View style={[s.row, { marginBottom: 16 }]}>
            <Text style={[s.label, { flex: 1 }]}>Conversations</Text>
            <Icon name="lock-closed-outline" size={13} color={C.muted} />
          </View>
          <FlatList
            data={st.data?.matches || []}
            keyExtractor={(person) => person.id}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            onEndReached={() =>
              void st
                .loadMoreMatches()
                .catch((error) => st.toast(error.message))
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${item.name}`}
                accessibilityState={{ selected: item.id === target }}
                onPress={() => router.replace(`/chat/${item.id}`)}
                style={[
                  styles.person,
                  item.id === target && { backgroundColor: C.blush },
                ]}
              >
                <Avatar person={item} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={s.label}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={s.meta}>
                    {item.preview || "Say hello."}
                  </Text>
                </View>
                {!!item.unread && <View style={styles.unread} />}
              </Pressable>
            )}
          />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  layout: { flex: 1, flexDirection: "row", minWidth: 0 },
  sidebar: {
    width: 224,
    backgroundColor: C.white,
    borderRightWidth: 1,
    borderColor: C.line,
    padding: 12,
    paddingTop: 24,
  },
  person: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  unread: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
});
