import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView, VideoSource } from "expo-video";
import { useEvent, useEventListener } from "expo";
import { useStore } from "../lib/store";
import { useMediaVisible } from "../lib/useMediaVisible";
import { C, IconButton, Skeleton, s } from "./ui";
export function FeedVideo({ id }: { id: string }) {
  const { url, token } = useStore();
  const visible = useMediaVisible();
  if (!visible) return <Skeleton height={420} radius={18} />;
  return Platform.OS === "web" ? (
    <BrowserVideo key={`${id}:${token}`} id={id} />
  ) : (
    <Player
      source={{
        uri: `${url}/v1/media/${id}`,
        headers: { Authorization: `Bearer ${token}` },
      }}
    />
  );
}
function BrowserVideo({ id }: { id: string }) {
  const { url, token } = useStore();
  const [source, setSource] = useState<string | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let blobUrl: string | undefined;
    fetch(`${url}/v1/media/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const blob = await r.blob();
        if (controller.signal.aborted) return;
        blobUrl = URL.createObjectURL(blob);
        setSource(blobUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => {
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url, token, id]);
  return source ? (
    <Player source={source} />
  ) : (
    <View
      style={[
        s.media,
        {
          height: 420,
          marginVertical: 0,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      {error ? (
        <Text style={s.small}>Video unavailable</Text>
      ) : (
        <Skeleton height={420} radius={18} />
      )}
    </View>
  );
}
function Player({ source }: { source: VideoSource }) {
  const [muted, setMuted] = useState(true);
  const video = useRef<VideoView>(null);
  const { toast } = useStore();
  const player = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  const manualPaused = useRef(false);
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  useEventListener(player, "statusChange", ({ status }) => {
    // On web the setup callback runs before VideoView mounts its media element.
    if (
      Platform.OS === "web" &&
      status === "readyToPlay" &&
      !manualPaused.current
    )
      player.play();
  });
  useEffect(() => {
    if (
      Platform.OS === "web" &&
      player.status === "readyToPlay" &&
      !manualPaused.current
    )
      player.play();
  }, [player]);
  return (
    <View style={styles.frame}>
      <VideoView
        ref={video}
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
      <View style={styles.controls}>
        <IconButton
          name={isPlaying ? "pause-outline" : "play-outline"}
          label={isPlaying ? "Pause video" : "Play video"}
          variant="soft"
          onPress={() => {
            manualPaused.current = isPlaying;
            if (isPlaying) player.pause();
            else player.play();
          }}
        />
        <IconButton
          name="expand-outline"
          label="View video full screen"
          variant="soft"
          onPress={() => {
            void video.current
              ?.enterFullscreen()
              .catch(() => toast("Full screen couldn’t open. Try again."));
          }}
        />
        <IconButton
          name={muted ? "volume-mute-outline" : "volume-high-outline"}
          label={muted ? "Unmute video" : "Mute video"}
          variant="soft"
          onPress={() => {
            // Expo's VideoPlayer exposes a native setter, not mutable React state.
            // eslint-disable-next-line react-hooks/immutability
            player.muted = !muted;
            setMuted(!muted);
          }}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    borderRadius: 18,
    height: 420,
    overflow: "hidden",
    backgroundColor: C.lavender,
  },
  video: { width: "100%", height: "100%" },
  controls: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
  },
});
