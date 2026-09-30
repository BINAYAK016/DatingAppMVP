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
import { LinearGradient } from "expo-linear-gradient";
import {
  BottomSheet,
  Button,
  C,
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
  const [match, setMatch] = useState<Person | null>(null);
  const [filters, setFilters] = useState(false);
  const inFlight = useRef(false);
  const retry = useRef<{
    target: string;
    action: string;
    clientId: string;
  } | null>(null);
  const p = st.data?.discover[0];
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardHeight = Math.min(
    650,
    Math.max(280, height - insets.top - insets.bottom - 224),
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
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void st.refresh()}
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
          <Text style={[s.title, { flex: 1 }]}>Discover</Text>
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
        <Text style={[s.body, { marginBottom: 24 }]}>
          {st.data?.me.preferences.genders.join(", ")}
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
  onDecide,
}: {
  person: Person;
  busy: boolean;
  height: number;
  onDecide: (action: "like" | "pass" | "super") => Promise<void>;
}) {
  const [position] = useState(() => new Animated.ValueXY());
  const [animating, setAnimating] = useState(false);
  const dragged = useRef(false);
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
    onStartShouldSetPanResponderCapture: () => !busy && !animating,
    onPanResponderGrant: () => {
      dragged.current = false;
    },
    onMoveShouldSetPanResponder: (_, g) =>
      !busy && !animating && (Math.abs(g.dx) > 16 || g.dy < -22),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      if (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8) dragged.current = true;
      if (!busy) position.setValue({ x: g.dx, y: Math.min(g.dy, 40) });
    },
    onPanResponderRelease: (_, g) => {
      if (busy) return snapBack();
      if (g.dy < -90 && Math.abs(g.dy) > Math.abs(g.dx)) choose("super");
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
          accessibilityLabel={`View ${p.name}'s profile`}
          disabled={busy}
          onPress={() => {
            if (Platform.OS !== "web" || !dragged.current)
              router.push(`/profile/${p.id}`);
          }}
          style={{
            height,
            borderRadius: 22,
            overflow: "hidden",
            backgroundColor: C.peach,
          }}
        >
          <PersonImage person={p} style={StyleSheet.absoluteFill} />
          <View
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <Text style={styles.photoPill}>{p.intent}</Text>
            {p.demo && <Text style={styles.photoPill}>Fictional demo</Text>}
          </View>
          <LinearGradient
            colors={["transparent", "#241A2099", "#241A20F2"]}
            locations={[0, 0.4, 1]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: 22,
              paddingTop: 70,
            }}
          >
            <Text
              style={{
                fontSize: 32,
                lineHeight: 38,
                fontWeight: "700",
                color: C.white,
              }}
            >
              {p.name}, {p.age}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                marginTop: 6,
                marginBottom: 10,
              }}
            >
              <Icon name="location-outline" color={C.white} size={15} />
              <Text style={{ fontSize: 14, color: "#FFF4EE" }}>{p.city}</Text>
            </View>
            <Text
              numberOfLines={2}
              style={{ fontSize: 14, lineHeight: 21, color: C.white }}
            >
              {p.bio}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 14,
              }}
            >
              {p.interests.slice(0, 3).map((i) => (
                <Text
                  key={i}
                  style={[
                    styles.photoPill,
                    {
                      backgroundColor: "#FFFFFF24",
                      fontSize: 12,
                      paddingHorizontal: 10,
                    },
                  ]}
                >
                  {i}
                </Text>
              ))}
            </View>
          </LinearGradient>
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
          height: 92,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
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
            onPress={() => choose(action)}
            style={({ pressed }) => ({
              width: size,
              height: size,
              borderRadius: size / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: bg,
              borderWidth: action === "pass" ? 1 : 0,
              borderColor: C.line,
              opacity: busy || animating ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            <Icon
              name={icon}
              color={color}
              size={action === "like" ? 30 : 25}
            />
          </Pressable>
        ))}
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  photoPill: {
    overflow: "hidden",
    backgroundColor: "#241A2066",
    color: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "600",
  },
});
