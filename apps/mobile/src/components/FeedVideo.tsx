import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useVideoPlayer, VideoView, VideoSource } from "expo-video";
import { useStore } from "../lib/store";
import { useMediaVisible } from "../lib/useMediaVisible";
import { Button, C, s } from "./ui";
export function FeedVideo({ id }: { id: string }) {
  const { url, token } = useStore();
  const visible = useMediaVisible();
  if (!visible) return <View style={s.media} />;
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
    <View style={[s.media, { alignItems: "center", justifyContent: "center" }]}>
      {error ? (
        <Text style={s.small}>Video unavailable</Text>
      ) : (
        <ActivityIndicator color={C.primary} />
      )}
    </View>
  );
}
function Player({ source }: { source: VideoSource }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(source, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  return (
    <View>
      <VideoView
        player={player}
        style={[s.media, { height: 420 }]}
        contentFit="contain"
        nativeControls={false}
      />
      <Button
        secondary
        title={muted ? "Unmute video" : "Mute video"}
        onPress={() => {
          // Expo's VideoPlayer exposes a native setter, not mutable React state.
          // eslint-disable-next-line react-hooks/immutability
          player.muted = !muted;
          setMuted(!muted);
        }}
      />
    </View>
  );
}
