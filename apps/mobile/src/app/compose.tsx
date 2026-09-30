import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { Button, C, Header, Icon, IconButton, Page, s } from "../components/ui";
import { useStore } from "../lib/store";
export default function Compose() {
  const { kind = "post", target } = useLocalSearchParams<{
    kind?: string;
    target?: string;
  }>();
  const st = useStore();
  const [body, setBody] = useState(""),
    [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [busy, setBusy] = useState(false),
    [stage, setStage] = useState("");
  const pick = async (camera: boolean, video = false) => {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          st.toast(
            "Camera permission is off. You can still choose from your library.",
          );
          return;
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: video ? ["videos"] : ["images"],
            videoMaxDuration: 30,
            quality: 0.75,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: kind === "avatar" ? ["images"] : ["images", "videos"],
            quality: 0.75,
            videoMaxDuration: 30,
          });
      if (!result.canceled) {
        const a = result.assets[0];
        if ((a.fileSize || 0) > 20 * 1024 * 1024 || (a.duration || 0) > 30000)
          throw new Error(
            "Choose a photo or a video up to 30 seconds and 20 MB.",
          );
        setAsset(a);
      }
    } catch (e: any) {
      st.toast(e.message);
    }
  };
  const [clientId] = useState(() => randomUUID());
  const publish = async () => {
    setBusy(true);
    try {
      let mediaId: string | undefined;
      if (asset) {
        setStage("Uploading & preparing your media…");
        mediaId = (await st.upload(asset)).id;
      }
      setStage("Sharing your moment…");
      if (kind === "gallery") {
        if (!mediaId) throw new Error("Choose a photo or video first.");
        await st.request("/profile/media", { mediaId });
      } else if (kind === "avatar") {
        if (!mediaId) throw new Error("Choose a photo first.");
        await st.request("/profile/photo", { mediaId });
      } else if (kind === "message") {
        if (!mediaId || !target)
          throw new Error("Choose a photo or video for your match.");
        await st.request(`/chat/${target}`, { body, mediaId, clientId });
      } else if (kind === "snap") {
        if (!mediaId || !target)
          throw new Error("Choose a photo or video for your snap.");
        await st.request(`/snaps/${target}`, { mediaId, caption: body });
      } else
        await st.request(kind === "story" ? "/stories" : "/posts", {
          body,
          mediaId,
        });
      await st.refresh();
      st.toast(
        kind === "message"
          ? "Message sent."
          : kind === "snap"
            ? "Snap sent."
            : kind === "avatar"
              ? "Profile photo updated."
              : "Your moment is shared.",
      );
      router.back();
    } catch (e: any) {
      st.toast(e.message);
    } finally {
      setBusy(false);
      setStage("");
    }
  };
  const title =
    kind === "gallery"
      ? "Profile photos"
      : kind === "avatar"
        ? "Your profile photo"
        : kind === "message"
          ? "Photo or video"
          : kind === "snap"
            ? "Send a snap"
            : kind === "story"
              ? "Your story"
              : "Share a moment";
  const hint =
    kind === "message"
      ? "A photo or video, just for this conversation."
      : kind === "snap"
        ? "View once · unopened snaps expire in 24 hours. Screenshots are possible."
        : kind === "story"
          ? "Here for 24 hours. Only your current matches can see it."
          : kind === "avatar"
            ? "Your first impression on Discover."
            : kind === "gallery"
              ? "A little more of you, on your profile."
              : "Your everyday, shared only with current matches.";
  return (
    <Page
      footer={
        <View style={{ gap: 10 }}>
          <Button
            title={
              busy
                ? "One moment…"
                : kind === "message"
                  ? "Send to this match"
                  : kind === "gallery"
                    ? "Add to profile"
                    : kind === "snap"
                      ? "Send snap"
                      : kind === "avatar"
                        ? "Use this photo"
                        : "Share with my matches"
            }
            disabled={
              busy ||
              (!body.trim() && !asset) ||
              (["snap", "avatar", "gallery", "message"].includes(kind) &&
                !asset)
            }
            onPress={() => void publish()}
          />
          {busy && (
            <View style={[s.row, { justifyContent: "center" }]}>
              <ActivityIndicator size="small" color={C.primary} />
              <Text style={s.small}>{stage}</Text>
            </View>
          )}
        </View>
      }
    >
      <Header back title={title} />
      <View style={[s.row, { alignItems: "flex-start", marginBottom: 24 }]}>
        <Icon
          name={
            kind === "avatar" || kind === "gallery"
              ? "person-outline"
              : "lock-closed-outline"
          }
          size={14}
          color={C.muted}
        />
        <Text style={[s.small, { flex: 1 }]}>{hint}</Text>
      </View>
      {kind !== "avatar" && kind !== "gallery" && (
        <View style={{ marginBottom: 20 }}>
          <TextInput
            accessibilityLabel={
              kind === "snap" ? "A little caption" : "What’s on your mind?"
            }
            value={body}
            onChangeText={(value) =>
              setBody(
                value.slice(
                  0,
                  kind === "snap" ? 140 : kind === "story" ? 300 : 2000,
                ),
              )
            }
            placeholder="The little things make the best stories…"
            placeholderTextColor={C.muted}
            multiline
            style={styles.caption}
            editable={!busy}
          />
          {!!body.length && (
            <Text style={[s.small, { textAlign: "right", marginTop: 8 }]}>
              {body.length}/
              {kind === "snap" ? 140 : kind === "story" ? 300 : 2000}
            </Text>
          )}
        </View>
      )}
      {asset ? (
        <View style={styles.preview}>
          {asset.type === "video" ? (
            <LocalVideo uri={asset.uri} />
          ) : (
            <Image
              source={{ uri: asset.uri }}
              style={styles.photo}
              resizeMode="contain"
            />
          )}
          <View style={styles.remove}>
            <IconButton
              name="close"
              label="Remove media"
              variant="soft"
              disabled={busy}
              onPress={() => setAsset(null)}
            />
          </View>
          {asset.type === "video" && (
            <Text style={styles.duration}>
              Video · {Math.round((asset.duration || 0) / 1000)} seconds
            </Text>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a photo or video"
          disabled={busy}
          onPress={() => void pick(false)}
          style={styles.emptyPreview}
        >
          <View style={styles.mediaIcon}>
            <Icon name="images-outline" size={30} color={C.primary} />
          </View>
          <Text style={styles.mediaTitle}>
            {kind === "avatar"
              ? "A photo that feels like you"
              : "A little glimpse of your world"}
          </Text>
          <Text style={[s.small, { textAlign: "center" }]}>
            {kind === "avatar"
              ? "Choose your profile photo"
              : "Add a photo or a short video"}
          </Text>
        </Pressable>
      )}
      <View style={{ gap: 10, marginTop: 20 }}>
        <Button
          title="Library"
          secondary
          icon="images-outline"
          disabled={busy}
          onPress={() => void pick(false)}
        />
        {(kind === "snap" || kind === "story") && (
          <>
            <Button
              title="Camera"
              secondary
              icon="camera-outline"
              disabled={busy}
              onPress={() => void pick(true)}
            />
            <Button
              title="Record a video · up to 30 seconds"
              secondary
              icon="videocam-outline"
              disabled={busy}
              onPress={() => void pick(true, true)}
            />
          </>
        )}
      </View>
      {kind !== "avatar" && (
        <Text style={[s.small, { textAlign: "center", marginTop: 20 }]}>
          Photos and videos up to 20 MB. Videos up to 30 seconds.
        </Text>
      )}
    </Page>
  );
}
function LocalVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={styles.photo}
      nativeControls
      contentFit="contain"
    />
  );
}
const styles = StyleSheet.create({
  caption: {
    minHeight: 120,
    padding: 0,
    textAlignVertical: "top",
    color: C.ink,
    fontSize: 22,
    lineHeight: 31,
    backgroundColor: "transparent",
  },
  preview: {
    position: "relative",
    backgroundColor: C.blush,
    borderRadius: 18,
    overflow: "hidden",
  },
  photo: { width: "100%", height: 360 },
  remove: { position: "absolute", right: 10, top: 10 },
  duration: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.muted,
    fontSize: 12,
  },
  emptyPreview: {
    minHeight: 230,
    borderRadius: 18,
    backgroundColor: C.blush,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  mediaIcon: {
    width: 64,
    height: 64,
    backgroundColor: C.white,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  mediaTitle: {
    fontSize: 17,
    fontWeight: "500",
    color: C.ink,
    textAlign: "center",
  },
});
