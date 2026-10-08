import React, { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  C,
  Empty,
  Header,
  Icon,
  s,
  Skeleton,
  T,
} from "../../components/ui";
import { MatchStrip } from "../../components/MatchStrip";
import { useStore } from "../../lib/store";

export default function ChatList() {
  const { data, refresh, loadMoreMatches, toast } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={data?.matches || []}
        keyExtractor={(person) => person.id}
        contentContainerStyle={[s.page, { paddingBottom: 24 }]}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        onEndReached={() =>
          void loadMoreMatches().catch((error) => toast(error.message))
        }
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void refresh().finally(() => setRefreshing(false));
        }}
        ListHeaderComponent={
          <>
            <Header title="Chat" eyebrow="A LITTLE CLOSER" />
            {data ? <MatchStrip inbox /> : <Skeleton height={88} />}
            <View style={styles.section}>
              <Text accessibilityRole="header" style={T.type.section}>
                Conversations
              </Text>
              <View style={[s.row, { gap: 5 }]}>
                <Icon name="lock-closed-outline" size={12} color={C.muted} />
                <Text style={s.meta}>Just your matches</Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item: person }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${person.name}`}
            onPress={() => router.push(`/chat/${person.id}`)}
            style={({ pressed }) => [
              styles.conversation,
              pressed && { backgroundColor: C.blush },
            ]}
          >
            <Avatar person={person} size={54} />
            <View style={styles.preview}>
              <Text
                style={[styles.name, !!person.unread && { fontWeight: "700" }]}
              >
                {person.name}
              </Text>
              <Text
                style={[
                  styles.lastMessage,
                  !!person.unread && { color: C.ink },
                ]}
                numberOfLines={1}
              >
                {person.preview || "A new connection. Say hello."}
              </Text>
            </View>
            {!!person.unread && (
              <View
                style={styles.unread}
                accessibilityLabel={`${person.unread} unread messages`}
              >
                <Text style={styles.unreadText}>
                  {person.unread > 99 ? "99+" : person.unread}
                </Text>
              </View>
            )}
            <Icon name="chevron-forward" size={15} color={C.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          !data ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={76} />
              <Skeleton height={76} />
              <Skeleton height={76} />
            </View>
          ) : (
            <>
              <Empty
                icon="chatbubbles-outline"
                title="Your next hello starts here"
                body="When you both choose each other, your conversation opens here."
              />
              <Button
                title="Discover people"
                onPress={() => router.navigate("/(tabs)")}
              />
            </>
          )
        }
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  conversation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 92,
    padding: 16,
    marginBottom: 10,
    borderRadius: T.radius.card,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  preview: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: C.ink },
  lastMessage: { fontSize: 14, lineHeight: 21, color: C.textOnTint },
  unread: {
    minWidth: 24,
    height: 24,
    borderRadius: 11,
    backgroundColor: C.primary,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { fontSize: 12, color: C.white, fontWeight: "600" },
});
