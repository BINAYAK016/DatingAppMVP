import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  Button,
  C,
  Empty,
  Header,
  Icon,
  Skeleton,
  s,
  T,
} from "../components/ui";
import { useStore } from "../lib/store";
import { State } from "../lib/types";

type Update = State["notifications"][number];
type Cursor = { before: string; beforeId: string };
type UpdatePage = {
  items: Update[];
  hasMore: boolean;
  nextCursor: Cursor | null;
};

export default function Activity() {
  const { sessionKey } = useStore();
  return <ActivityScreen key={sessionKey} />;
}

function ActivityScreen() {
  const { request, refresh, toast } = useStore();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true),
    focused = useRef(false);
  const pending = useRef(false),
    reading = useRef(false);
  const sequence = useRef(0);
  const cursorRef = useRef<Cursor | null>(null);
  const invalidate = useCallback(() => {
    sequence.current++;
    pending.current = false;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidate();
    };
  }, [invalidate]);

  const load = useCallback(
    async (older = false, force = false) => {
      if (
        !focused.current ||
        AppState.currentState !== "active" ||
        reading.current ||
        (pending.current && !force)
      )
        return;
      const nextCursor = cursorRef.current;
      if (older && !nextCursor) return;
      const current = ++sequence.current;
      pending.current = true;
      setLoading(!older);
      setLoadingMore(older);
      // The API cursor retains PostgreSQL microseconds. Never rebuild it from a
      // rendered created_at value, whose JavaScript Date precision is lower.
      const path = older
        ? "/notifications?limit=30&before=" +
          encodeURIComponent(nextCursor!.before) +
          "&beforeId=" +
          encodeURIComponent(nextCursor!.beforeId)
        : "/notifications?limit=30";
      try {
        const page = await request<UpdatePage>(path);
        if (
          !mounted.current ||
          !focused.current ||
          AppState.currentState !== "active" ||
          current !== sequence.current
        )
          return;
        const visible = page.items.filter(
          (update) => update.kind !== "request",
        );
        setUpdates((previous) => {
          if (!older)
            return [
              ...new Map(visible.map((update) => [update.id, update])).values(),
            ];
          // Keep the server page order and replace overlapping rows by ID.
          return [
            ...new Map(
              [...previous, ...visible].map((update) => [update.id, update]),
            ).values(),
          ];
        });
        const more = page.hasMore ? page.nextCursor : null;
        cursorRef.current = more;
        setCursor(more);
        setError("");
      } catch (e: any) {
        if (!mounted.current || current !== sequence.current) return;
        if ([401, 403].includes(e.status) || e.name === "SessionChangedError") {
          setUpdates([]);
          cursorRef.current = null;
          setCursor(null);
        }
        setError(
          [401, 403].includes(e.status)
            ? "Your updates are unavailable. Please sign in again."
            : "Your updates couldn’t load. Check your connection and try again.",
        );
      } finally {
        if (mounted.current && current === sequence.current) {
          pending.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [request],
  );

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const first = setTimeout(() => void load(false, true), 0);
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void load(false, true);
        else {
          invalidate();
          setLoading(false);
          setLoadingMore(false);
        }
      });
      return () => {
        focused.current = false;
        invalidate();
        clearTimeout(first);
        listener.remove();
      };
    }, [load, invalidate]),
  );

  const markRead = async () => {
    if (reading.current) return;
    reading.current = true;
    sequence.current++;
    pending.current = false;
    setLoading(false);
    setLoadingMore(false);
    setBusy(true);
    try {
      await request("/notifications/read", {});
      if (!mounted.current) return;
      setUpdates((previous) =>
        previous.map((update) => ({ ...update, read: true })),
      );
      setError("");
      void refresh();
    } catch (e: any) {
      if (!mounted.current) return;
      if ([401, 403].includes(e.status) || e.name === "SessionChangedError") {
        setUpdates([]);
        cursorRef.current = null;
        setCursor(null);
      }
      toast(e.message);
    } finally {
      reading.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={updates}
        keyExtractor={(update) => update.id}
        contentContainerStyle={[s.page, { paddingBottom: 32 }]}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        refreshing={loading && updates.length > 0}
        onRefresh={() => void load(false)}
        ListHeaderComponent={
          <>
            <Header back title="Activity" eyebrow="YOUR CONNECTIONS" />
            {!!error && (
              <View style={{ gap: 12, paddingVertical: 16 }}>
                <Text accessibilityRole="alert" style={s.body}>
                  {error}
                </Text>
                <Button
                  title="Retry updates"
                  secondary
                  disabled={loading || loadingMore || busy}
                  onPress={() => void load(false)}
                />
              </View>
            )}
          </>
        }
        renderItem={({ item: n }) => (
          <View
            style={[
              s.row,
              {
                alignItems: "flex-start",
                gap: 16,
                padding: 18,
                marginBottom: 12,
                borderRadius: T.radius.card,
                backgroundColor: n.read ? C.white : C.blush,
                borderWidth: 1,
                borderColor: C.line,
              },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                backgroundColor: C.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="heart-outline" color={C.primary} size={22} />
            </View>
            <View style={{ flex: 1, gap: 12 }}>
              <Text style={[s.body, { color: C.ink }]}>{n.body}</Text>
              {n.resource_type === "game" && !!n.resource_id && (
                <Button
                  title="Open game"
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/game/[id]",
                      params: { id: n.resource_id!, version: "2" },
                    })
                  }
                />
              )}
            </View>
            {!n.read && (
              <View
                accessibilityLabel="Unread update"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: C.primary,
                  marginTop: 8,
                }}
              />
            )}
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 16 }}>
              <Skeleton height={76} />
              <Skeleton height={76} />
              <Skeleton height={76} />
            </View>
          ) : !error ? (
            <Empty
              title="All caught up"
              body="Updates from your matches will appear here. Likes stay private until you both match."
            />
          ) : null
        }
        ListFooterComponent={
          <View style={{ gap: 16, marginTop: 24 }}>
            {!!cursor && (
              <Button
                title={loadingMore ? "Loading…" : "Older updates"}
                secondary
                disabled={loading || loadingMore || busy}
                onPress={() => void load(true)}
              />
            )}
            {updates.some((update) => !update.read) && (
              <Button
                title={busy ? "Marking as read…" : "Mark updates as read"}
                loading={busy}
                secondary
                disabled={busy}
                onPress={() => void markRead()}
              />
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}
