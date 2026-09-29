import React, { useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { LinearGradient } from "expo-linear-gradient";
import {
  Button,
  C,
  Chip,
  Empty,
  Header,
  Icon,
  Page,
  PrivateImage,
  s,
} from "../../components/ui";
import { Person } from "../../lib/types";
import { useStore } from "../../lib/store";

export default function Discover() {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [match, setMatch] = useState<Person | null>(null);
  const inFlight = useRef(false);
  const retry = useRef<{
    target: string;
    action: string;
    clientId: string;
  } | null>(null);
  const p = st.data?.discover[0];
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
    <Page refresh>
      <Header title="Discover" eyebrow="YOUR NEXT CHAPTER STARTS HERE" />
      <View style={[s.row, { marginBottom: 20 }]}>
        <Text style={[s.body, { flex: 1 }]}>
          A little curiosity. A new connection.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discovery preferences"
          onPress={() => router.push("/edit-profile")}
          style={s.iconButton}
        >
          <Icon name="options-outline" />
        </Pressable>
      </View>
      {match ? (
        <View style={[s.card, { backgroundColor: C.blush, padding: 28 }]}>
          <Text style={{ fontSize: 42, textAlign: "center" }}>♡</Text>
          <Text style={[s.title, { textAlign: "center", marginVertical: 18 }]}>
            It’s a Match!
          </Text>
          <Text style={[s.body, { marginBottom: 24 }]}>
            You and {match.name} both felt a spark. Make the first hello your
            own.
          </Text>
          <Button
            title="Start Chat"
            onPress={() => {
              const id = match.id;
              setMatch(null);
              router.push(`/chat/${id}`);
            }}
          />
          <View style={{ height: 10 }} />
          <Button
            title="Keep discovering"
            secondary
            onPress={() => setMatch(null)}
          />
        </View>
      ) : p ? (
        <SwipeCard key={p.id} person={p} busy={busy} onDecide={decide} />
      ) : (
        <>
          <Empty
            title={
              st.data?.me.paused
                ? "You’re taking a pause"
                : "You’re all caught up"
            }
            body={
              st.data?.me.paused
                ? "Resume discovery in Profile whenever you feel ready."
                : "No more profiles fit your shared preferences right now. Explore your matches or adjust your preferences."
            }
          />
          <Button
            title="Your conversations"
            onPress={() => router.navigate("/(tabs)/chat")}
          />
        </>
      )}
      {!!error && (
        <View accessibilityRole="alert" style={s.note}>
          <Text style={s.body}>{error}</Text>
          <Text style={s.small}>
            Your card is still here. Tap the same action to retry safely.
          </Text>
        </View>
      )}
      {!!st.data?.undoId && !match && (
        <View style={{ marginTop: 16 }}>
          <Button
            title="Undo last decision"
            secondary
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
        </View>
      )}
      <Text style={[s.small, { textAlign: "center", marginTop: 20 }]}>
        Likes stay private until you both match. Serious relationships, marriage
        and casual dating are equally welcome.
      </Text>
    </Page>
  );
}
function SwipeCard({
  person: p,
  busy,
  onDecide,
}: {
  person: Person;
  busy: boolean;
  onDecide: (action: "like" | "pass" | "super") => Promise<void>;
}) {
  const [position] = useState(() => new Animated.ValueXY());
  const [animating, setAnimating] = useState(false);
  const dragged = useRef(false);
  const snapBack = () =>
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 7,
    }).start(() => setAnimating(false));
  const choose = (action: "like" | "pass" | "super") => {
    if (animating || busy) return;
    setAnimating(true);
    Animated.timing(position, {
      toValue:
        action === "super"
          ? { x: 0, y: -140 }
          : { x: action === "like" ? 160 : -160, y: 0 },
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      void onDecide(action).finally(snapBack);
    });
  };
  const responder = PanResponder.create({
    // Own card touches before the nested Pressable/ScrollView can consume them.
    // Tap navigation is handled on release; accessibility activation stays below.
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
  return (
    <>
      <Animated.View
        {...responder.panHandlers}
        style={{ transform: [...position.getTranslateTransform(), { rotate }] }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${p.name}'s profile`}
          disabled={busy}
          onPress={() => {
            // Browsers synthesize a click after mouseup even after a card drag.
            if (Platform.OS !== "web" || !dragged.current)
              router.push(`/profile/${p.id}`);
          }}
          style={{
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: C.peach,
          }}
        >
          {p.avatar_id ? (
            <PrivateImage
              id={p.avatar_id}
              style={{ height: 300, width: "100%" }}
            />
          ) : (
            <View
              style={{
                height: 260,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={s.heroInitial}>{p.name[0]}</Text>
              <Text style={s.eyebrow}>
                {p.demo ? "FICTIONAL DEMO PROFILE" : "A NEW POSSIBILITY"}
              </Text>
            </View>
          )}
          <LinearGradient
            colors={[C.blush, C.lavender]}
            style={{ padding: 24 }}
          >
            <Text style={s.title}>
              {p.name}, {p.age}
            </Text>
            <Text style={[s.small, { marginVertical: 9 }]}>
              {p.city} · {p.intent}
            </Text>
            <Text style={s.body} numberOfLines={3}>
              {p.bio}
            </Text>
            <View style={[s.wrap, { marginTop: 14 }]}>
              {p.interests.slice(0, 3).map((i) => (
                <Chip key={i} label={i} />
              ))}
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
      <View style={[s.row, { marginTop: 20, justifyContent: "space-evenly" }]}>
        {(
          [
            ["pass", "Pass", "close", C.white],
            ["super", "Super Like", "star-outline", C.lavender],
            ["like", "Like", "heart-outline", C.blush],
          ] as const
        ).map(([action, label, icon, color]) => (
          <Pressable
            key={action}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => choose(action)}
            style={{ alignItems: "center", gap: 7, opacity: busy ? 0.5 : 1 }}
          >
            <View
              style={{
                borderRadius: 32,
                width: 62,
                height: 62,
                backgroundColor: color,
                borderWidth: 1,
                borderColor: C.line,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={icon} size={28} />
            </View>
            <Text style={s.small}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[s.small, { textAlign: "center", marginTop: 14 }]}>
        Swipe left to pass, right to Like, up to Super Like.
      </Text>
    </>
  );
}
