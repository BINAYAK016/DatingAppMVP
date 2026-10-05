import { apiHeaders, apiCredentials, checkSession } from "../lib/auth";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Image,
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
  ViewStyle,
  Modal,
  KeyboardAvoidingView,
  Platform,
  DimensionValue,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router } from "expo-router";
import { useVideoPlayer, VideoView, VideoSource } from "expo-video";
import { useStore } from "../lib/store";
import { useMediaVisible } from "../lib/useMediaVisible";
import { Person } from "../lib/types";
import { DemoAvatarArt } from "./DemoAvatarArt";
import { useReducedMotion } from "../lib/useReducedMotion";
export const C = {
  bg: "#FFFBF8",
  ink: "#2C2529",
  muted: "#7A6D73",
  line: "#EEE4E3",
  primary: "#AA536B",
  blush: "#F7E6E9",
  peach: "#F8E9DE",
  lavender: "#EFEBF5",
  white: "#FFFFFF",
  red: "#A7374B",
};
export function humanMessage(message: string) {
  if (
    /fetch failed|failed to fetch|network request failed|ConnectException|ECONNREFUSED|Cannot reach the beta server/i.test(
      message,
    )
  )
    return "We couldn’t connect. Check your connection and try again.";
  if (/^(error\s*)?5\d\d\b|internal server error/i.test(message))
    return "Something went wrong. Let’s try that again.";
  if (/^\s*[\[{]|ZodError|invalid_type|invalid_format/i.test(message))
    return "Some details need another look. Check them and try again.";
  return message;
}
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
  compact = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  compact?: boolean;
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
        compact && {
          minHeight: 44,
          paddingVertical: 10,
          paddingHorizontal: 14,
        },
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      {icon && (
        <Icon name={icon} color={secondary ? C.ink : C.white} size={18} />
      )}
      <Text
        style={[
          s.buttonText,
          compact && { fontSize: 14 },
          secondary && { color: C.ink },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={onPress ? { selected, disabled } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.chip,
        onPress && { minHeight: 44, justifyContent: "center" },
        selected && { backgroundColor: C.primary, borderColor: C.primary },
        disabled && { opacity: 0.5 },
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
  editable = true,
}: {
  label?: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secure?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8, marginBottom: 20 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput
        accessibilityLabel={label || placeholder}
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        multiline={multiline}
        secureTextEntry={secure}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize={
          secure || keyboardType === "email-address" ? "none" : "sentences"
        }
        keyboardType={keyboardType}
        style={[
          s.input,
          focused && { borderColor: C.primary },
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
      <PersonImage person={person} style={{ width: size, height: size }} />
    </View>
  );
}
export function PersonImage({
  person,
  style,
}: {
  person: Partial<Person>;
  style: StyleProp<ImageStyle>;
}) {
  const frame: StyleProp<ImageStyle> = [
    { width: "100%", height: "100%" },
    style,
  ];
  if (person.avatar_id)
    return <PrivateImage id={person.avatar_id} style={frame} />;
  if (person.demo)
    return (
      <DemoAvatarArt person={person} style={frame as StyleProp<ViewStyle>} />
    );
  return (
    <LinearGradient
      colors={[person.color || C.peach, C.blush]}
      style={[frame, { alignItems: "center", justifyContent: "center" }]}
    >
      <Text style={{ fontSize: 36, fontWeight: "500", color: C.primary }}>
        {person.name?.slice(0, 1) || "S"}
      </Text>
    </LinearGradient>
  );
}
export function Video({
  id,
  style,
  allowFullscreen = true,
}: {
  id: string;
  style?: StyleProp<ViewStyle>;
  allowFullscreen?: boolean;
}) {
  const { url, token } = useStore();
  return Platform.OS === "web" ? (
    <BrowserPrivateVideo
      key={`${url}:${id}:${token}`}
      id={id}
      style={style}
      allowFullscreen={allowFullscreen}
    />
  ) : (
    <VideoPlayerFrame
      source={{
        uri: `${url}/v1/media/${id}`,
        headers: apiHeaders(token),
      }}
      style={style}
      allowFullscreen={allowFullscreen}
    />
  );
}
function BrowserPrivateVideo({
  id,
  style,
  allowFullscreen,
}: {
  id: string;
  style?: StyleProp<ViewStyle>;
  allowFullscreen: boolean;
}) {
  const { url, token } = useStore();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    // HTML video cannot attach the native player's Authorization headers.
    // Keep the authenticated response in memory and release it on close.
    void fetch(`${url}/v1/media/${id}`, {
      headers: apiHeaders(token),
      credentials: apiCredentials,
      signal: controller.signal,
    })
      .then(async (response) => {
        checkSession(response, token);
        if (!response.ok) throw new Error("Video unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUri(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token, id, attempt]);
  return uri ? (
    <VideoPlayerFrame
      source={uri}
      style={style}
      allowFullscreen={allowFullscreen}
    />
  ) : (
    <View
      style={[
        style || s.media,
        { alignItems: "center", justifyContent: "center", gap: 16 },
      ]}
    >
      {error ? (
        <>
          <Icon name="videocam-outline" color={C.muted} />
          <Text style={s.body}>This video couldn’t load.</Text>
          <Button
            title="Retry video"
            secondary
            onPress={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}
          />
        </>
      ) : (
        <Skeleton height="100%" width="100%" radius={18} />
      )}
    </View>
  );
}
function VideoPlayerFrame({
  source,
  style,
  allowFullscreen,
}: {
  source: VideoSource;
  style?: StyleProp<ViewStyle>;
  allowFullscreen: boolean;
}) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={style || s.media}
      nativeControls
      fullscreenOptions={{ enable: allowFullscreen }}
      contentFit="contain"
    />
  );
}
export function PrivateImage({
  id,
  style,
  resizeMode = "cover",
  thumbnail = false,
}: {
  id: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: React.ComponentProps<typeof Image>["resizeMode"];
  thumbnail?: boolean;
}) {
  const { url, token } = useStore();
  const [loaded, setLoaded] = useState<{ key: string; uri: string } | null>(
    null,
  );
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${url}:${id}:${token}:${attempt}:${thumbnail}`;
  const failed = failedKey === key;
  useEffect(() => {
    const controller = new AbortController();
    // Authenticate through the same fetch path as the API on every platform.
    // Data stays in component memory; no bearer token is put in an image URL.
    (async () => {
      const response = await fetch(
        `${url}/v1/media/${id}${thumbnail ? "?thumbnail=1" : ""}`,
        {
          headers: apiHeaders(token),
          credentials: apiCredentials,
          signal: controller.signal,
        },
      );
      checkSession(response, token);
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
  }, [url, id, token, key, attempt, thumbnail]);
  return loaded?.key === key && !failed ? (
    <Image
      source={{ uri: loaded.uri }}
      style={style}
      resizeMode={resizeMode}
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
        <View style={{ alignItems: "center", gap: 8 }}>
          <Icon name="image-outline" color={C.muted} />
          <Text style={s.small}>Photo unavailable · Retry</Text>
        </View>
      ) : (
        <Skeleton height="100%" width="100%" radius={0} />
      )}
    </Pressable>
  );
}
export function Media({
  id,
  kind = "image",
  style,
  resizeMode = "cover",
  allowFullscreen = true,
}: {
  id: string;
  kind?: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: React.ComponentProps<typeof Image>["resizeMode"];
  allowFullscreen?: boolean;
}) {
  const [loadVideo, setLoadVideo] = useState(false);
  const visible = useMediaVisible();
  return kind === "video" ? (
    loadVideo && visible ? (
      <Video id={id} style={style} allowFullscreen={allowFullscreen} />
    ) : (
      <View
        style={[
          style || s.media,
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
    <PrivateImage id={id} style={style || s.media} resizeMode={resizeMode} />
  );
}
export function Page({
  children,
  refresh = false,
  footer,
  padding = 20,
}: {
  children: React.ReactNode;
  refresh?: boolean;
  footer?: React.ReactNode;
  padding?: number;
}) {
  const st = useStore();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.page,
            { padding, paddingBottom: footer ? 24 : 32 + insets.bottom },
          ]}
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={false}
                onRefresh={() => void st.refresh()}
                tintColor={C.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
        {!!footer && (
          <View
            style={{
              padding: 20,
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: C.bg,
              borderTopWidth: 1,
              borderTopColor: C.line,
            }}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Header({
  title,
  eyebrow,
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
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
          style={s.iconButton}
        >
          <Icon name="arrow-back" />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
        <Text style={s.title}>{title}</Text>
      </View>
      {action ||
        (!back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open activity"
            onPress={() => router.push("/activity")}
            style={s.iconButton}
          >
            <Icon name="notifications-outline" />
            {!!data?.notifications.some(
              (n) => !n.read && n.kind !== "request",
            ) && <View style={s.dot} />}
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
    <View
      style={{
        alignItems: "center",
        paddingVertical: 32,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 20,
          backgroundColor: C.blush,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Icon name={icon} size={30} color={C.primary} />
      </View>
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
        backgroundColor: C.bg,
        padding: 24,
        gap: 20,
      }}
    >
      <Skeleton width={140} height={32} />
      <Skeleton height={380} radius={24} />
      <Skeleton width="75%" height={20} />
      <Skeleton width="50%" height={20} />
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
      colors={[C.blush, C.lavender]}
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
      <Text style={{ fontSize: 48, color: C.primary, zIndex: 1 }}>{emoji}</Text>
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
export function IconButton({
  name,
  label,
  onPress,
  variant = "plain",
  disabled = false,
  size = 22,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  variant?: "plain" | "soft" | "primary";
  disabled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        {
          backgroundColor:
            variant === "primary"
              ? C.primary
              : variant === "soft"
                ? C.blush
                : "transparent",
          opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
        },
      ]}
    >
      <Icon
        name={name}
        size={size}
        color={variant === "primary" ? C.white : C.ink}
      />
    </Pressable>
  );
}
export function Skeleton({
  height = 20,
  width = "100%",
  radius = 12,
}: {
  height?: DimensionValue;
  width?: DimensionValue;
  radius?: number;
}) {
  const [opacity] = useState(() => new Animated.Value(0.55));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const motion = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 900,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    motion.start();
    return () => motion.stop();
  }, [opacity, reduced]);
  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={{
        height,
        width,
        borderRadius: radius,
        backgroundColor: C.line,
        opacity: reduced ? 1 : opacity,
      }}
    />
  );
}
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: "#2C25294D" }]}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 600,
            alignSelf: "center",
            maxHeight: "85%",
            height: footer ? "85%" : undefined,
            flexShrink: 1,
            backgroundColor: C.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: C.line,
              alignSelf: "center",
              marginBottom: 8,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              marginBottom: 8,
            }}
          >
            <Text style={[s.h2, { flex: 1 }]}>{title}</Text>
            <IconButton name="close" label="Close sheet" onPress={onClose} />
          </View>
          <ScrollView
            style={{ flexShrink: 1, minHeight: 0 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
          >
            {children}
          </ScrollView>
          {footer && (
            <View
              style={{
                flexShrink: 0,
                paddingHorizontal: 20,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: C.line,
              }}
            >
              {footer}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function SelectionTile({
  title,
  subtitle,
  icon,
  selected = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 16,
        alignItems: "center",
        padding: 20,
        marginBottom: 12,
        minHeight: 72,
        borderRadius: 16,
        backgroundColor: selected ? C.blush : C.white,
        borderWidth: 1,
        borderColor: selected ? C.primary : C.line,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {icon && <Icon name={icon} color={C.primary} size={24} />}
      <View style={{ flex: 1 }}>
        <Text style={[s.label, { fontSize: 16 }]}>{title}</Text>
        {!!subtitle && (
          <Text style={[s.small, { marginTop: 4 }]}>{subtitle}</Text>
        )}
      </View>
      <Icon
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        color={selected ? C.primary : C.line}
      />
    </Pressable>
  );
}
export function StepProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <View
      accessibilityLabel={`Step ${current} of ${total}`}
      style={{ flexDirection: "row", gap: 6, marginBottom: 24 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            height: 3,
            flex: 1,
            borderRadius: 2,
            backgroundColor: i < current ? C.primary : C.line,
          }}
        />
      ))}
    </View>
  );
}
export function Notice({
  title,
  body,
  onRetry,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={[s.note, { gap: 8 }]}>
      <Text style={s.label}>{title}</Text>
      {!!body && <Text style={s.small}>{body}</Text>}
      {onRetry && <Button title="Try again" onPress={onRetry} secondary />}
    </View>
  );
}
export const s = StyleSheet.create({
  page: {
    padding: 20,
    paddingBottom: 32,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: C.muted,
    marginBottom: 7,
  },
  title: {
    fontWeight: "600",
    fontSize: 26,
    lineHeight: 32,
    color: C.ink,
    letterSpacing: -0.8,
  },
  display: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "600",
    color: C.ink,
    letterSpacing: -1.2,
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    color: C.ink,
    letterSpacing: -0.4,
  },
  body: { fontSize: 16, lineHeight: 24, color: C.ink },
  small: { fontSize: 13, color: C.muted, lineHeight: 20 },
  caption: { fontSize: 13, color: C.muted, lineHeight: 20 },
  meta: { fontSize: 11, color: C.muted, lineHeight: 16 },
  label: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: C.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: C.primary,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: "600", color: C.white },
  secondary: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  chip: {
    backgroundColor: C.lavender,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
  },
  chipText: { fontSize: 13, color: C.ink, fontWeight: "500" },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    minHeight: 56,
    padding: 16,
    color: C.ink,
    fontSize: 16,
  },
  iconButton: {
    height: 44,
    width: 44,
    backgroundColor: "transparent",
    borderRadius: 22,
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
    color: C.primary,
    letterSpacing: 1.9,
    fontWeight: "600",
  },
  bannerTitle: {
    fontWeight: "700",
    fontSize: 30,
    lineHeight: 35,
    color: C.ink,
    marginTop: 13,
    marginBottom: 12,
  },
  bannerBody: { fontSize: 12, lineHeight: 19, color: C.muted, maxWidth: 240 },
  orbit: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: "#E5C9D6",
    right: -30,
    bottom: -70,
  },
  media: {
    width: "100%",
    height: 300,
    borderRadius: 18,
    backgroundColor: C.blush,
    marginVertical: 12,
  },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 15 },
  link: { fontSize: 14, color: C.primary, fontWeight: "600" },
  danger: { color: C.red },
  heroInitial: {
    fontWeight: "700",
    fontSize: 140,
    color: "#FFFFFF99",
  },
  tag: {
    fontSize: 9,
    letterSpacing: 1,
    color: C.primary,
    backgroundColor: C.blush,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: "hidden",
  },
  note: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: C.lavender,
    marginVertical: 12,
  },
});
