import React, { useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import * as Haptics from "expo-haptics";
import {
  BottomSheet,
  Button,
  C,
  T,
  Empty,
  Icon,
  IconButton,
  humanMessage,
  PersonImage,
  s,
} from "../../components/ui";
import { MatchMoment } from "../../components/MatchMoment";
import { Person } from "../../lib/types";
import { useStore } from "../../lib/store";
import { useReducedMotion } from "../../lib/useReducedMotion";

export default function Discover() {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [match, setMatch] = useState<Person | null>(null);
  const [filters, setFilters] = useState(false);
  const inFlight = useRef(false);
  const scrollSize = useRef({ viewport: 0, content: 0 });
  // Read the latest layout inside gesture callbacks, including before both
  // measurements arrive. Unknown layout must never trap vertical scrolling.
  const canScrollVertically = () => {
    const { viewport, content } = scrollSize.current;
    return viewport <= 0 || content <= 0 || content > viewport + 1;
  };
  const retry = useRef<{
    target: string;
    action: string;
    clientId: string;
  } | null>(null);
  const p = st.data?.discover[0];
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The persistent demo switch bar occupies space beyond the ordinary tabs.
  // Reserve it so the swipe buttons remain visible on smaller phones.
  const demoControlsHeight =
    st.demoMode && st.data?.me.demo ? 44 + Math.min(insets.bottom, 12) : 0;
  const cardHeight = Math.min(
    560,
    Math.max(
      280,
      height - insets.top - insets.bottom - 264 - demoControlsHeight,
    ),
  );
  const decide = async (action: "like" | "pass" | "super") => {
    if (!p || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    if (retry.current?.target !== p.id || retry.current?.action !== action)
      retry.current = { target: p.id, action, clientId: randomUUID() };
    try {
      const result = await st.request(`/discovery/${p.id}`, retry.current);
      retry.current = null;
      if (result.matched) setMatch(p);
      else if (action === "super")
        st.toast("Super Like saved. It stays private until you both match.");
      else if (action === "like")
        st.toast("Like sent. Match when you both choose each other.");
      await st.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        testID="discovery-scroll"
        style={{ flex: 1 }}
        onLayout={(event) => {
          scrollSize.current.viewport = event.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_, contentHeight) => {
          scrollSize.current.content = contentHeight;
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void st
                .refresh()
                .catch((e: Error) => st.toast(e.message))
                .finally(() => setRefreshing(false));
            }}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          width: "100%",
          maxWidth: 500,
          alignSelf: "center",
          paddingHorizontal: 16,
          paddingTop: 8,
        }}
      >
        <View style={[s.row, { marginBottom: 16, minHeight: 44 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text accessibilityRole="header" style={s.title}>
              Discover
            </Text>
            <Text style={[s.meta, { marginTop: 2 }]}>
              A little closer to your kind of person.
            </Text>
          </View>
          {!!st.data?.undoId && (
            <IconButton
              name="arrow-undo-outline"
              label="Undo last decision"
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await st.request(`/discovery-undo/${st.data!.undoId}`, {});
                  await st.refresh();
                } catch (e: any) {
                  st.toast(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
          <IconButton
            name="options-outline"
            label="Discovery preferences"
            onPress={() => setFilters(true)}
          />
        </View>
        {p ? (
          <SwipeCard
            key={p.id}
            person={p}
            busy={busy}
            height={cardHeight}
            canScrollVertically={canScrollVertically}
            onDecide={decide}
          />
        ) : (
          <View
            style={{ flex: 1, justifyContent: "center", paddingBottom: 40 }}
          >
            <Empty
              title={
                st.data?.me.paused
                  ? "You’re taking a pause"
                  : "You’re all caught up"
              }
              body={
                st.data?.me.paused
                  ? "Resume discovery in Profile whenever you feel ready."
                  : "New connections take a little time. Catch up with your matches or try a wider set of preferences."
              }
            />
            <Button
              title="Your conversations"
              onPress={() => router.navigate("/(tabs)/chat")}
            />
            <View style={{ height: 12 }} />
            <Button
              title="Adjust preferences"
              secondary
              onPress={() => setFilters(true)}
            />
          </View>
        )}
      </ScrollView>
      {!!match && !!st.data?.me && (
        <MatchMoment
          me={st.data.me}
          person={match}
          onChat={() => {
            const id = match.id;
            setMatch(null);
            router.push(`/chat/${id}`);
          }}
          onExplore={() => setMatch(null)}
        />
      )}
      <BottomSheet
        visible={filters}
        onClose={() => setFilters(false)}
        title="Your preferences"
      >
        <Text style={[s.body, { marginBottom: 24 }]}>
          Meet people who fit what you’re looking for.
        </Text>
        <Text style={s.label}>Age range</Text>
        <Text style={[s.body, { marginBottom: 20 }]}>
          {st.data?.me.preferences.minAge}–{st.data?.me.preferences.maxAge}
        </Text>
        <Text style={s.label}>Cities</Text>
        <Text style={[s.body, { marginBottom: 20 }]}>
          {st.data?.me.preferences.cities.join(", ") || "All launch cities"}
        </Text>
        <Text style={s.label}>Interested in</Text>
        <Text style={[s.body, { marginBottom: 20 }]}>
          {st.data?.me.preferences.genders.join(", ") || "Everyone"}
        </Text>
        <Text style={s.label}>Relationship intent</Text>
        <Text style={[s.body, { marginBottom: 24 }]}>
          {st.data?.me.preferences.intents?.join(", ") ||
            "Any relationship intent"}
        </Text>
        <Button
          title="Edit discovery preferences"
          onPress={() => {
            setFilters(false);
            router.push("/edit-profile?section=3");
          }}
        />
      </BottomSheet>
      <BottomSheet
        visible={!!error}
        onClose={() => setError("")}
        title="Let’s try again"
      >
        <Text style={[s.body, { marginBottom: 12 }]}>
          {humanMessage(error)}
        </Text>
        <Text style={[s.small, { marginBottom: 24 }]}>
          Your card is still here. Close this message and tap the same action to
          retry.
        </Text>
        <Button title="Back to the profile" onPress={() => setError("")} />
      </BottomSheet>
    </SafeAreaView>
  );
}

function SwipeCard({
  person: p,
  busy,
  height,
  canScrollVertically,
  onDecide,
}: {
  person: Person;
  busy: boolean;
  height: number;
  canScrollVertically: () => boolean;
  onDecide: (action: "like" | "pass" | "super") => Promise<void>;
}) {
  const [position] = useState(() => new Animated.ValueXY());
  const [animating, setAnimating] = useState(false);
  const dragged = useRef(false);
  const verticalGesture = useRef(false);
  const reduced = useReducedMotion();
  const snapBack = () => {
    if (reduced) {
      position.setValue({ x: 0, y: 0 });
      setAnimating(false);
      return;
    }
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 7,
    }).start(() => setAnimating(false));
  };
  const choose = (action: "like" | "pass" | "super") => {
    if (animating || busy) return;
    setAnimating(true);
    if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
    Animated.timing(position, {
      toValue:
        action === "super"
          ? { x: 0, y: -140 }
          : { x: action === "like" ? 160 : -160, y: 0 },
      duration: reduced ? 0 : 180,
      useNativeDriver: true,
    }).start(() => {
      void onDecide(action).finally(snapBack);
    });
  };
  // Gesture refs are accessed only by touch callbacks.
  // eslint-disable-next-line react-hooks/refs
  const responder = PanResponder.create({
    onStartShouldSetPanResponderCapture: () => {
      dragged.current = false;
      return !busy && !animating && !canScrollVertically();
    },
    onPanResponderGrant: () => {
      dragged.current = false;
      verticalGesture.current = !canScrollVertically();
    },
    // When the page overflows, leave vertical movement to its ScrollView.
    // Claim horizontal drags in capture phase before the nested Pressable.
    onMoveShouldSetPanResponderCapture: (_, g) =>
      !busy &&
      !animating &&
      canScrollVertically() &&
      Math.abs(g.dx) > 16 &&
      Math.abs(g.dx) > Math.abs(g.dy),
    onMoveShouldSetPanResponder: (_, g) =>
      !busy &&
      !animating &&
      (canScrollVertically()
        ? Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy)
        : Math.abs(g.dx) > 16 || g.dy < -22),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      if (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8) dragged.current = true;
      if (canScrollVertically()) verticalGesture.current = false;
      if (!busy)
        position.setValue({
          x: g.dx,
          y: verticalGesture.current ? Math.min(g.dy, 40) : 0,
        });
    },
    onPanResponderRelease: (_, g) => {
      if (busy) return snapBack();
      if (
        verticalGesture.current &&
        !canScrollVertically() &&
        g.dy < -90 &&
        Math.abs(g.dy) > Math.abs(g.dx)
      )
        choose("super");
      else if (g.dx > 80) choose("like");
      else if (g.dx < -80) choose("pass");
      else if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
        snapBack();
        if (Platform.OS !== "web") router.push(`/profile/${p.id}`);
      } else snapBack();
    },
    onPanResponderTerminate: snapBack,
  });
  const rotate = position.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ["-8deg", "0deg", "8deg"],
    extrapolate: "clamp",
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [20, 90],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const passOpacity = position.x.interpolate({
    inputRange: [-90, -20],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const superOpacity = position.y.interpolate({
    inputRange: [-100, -30],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  return (
    <>
      <Animated.View
        {...responder.panHandlers}
        style={{
          transform: [
            ...position.getTranslateTransform(),
            { rotate: reduced ? "0deg" : rotate },
          ],
        }}
      >
        <Pressable
          accessibilityRole="button"
          testID="discovery-profile"
          accessibilityHint="Opens the full profile."
          disabled={busy}
          onPress={() => {
            if (Platform.OS !== "web" || !dragged.current)
              router.push(`/profile/${p.id}`);
          }}
          style={styles.card}
        >
          <View
            style={{
              height: Math.max(160, height - 172),
              backgroundColor: C.peach,
            }}
          >
            <PersonImage person={p} style={StyleSheet.absoluteFill} />
            {p.demo && <Text style={styles.demo}>Fictional demo</Text>}
          </View>
          <View style={styles.details}>
            <Text style={styles.name}>
              {p.name}, {p.age}
            </Text>
            <View style={[s.row, { gap: 5, flexWrap: "wrap", marginTop: 4 }]}>
              <Icon name="location-outline" size={14} color={C.muted} />
              <Text style={s.small}>{p.city}</Text>
              <Text style={styles.intent}>{p.intent}</Text>
            </View>
            <Text
              numberOfLines={1}
              style={[s.small, { color: C.ink, marginTop: 10 }]}
            >
              {p.bio}
            </Text>
            <View style={[s.wrap, { gap: 6, marginTop: 10 }]}>
              {p.interests.slice(0, 3).map((interest) => (
                <Text key={interest} style={styles.interest}>
                  {interest}
                </Text>
              ))}
            </View>
          </View>
          {(
            [
              ["LIKE", likeOpacity, -12],
              ["PASS", passOpacity, 12],
              ["SUPER LIKE", superOpacity, 0],
            ] as const
          ).map(([label, opacity, tilt]) => (
            <Animated.View
              key={label}
              pointerEvents="none"
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                position: "absolute",
                top: 90,
                alignSelf: "center",
                borderWidth: 3,
                borderColor: C.white,
                padding: 12,
                borderRadius: 8,
                opacity,
                transform: [{ rotate: `${tilt}deg` }],
              }}
            >
              <Text style={{ color: C.white, fontSize: 28, fontWeight: "800" }}>
                {label}
              </Text>
            </Animated.View>
          ))}
        </Pressable>
      </Animated.View>
      <View
        style={{
          minHeight: 96,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        {(
          [
            ["pass", "Pass", "close", C.white, C.ink, 52],
            ["like", "Like", "heart", C.primary, C.white, 64],
            ["super", "Super Like", "star", C.lavender, C.primary, 52],
          ] as const
        ).map(([action, label, icon, bg, color, size]) => (
          <Pressable
            key={action}
            disabled={busy || animating}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: busy || animating, busy }}
            onPress={() => choose(action)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 64,
              maxWidth: 110,
              minHeight: 80,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy || animating ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: bg,
                borderWidth: action === "pass" ? 1 : 0,
                borderColor: C.line,
              }}
            >
              <Icon
                name={icon}
                color={color}
                size={action === "like" ? 28 : 23}
              />
            </View>
            <Text style={[s.meta, { marginTop: 5, color: C.ink }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  details: { padding: 16, backgroundColor: C.white },
  name: {
    fontFamily: T.font.editorial,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "400",
    color: C.ink,
    letterSpacing: -0.5,
  },
  demo: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: C.blush,
    color: C.brandTextOnTint,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "600",
  },
  intent: {
    overflow: "hidden",
    backgroundColor: C.blush,
    color: C.brandTextOnTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    fontSize: 11,
    marginLeft: 4,
  },
  interest: {
    overflow: "hidden",
    backgroundColor: C.lavender,
    color: C.ink,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
  },
});
