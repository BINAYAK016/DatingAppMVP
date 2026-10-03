import { apiHeaders, apiCredentials, checkSession } from "../lib/auth";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useIsFocused } from "expo-router";
import { useEvent, useEventListener } from "expo";
import { useVideoPlayer, VideoSource, VideoView } from "expo-video";
import { useStore } from "../lib/store";
import { Story } from "../lib/types";
import { Button, C, Icon, IconButton, Skeleton } from "./ui";

type Moment = Pick<Story, "id" | "body" | "media_id" | "kind">;
type Playback = {
  selected: boolean;
  paused: boolean;
  onReady: (ready: boolean) => void;
  onProgress?: (progress: number) => void;
  onEnd?: () => void;
};

/** Private, inline playback. The window never holds more than two moments. */
export function StoryPlayer({
  item,
  next,
  active = true,
  paused = false,
  onReady,
  onProgress,
  onEnd,
  onSkip,
  children,
}: {
  item: Moment;
  next?: Moment;
  active?: boolean;
  paused?: boolean;
  onReady?: (ready: boolean) => void;
  onProgress?: (progress: number) => void;
  onEnd?: () => void;
  onSkip?: () => void;
  children?: React.ReactNode;
}) {
  const { token, url } = useStore();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [ready, setReady] = useState<{ id: string; value: boolean } | null>(
    null,
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => listener.remove();
  }, []);
  const visible = active && focused && foreground && !!token;
  const reportReady = useCallback(
    (value: boolean) => {
      setReady({ id: item.id, value });
      onReady?.(value);
    },
    [item.id, onReady],
  );
  const window = [item];
  if (visible && ready?.id === item.id && ready.value && next)
    window.push(next);
  return (
    <View style={styles.frame}>
      {visible ? (
        window.map((moment) => {
          const selected = moment.id === item.id;
          return (
            <MomentSlot
              key={`${url}:${token}:${moment.id}`}
              item={moment}
              selected={selected}
              paused={paused}
              onReady={selected ? reportReady : ignoreReady}
              onProgress={selected ? onProgress : undefined}
              onEnd={selected ? onEnd : undefined}
              onSkip={selected ? onSkip : undefined}
            >
              {selected ? children : null}
            </MomentSlot>
          );
        })
      ) : (
        <Skeleton height="100%" width="100%" radius={0} />
      )}
    </View>
  );
}
const ignoreReady = () => {};

function MomentSlot({
  item,
  selected,
  paused,
  onReady,
  onProgress,
  onEnd,
  onSkip,
  children,
}: Playback & {
  item: Moment;
  onSkip?: () => void;
  children?: React.ReactNode;
}) {
  const { url, token } = useStore();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  const retry = () => {
    setFailed(false);
    setAttempt((value) => value + 1);
  };
  const nativeSource = useMemo<VideoSource>(
    () => ({
      uri: `${url}/v1/media/${item.media_id}`,
      headers: apiHeaders(token),
      useCaching: false,
    }),
    [url, token, item.media_id],
  );
  useEffect(() => {
    if (selected && failed) onReady(false);
  }, [selected, failed, onReady]);
  const playback = { selected, paused, onReady, onProgress, onEnd };
  return (
    <View
      style={selected ? styles.slot : styles.preload}
      pointerEvents={selected ? "auto" : "none"}
      accessibilityElementsHidden={!selected}
      importantForAccessibility={selected ? "auto" : "no-hide-descendants"}
    >
      {failed ? (
        selected && (
          <View style={styles.message}>
            <Icon name="cloud-offline-outline" size={30} color={C.muted} />
            <Text style={styles.error}>This moment couldn’t load.</Text>
            <Text style={styles.hint}>
              Check your connection and try again.
            </Text>
            <Button
              title={item.kind === "video" ? "Retry video" : "Retry story"}
              secondary
              onPress={retry}
            />
            {!!onSkip && (
              <Button title="Skip story" secondary onPress={onSkip} />
            )}
          </View>
        )
      ) : !item.media_id ? (
        <TimedMoment {...playback} duration={textDuration(item.body)} ready>
          {children}
        </TimedMoment>
      ) : item.kind === "video" && Platform.OS !== "web" ? (
        <MomentVideo
          key={attempt}
          {...playback}
          source={nativeSource}
          onError={fail}
        />
      ) : (
        <FetchedMoment key={attempt} item={item} {...playback} onError={fail} />
      )}
    </View>
  );
}

function FetchedMoment({
  item,
  onError,
  ...playback
}: Playback & {
  item: Moment;
  onError: () => void;
}) {
  const { url, token } = useStore();
  const [uri, setUri] = useState<string | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let objectUrl: string | undefined;
    let disposed = false;
    void (async () => {
      const response = await fetch(`${url}/v1/media/${item.media_id}`, {
        headers: apiHeaders(token),
        credentials: apiCredentials,
        signal: controller.signal,
      });
      checkSession(response, token);
      if (!response.ok) throw new Error("Unavailable");
      const mime = response.headers.get("content-type") || "";
      if (item.kind === "video") {
        if (!mime.startsWith("video/")) throw new Error("Unavailable");
        const blob = await response.blob();
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setUri(objectUrl);
      } else {
        if (!mime.startsWith("image/")) throw new Error("Unavailable");
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 8192)
          binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + 8192),
          );
        if (!disposed) setUri(`data:${mime};base64,${btoa(binary)}`);
      }
    })()
      .catch(() => {
        if (!disposed) onError();
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token, item.media_id, item.kind, onError]);
  if (item.kind === "video")
    return uri ? (
      <MomentVideo source={uri} {...playback} onError={onError} />
    ) : (
      <LoadingMoment selected={playback.selected} onReady={playback.onReady} />
    );
  return (
    <TimedMoment {...playback} duration={5} ready={photoReady}>
      {uri && (
        <Image
          source={{ uri }}
          style={styles.media}
          resizeMode="contain"
          accessibilityLabel="Story photo"
          onLoad={() => setPhotoReady(true)}
          onError={onError}
        />
      )}
      {!photoReady && <Skeleton height="100%" width="100%" radius={0} />}
    </TimedMoment>
  );
}

function LoadingMoment({
  selected,
  onReady,
}: Pick<Playback, "selected" | "onReady">) {
  useEffect(() => {
    if (selected) onReady(false);
  }, [selected, onReady]);
  return <Skeleton height="100%" width="100%" radius={0} />;
}

function TimedMoment({
  selected,
  paused,
  ready,
  duration,
  onReady,
  onProgress,
  onEnd,
  children,
}: Playback & {
  ready: boolean;
  duration: number;
  children?: React.ReactNode;
}) {
  const elapsed = useRef(0);
  const complete = useRef(false);
  const callbacks = useRef({ onProgress, onEnd });
  useEffect(() => {
    callbacks.current = { onProgress, onEnd };
  }, [onProgress, onEnd]);
  useEffect(() => {
    if (!selected) return;
    elapsed.current = 0;
    complete.current = false;
    callbacks.current.onProgress?.(0);
  }, [selected]);
  useEffect(() => {
    if (selected) onReady(ready);
  }, [selected, ready, onReady]);
  useEffect(() => {
    if (!selected || paused || !ready) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      elapsed.current += (now - last) / 1000;
      last = now;
      callbacks.current.onProgress?.(Math.min(1, elapsed.current / duration));
      if (elapsed.current >= duration && !complete.current) {
        complete.current = true;
        callbacks.current.onEnd?.();
      }
    }, 80);
    return () => clearInterval(timer);
  }, [selected, paused, ready, duration]);
  return <View style={styles.frame}>{children}</View>;
}

function MomentVideo({
  source,
  selected,
  paused,
  onReady,
  onProgress,
  onEnd,
  onError,
}: Playback & { source: VideoSource; onError: () => void }) {
  const [muted, setMuted] = useState(Platform.OS === "web");
  const complete = useRef(false);
  const player = useVideoPlayer(source, (video) => {
    video.loop = false;
    video.muted = Platform.OS === "web";
    video.timeUpdateEventInterval = 0.1;
  });
  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });
  useEventListener(player, "statusChange", ({ status: nextStatus }) => {
    if (nextStatus === "error") onError();
  });
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (selected && !paused && player.duration > 0)
      onProgress?.(Math.min(1, currentTime / player.duration));
  });
  useEventListener(player, "playToEnd", () => {
    if (selected && !paused && !complete.current) {
      complete.current = true;
      onProgress?.(1);
      onEnd?.();
    }
  });
  /* eslint-disable react-hooks/immutability -- Expo exposes currentTime as a native setter for restarting a selected story. */
  useEffect(() => {
    if (selected) {
      complete.current = false;
      player.currentTime = 0;
      onProgress?.(0);
    }
  }, [selected, player, onProgress]);
  /* eslint-enable react-hooks/immutability */
  useEffect(() => {
    if (selected) onReady(status === "readyToPlay");
    if (status === "error") onError();
    if (selected && !paused && status === "readyToPlay") player.play();
    else player.pause();
  }, [selected, paused, status, player, onReady, onError]);
  useEffect(() => {
    if (!selected || status === "readyToPlay" || status === "error") return;
    const timeout = setTimeout(onError, 15000);
    return () => clearTimeout(timeout);
  }, [selected, status, onError]);
  return (
    <View style={styles.frame}>
      {selected && (
        <VideoView
          player={player}
          style={styles.media}
          contentFit="contain"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
        />
      )}
      {selected && status !== "readyToPlay" && (
        <Skeleton height="100%" width="100%" radius={0} />
      )}
      {selected && Platform.OS === "web" && (
        <View style={styles.sound}>
          <IconButton
            name={muted ? "volume-mute-outline" : "volume-high-outline"}
            label={muted ? "Unmute video" : "Mute video"}
            variant="soft"
            onPress={() => {
              // eslint-disable-next-line react-hooks/immutability
              player.muted = !muted;
              setMuted(!muted);
            }}
          />
        </View>
      )}
    </View>
  );
}

function textDuration(body: string) {
  return Math.min(15, Math.max(6, body.trim().split(/\s+/).length / 3));
}
const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: "100%",
    overflow: "hidden",
    backgroundColor: C.blush,
  },
  slot: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  preload: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  media: { width: "100%", height: "100%" },
  message: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  error: { fontSize: 18, fontWeight: "600", color: C.ink, textAlign: "center" },
  hint: {
    fontSize: 14,
    lineHeight: 21,
    color: C.muted,
    textAlign: "center",
    marginBottom: 8,
  },
  sound: { position: "absolute", right: 12, top: 12 },
});
