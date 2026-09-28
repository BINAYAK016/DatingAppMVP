import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
  ColorValue,
  ImageStyle,
  StyleProp,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useStore } from "../lib/store";
import { Person } from "../lib/types";
export const C = {
  bg: "#F7F6F0",
  ink: "#203E36",
  muted: "#7B857F",
  line: "#E5E8DD",
  green: "#284D40",
  lime: "#D9E8A5",
  peach: "#F3D4C1",
  white: "#FFFFFF",
  red: "#A54C42",
};
export function Icon({
  name,
  size = 22,
  color = C.ink,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: ColorValue;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      {icon && (
        <Icon name={icon} color={secondary ? C.ink : C.white} size={18} />
      )}
      <Text style={[s.buttonText, secondary && { color: C.ink }]}>{title}</Text>
    </Pressable>
  );
}
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={[
        s.chip,
        selected && { backgroundColor: C.green, borderColor: C.green },
      ]}
    >
      <Text style={[s.chipText, selected && { color: C.white }]}>{label}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  secure = false,
  keyboardType = "default",
}: {
  label?: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secure?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
}) {
  return (
    <View style={{ gap: 8, marginBottom: 14 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput
        accessibilityLabel={label || placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        multiline={multiline}
        secureTextEntry={secure}
        autoCapitalize={
          secure || keyboardType === "email-address" ? "none" : "sentences"
        }
        keyboardType={keyboardType}
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function Avatar({
  person,
  size = 48,
}: {
  person: Partial<Person>;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: person.color || C.peach,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {person.avatar_id ? (
        <PrivateImage
          id={person.avatar_id}
          style={{ width: size, height: size }}
        />
      ) : (
        <Text
          style={{ fontSize: size * 0.36, color: C.ink, fontWeight: "600" }}
        >
          {person.name?.slice(0, 1) || "S"}
        </Text>
      )}
    </View>
  );
}
export function Video({ id }: { id: string }) {
  const { url, token } = useStore();
  const player = useVideoPlayer(
    {
      uri: `${url}/v1/media/${id}`,
      headers: { Authorization: `Bearer ${token}` },
    },
    (p) => {
      p.loop = false;
    },
  );
  return (
    <VideoView
      player={player}
      style={s.media}
      nativeControls
      contentFit="contain"
    />
  );
}
function PrivateImage({
  id,
  style,
}: {
  id: string;
  style: StyleProp<ImageStyle>;
}) {
  const { url, token } = useStore();
  const [loaded, setLoaded] = useState<{ key: string; uri: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${url}:${id}:${token}:${attempt}`;
  const failed = failedKey === key;
  useEffect(() => {
    const controller = new AbortController();
    // Authenticate through the same fetch path as the API on every platform.
    // Data stays in component memory; no bearer token is put in an image URL.
    (async () => {
      const response = await fetch(`${url}/v1/media/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Photo unavailable");
      const mime = response.headers.get("content-type") || "";
      if (!mime.startsWith("image/")) throw new Error("Invalid photo");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      if (!controller.signal.aborted)
        setLoaded({ key, uri: `data:${mime};base64,${btoa(binary)}` });
    })().catch(() => {
      if (!controller.signal.aborted) setFailedKey(key);
    });
    return () => controller.abort();
  }, [url, id, token, key, attempt]);
  return loaded?.key === key && !failed ? (
    <Image
      source={{ uri: loaded.uri }}
      style={style}
      resizeMode="cover"
      onError={() => setFailedKey(key)}
      accessibilityLabel="Shared photo"
    />
  ) : (
    <Pressable
      style={[style, { alignItems: "center", justifyContent: "center" }]}
      disabled={!failed}
      onPress={() => setAttempt(attempt + 1)}
      accessibilityLabel={failed ? "Photo unavailable. Retry" : "Loading photo"}
    >
      {failed ? (
        <Text style={s.small}>Photo unavailable · Retry</Text>
      ) : (
        <ActivityIndicator color={C.green} />
      )}
    </Pressable>
  );
}
export function Media({ id, kind = "image" }: { id: string; kind?: string }) {
  const [loadVideo, setLoadVideo] = useState(false);
  return kind === "video" ? (
    loadVideo ? (
      <Video id={id} />
    ) : (
      <View
        style={[
          s.media,
          { alignItems: "center", justifyContent: "center", gap: 12 },
        ]}
      >
        <Icon name="videocam-outline" size={34} />
        <Button
          title="Load video"
          icon="play-outline"
          onPress={() => setLoadVideo(true)}
        />
        <Text style={s.small}>Video loads only when you choose.</Text>
      </View>
    )
  ) : (
    <PrivateImage id={id} style={s.media} />
  );
}
export function Page({
  children,
  refresh = false,
}: {
  children: React.ReactNode;
  refresh?: boolean;
}) {
  const st = useStore();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={false}
              onRefresh={() => void st.refresh()}
              tintColor={C.green}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Header({
  title,
  eyebrow = "A LITTLE CLOSER",
  back = false,
  action,
}: {
  title: string;
  eyebrow?: string;
  back?: boolean;
  action?: React.ReactNode;
}) {
  const { data } = useStore();
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
            style={{ paddingVertical: 8 }}
          >
            <Icon name="arrow-back" />
          </Pressable>
        )}
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.title}>{title}</Text>
      </View>
      {action ||
        (!back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open connections"
            onPress={() => router.push("/inbox")}
            style={s.iconButton}
          >
            <Icon name="chatbubble-ellipses-outline" />
            {!!data?.requests.length && <View style={s.dot} />}
          </Pressable>
        ))}
    </View>
  );
}
export function Empty({
  icon = "leaf-outline",
  title,
  body,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
}) {
  return (
    <View style={[s.card, { alignItems: "center", paddingVertical: 32 }]}>
      <Icon name={icon} size={34} />
      <Text style={[s.h2, { marginTop: 14, textAlign: "center" }]}>
        {title}
      </Text>
      <Text style={[s.body, { textAlign: "center", marginTop: 8 }]}>
        {body}
      </Text>
    </View>
  );
}
export function Loading() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.bg,
      }}
    >
      <ActivityIndicator color={C.green} />
      <Text style={[s.body, { marginTop: 12 }]}>A little closer…</Text>
    </View>
  );
}
export function Banner({
  title,
  body,
  emoji = "✦",
}: {
  title: string;
  body: string;
  emoji?: string;
}) {
  return (
    <LinearGradient
      colors={["#294E40", "#173D32"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.banner}
    >
      <View style={s.orbit} />
      <View style={{ flex: 1, zIndex: 1 }}>
        <Text style={s.bannerLabel}>MADE FOR REAL CONNECTIONS</Text>
        <Text style={s.bannerTitle}>{title}</Text>
        <Text style={s.bannerBody}>{body}</Text>
      </View>
      <Text style={{ fontSize: 48, color: C.lime, zIndex: 1 }}>{emoji}</Text>
    </LinearGradient>
  );
}
export function Section({ title, aside }: { title: string; aside?: string }) {
  return (
    <View
      style={[s.row, { justifyContent: "space-between", marginVertical: 17 }]}
    >
      <Text style={s.h2}>{title}</Text>
      {aside && <Text style={s.small}>{aside}</Text>}
    </View>
  );
}
export const s = StyleSheet.create({
  page: {
    padding: 22,
    paddingBottom: 110,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.4,
    color: C.muted,
    marginBottom: 7,
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 37,
    lineHeight: 44,
    color: C.ink,
    letterSpacing: -1,
  },
  h2: { fontSize: 19, fontWeight: "600", color: C.ink, letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 22, color: C.muted },
  small: { fontSize: 11, color: C.muted, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: "600", color: C.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    padding: 19,
    marginBottom: 14,
  },
  button: {
    backgroundColor: C.green,
    borderRadius: 15,
    paddingHorizontal: 19,
    paddingVertical: 15,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  buttonText: { fontSize: 13, fontWeight: "600", color: C.white },
  secondary: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line },
  chip: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 22,
  },
  chipText: { fontSize: 11, color: C.ink, fontWeight: "500" },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 15,
    color: C.ink,
    fontSize: 14,
  },
  iconButton: {
    height: 44,
    width: 44,
    backgroundColor: C.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DB947B",
    right: 8,
    top: 7,
  },
  banner: {
    minHeight: 190,
    borderRadius: 24,
    padding: 25,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    gap: 12,
  },
  bannerLabel: {
    fontSize: 8,
    color: C.lime,
    letterSpacing: 1.9,
    fontWeight: "600",
  },
  bannerTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 30,
    lineHeight: 35,
    color: C.white,
    marginTop: 13,
    marginBottom: 12,
  },
  bannerBody: { fontSize: 12, lineHeight: 19, color: "#D1DED5", maxWidth: 240 },
  orbit: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: "#577363",
    right: -30,
    bottom: -70,
  },
  media: {
    width: "100%",
    height: 300,
    borderRadius: 18,
    backgroundColor: "#E8ECE4",
    marginVertical: 12,
  },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 15 },
  link: { fontSize: 12, color: C.green, fontWeight: "600" },
  danger: { color: C.red },
  heroInitial: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 140,
    color: "#FFFFFF99",
  },
  tag: {
    fontSize: 9,
    letterSpacing: 1,
    color: C.green,
    backgroundColor: C.lime,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: "hidden",
  },
  note: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#EDF0E4",
    marginVertical: 12,
  },
});
