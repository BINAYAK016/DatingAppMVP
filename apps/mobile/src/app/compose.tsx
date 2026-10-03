import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { randomUUID } from "expo-crypto";
import {
  pickMedia,
  recoverPickedMedia,
  autoOpenCamera,
  releasePickedMedia,
  cameraHint,
} from "../lib/media";
import type * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  BottomSheet,
  Button,
  C,
  Header,
  Icon,
  IconButton,
  Page,
  s,
} from "../components/ui";
import { useStore } from "../lib/store";
import { useMediaVisible } from "../lib/useMediaVisible";
import { uploadMedia } from "../lib/uploadMedia";

export default function Compose() {
  const {
    kind = "post",
    target,
    camera,
  } = useLocalSearchParams<{
    kind?: string;
    target?: string;
    camera?: string;
  }>();
  const st = useStore(),
    navigation = useNavigation();
  const [body, setBody] = useState("");
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const previousAssets = useRef<ImagePicker.ImagePickerAsset[]>([]);
  useEffect(() => {
    for (const old of previousAssets.current)
      if (!assets.some((item) => item.uri === old.uri)) releasePickedMedia(old);
    previousAssets.current = assets;
  }, [assets]);
  useEffect(
    () => () => {
      previousAssets.current.forEach(releasePickedMedia);
    },
    [],
  );
  const [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [picking, setPicking] = useState(false);
  const [stage, setStage] = useState(""),
    [progress, setProgress] = useState(0),
    [sent, setSent] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pendingAction = useRef<
    Parameters<typeof navigation.dispatch>[0] | null
  >(null);
  const uploads = useRef(new Map<string, string>()),
    controller = useRef<AbortController | null>(null);
  const pickingRef = useRef(false),
    cameraOpened = useRef(false);
  const [clientId, setClientId] = useState(() => randomUUID());
  const mutable = !busy && !picking;
  const limit = kind === "post" ? 6 : 1;
  const needsMedia = ["snap", "avatar", "gallery", "message"].includes(kind);
  const captionLimit = kind === "snap" ? 140 : kind === "story" ? 300 : 2000;
  const updateDraft = () => setClientId(randomUUID());
  usePreventRemove(
    !!st.token &&
      !sent &&
      !leaving &&
      (busy || !!body.trim() || !!assets.length),
    ({ data }) => {
      pendingAction.current = data.action;
      setDiscard(true);
    },
  );
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (leaving && pendingAction.current)
      navigation.dispatch(pendingAction.current);
  }, [leaving, navigation]);
  const accept = useCallback(
    (result: ImagePicker.ImagePickerResult, append = false) => {
      if (result.canceled) return;
      const picked = result.assets;
      if (
        picked.some(
          (a) =>
            a.type === "video" &&
            ((a.fileSize || 0) > 20 * 1024 * 1024 || (a.duration || 0) > 30000),
        )
      )
        throw new Error("Choose a shorter video, up to 30 seconds.");
      if (picked.some((a) => a.type === "video") && picked.length > 1)
        throw new Error("Choose photos together, or one video.");
      setAssets((previous) => {
        const next =
          append &&
          !picked.some((a) => a.type === "video") &&
          !previous.some((a) => a.type === "video")
            ? [...previous, ...picked]
            : picked;
        return [...new Map(next.map((a) => [a.uri, a])).values()].slice(
          0,
          limit,
        );
      });
      setSelected(0);
      setClientId(randomUUID());
    },
    [limit],
  );
  const pick = useCallback(
    async (mode: "photos" | "video" | "camera" | "record") => {
      if (pickingRef.current) return;
      pickingRef.current = true;
      setPicking(true);
      try {
        const nativeCamera = mode === "camera" || mode === "record";
        const video = mode === "video" || mode === "record";
        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: video ? ["videos"] : ["images"],
          quality: 0.85,
          videoMaxDuration: 30,
          allowsEditing: kind === "avatar",
          aspect: [1, 1],
          allowsMultipleSelection: !nativeCamera && kind === "post" && !video,
          orderedSelection: true,
          selectionLimit:
            kind === "post" && !video ? Math.max(1, 6 - assets.length) : 1,
        };
        accept(
          await pickMedia(options, nativeCamera),
          !nativeCamera && kind === "post" && !video,
        );
      } catch (e: any) {
        st.toast(e.message);
      } finally {
        pickingRef.current = false;
        setPicking(false);
      }
    },
    [st, kind, assets.length, accept],
  );
  useEffect(() => {
    if (cameraOpened.current) return;
    cameraOpened.current = true;
    void (async () => {
      const pending = await recoverPickedMedia();
      if (pending && !pending.canceled) {
        accept(pending);
        return;
      }
      if (camera === "photo" && kind === "snap" && autoOpenCamera)
        await pick("camera");
    })().catch(() =>
      st.toast("Your camera couldn’t open. You can still choose a photo."),
    );
  }, [camera, kind, pick, accept, st]);
  const crop = async () => {
    const asset = assets[selected];
    if (!asset || asset.type === "video" || !asset.width || !asset.height)
      return;
    setPicking(true);
    try {
      const side = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      context.crop({
        originX: Math.floor((asset.width - side) / 2),
        originY: Math.floor((asset.height - side) / 2),
        width: side,
        height: side,
      });
      const result = await (
        await context.renderAsync()
      ).saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      setAssets((items) =>
        items.map((a, i) =>
          i === selected
            ? {
                ...a,
                ...result,
                file: undefined,
                mimeType: "image/jpeg",
                fileName: "photo.jpg",
              }
            : a,
        ),
      );
      updateDraft();
    } catch {
      st.toast("We couldn’t crop this photo. Try another one.");
    } finally {
      setPicking(false);
    }
  };
  const move = (direction: number) => {
    const destination = selected + direction;
    if (destination < 0 || destination >= assets.length) return;
    setAssets((items) => {
      const next = [...items];
      [next[selected], next[destination]] = [next[destination], next[selected]];
      return next;
    });
    setSelected(destination);
    updateDraft();
  };
  const publish = async () => {
    if (busy || !st.token) return;
    setBusy(true);
    controller.current = new AbortController();
    try {
      const mediaIds: string[] = [];
      for (const [index, asset] of assets.entries()) {
        let id = uploads.current.get(asset.uri);
        if (!id) {
          setProgress(0);
          setStage(
            `Uploading ${assets.length > 1 ? `photo ${index + 1} of ${assets.length}` : asset.type === "video" ? "video" : "photo"}`,
          );
          const media = await uploadMedia(
            st.url,
            st.token,
            asset,
            (fraction) => {
              setProgress(fraction);
              if (fraction >= 1)
                setStage(
                  asset.type === "video"
                    ? "Getting your video ready…"
                    : "Getting your photo ready…",
                );
            },
            controller.current.signal,
          );
          id = media.id;
          uploads.current.set(asset.uri, id);
        }
        mediaIds.push(id);
      }
      if (controller.current.signal.aborted)
        throw new Error("Upload cancelled.");
      setStage(kind === "post" ? "Posting…" : "Sending…");
      const mediaId = mediaIds[0];
      if (kind === "gallery") await st.request("/profile/media", { mediaId });
      else if (kind === "avatar")
        await st.request("/profile/photo", { mediaId });
      else if (kind === "message")
        await st.request(`/chat/${target}`, { body, mediaId, clientId });
      else if (kind === "snap")
        await st.request(`/snaps/${target}`, { mediaId, caption: body });
      else if (kind === "story")
        await st.request("/stories", { body, mediaId });
      else await st.request("/posts", { body, mediaIds, clientId });
      setSent(true);
      await st.refresh();
      st.toast(
        kind === "post"
          ? "Posted to your matches."
          : kind === "snap"
            ? "Snap sent."
            : kind === "story"
              ? "Story shared."
              : kind === "message"
                ? "Message sent."
                : "Profile photo saved.",
      );
    } catch (e: any) {
      st.toast(e.message);
    } finally {
      setBusy(false);
      setStage("");
    }
  };
  useEffect(() => {
    if (sent) router.back();
  }, [sent]);
  const asset = assets[selected];
  const title =
    kind === "post"
      ? "Create Post"
      : kind === "snap"
        ? "Send a snap"
        : kind === "story"
          ? "Your story"
          : kind === "message"
            ? "Photo or video"
            : "Your profile photo";
  return (
    <Page
      footer={
        <View style={{ gap: 10 }}>
          {busy && (
            <>
              <View style={[s.row, { justifyContent: "center" }]}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={s.small}>
                  {stage}
                  {progress > 0 && progress < 1
                    ? ` · ${Math.round(progress * 100)}%`
                    : ""}
                </Text>
              </View>
              <View style={styles.progress}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(progress * 100)}%` },
                  ]}
                />
              </View>
            </>
          )}
          <Button
            title={
              busy
                ? "One moment…"
                : kind === "post"
                  ? "Post"
                  : kind === "snap"
                    ? "Send snap"
                    : kind === "message"
                      ? "Send to this match"
                      : kind === "story"
                        ? "Share story"
                        : kind === "gallery"
                          ? "Add to profile"
                          : "Use this photo"
            }
            disabled={
              !mutable ||
              (!body.trim() && !assets.length) ||
              (needsMedia && !assets.length)
            }
            onPress={() => void publish()}
          />
        </View>
      }
    >
      <Header back title={title} />
      <View style={[s.row, { marginBottom: 20 }]}>
        <Icon
          name={
            kind === "avatar" || kind === "gallery"
              ? "person-outline"
              : "lock-closed-outline"
          }
          size={14}
          color={C.muted}
        />
        <Text style={[s.small, { flex: 1 }]}>
          {kind === "post"
            ? "Your everyday, shared with your current matches."
            : kind === "snap"
              ? "View once · unopened for 24 hours. Screenshots are possible."
              : kind === "story"
                ? "24 hours, just for your current matches."
                : kind === "message"
                  ? "Just for this conversation."
                  : "A little more of you, on your profile."}
        </Text>
      </View>
      {asset ? (
        <>
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
                label={`Remove ${asset.type === "video" ? "video" : "photo"}`}
                variant="soft"
                disabled={!mutable}
                onPress={() => {
                  setAssets((items) => items.filter((_, i) => i !== selected));
                  setSelected(0);
                  updateDraft();
                }}
              />
            </View>
            {assets.length > 1 && (
              <Text style={styles.badge}>
                {selected + 1} / {assets.length}
              </Text>
            )}
          </View>
          {assets.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 12 }}
            >
              <View style={[s.row, { gap: 10 }]}>
                {assets.map((item, i) => (
                  <Pressable
                    key={item.uri}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview photo ${i + 1}`}
                    accessibilityState={{ selected: i === selected }}
                    onPress={() => setSelected(i)}
                    style={[
                      styles.thumb,
                      i === selected && { borderColor: C.primary },
                    ]}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={{ width: 56, height: 64 }}
                    />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
          <View
            style={[
              s.row,
              { justifyContent: "space-between", marginVertical: 10 },
            ]}
          >
            {asset.type !== "video" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Crop square"
                disabled={!mutable}
                onPress={() => void crop()}
                style={styles.textAction}
              >
                <Icon name="crop-outline" size={18} />
                <Text style={s.link}>Crop square</Text>
              </Pressable>
            )}
            {assets.length > 1 && (
              <View style={s.row}>
                <IconButton
                  name="arrow-back"
                  label="Move photo earlier"
                  disabled={!mutable || selected === 0}
                  onPress={() => move(-1)}
                />
                <IconButton
                  name="arrow-forward"
                  label="Move photo later"
                  disabled={!mutable || selected === assets.length - 1}
                  onPress={() => move(1)}
                />
              </View>
            )}
          </View>
          {kind === "post" && asset.type !== "video" && assets.length < 6 && (
            <Button
              title="Add photos"
              secondary
              icon="add"
              disabled={!mutable}
              onPress={() => void pick("photos")}
            />
          )}
        </>
      ) : (
        <View style={styles.chooser}>
          <View style={s.row}>
            <Icon name="images-outline" size={26} color={C.primary} />
            <Text style={[s.h2, { flex: 1 }]}>
              {needsMedia ? "Choose a moment" : "Add to your moment"}
            </Text>
          </View>
          <Button
            title={kind === "post" ? "Choose photos" : "Choose a photo"}
            secondary
            icon="images-outline"
            disabled={!mutable}
            onPress={() => void pick("photos")}
          />
          {kind !== "avatar" && (
            <Button
              title="Choose a short video"
              secondary
              icon="videocam-outline"
              disabled={!mutable}
              onPress={() => void pick("video")}
            />
          )}
        </View>
      )}
      {!!cameraHint && (kind === "snap" || kind === "story") && (
        <Text style={[s.small, { marginTop: 12 }]}>{cameraHint}</Text>
      )}
      {(kind === "snap" || kind === "story") && (
        <View style={[s.row, { marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Button
              title="Camera"
              secondary
              icon="camera-outline"
              disabled={!mutable}
              onPress={() => void pick("camera")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Record"
              secondary
              icon="videocam-outline"
              disabled={!mutable}
              onPress={() => void pick("record")}
            />
          </View>
        </View>
      )}
      {kind !== "avatar" && kind !== "gallery" && (
        <View style={{ marginTop: 24 }}>
          <Text style={[s.small, { marginBottom: 8 }]}>
            {assets.length ? "A little caption" : "Or share a thought"}
          </Text>
          <TextInput
            accessibilityLabel={
              kind === "snap" ? "A little caption" : "What’s on your mind?"
            }
            value={body}
            onChangeText={(value) => {
              setBody(value.slice(0, captionLimit));
              updateDraft();
            }}
            placeholder="What made you smile today?"
            placeholderTextColor={C.muted}
            multiline
            editable={mutable}
            style={styles.caption}
          />
          {body.length > captionLimit - 100 && (
            <Text style={[s.small, { textAlign: "right" }]}>
              {body.length}/{captionLimit}
            </Text>
          )}
        </View>
      )}
      <BottomSheet
        visible={discard}
        onClose={() => setDiscard(false)}
        title={busy ? "Leave while uploading?" : "Discard this draft?"}
      >
        <Text style={[s.body, { marginBottom: 18 }]}>
          {busy
            ? "Leaving stops the current upload. A post already sent may still appear in your feed."
            : "Your photos and caption haven’t been posted."}
        </Text>
        <Button title="Keep editing" onPress={() => setDiscard(false)} />
        <Button
          title="Discard and leave"
          secondary
          onPress={() => {
            controller.current?.abort();
            setDiscard(false);
            setLeaving(true);
          }}
        />
      </BottomSheet>
    </Page>
  );
}
function LocalVideo({ uri }: { uri: string }) {
  const visible = useMediaVisible();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  useEffect(() => {
    if (!visible) player.pause();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
    });
    return () => subscription.remove();
  }, [player, visible]);
  return (
    <VideoView
      player={player}
      style={styles.photo}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: false }}
    />
  );
}
const styles = StyleSheet.create({
  chooser: { padding: 20, backgroundColor: C.blush, borderRadius: 20, gap: 14 },
  caption: {
    minHeight: 100,
    padding: 0,
    textAlignVertical: "top",
    color: C.ink,
    fontSize: 20,
    lineHeight: 29,
  },
  preview: {
    position: "relative",
    backgroundColor: C.blush,
    borderRadius: 18,
    overflow: "hidden",
  },
  photo: { width: "100%", height: 310 },
  remove: { position: "absolute", right: 10, top: 10 },
  badge: {
    position: "absolute",
    left: 12,
    bottom: 12,
    backgroundColor: "#2C2529CC",
    color: C.white,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  thumb: {
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 10,
    overflow: "hidden",
  },
  textAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progress: {
    height: 3,
    backgroundColor: C.blush,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 3, backgroundColor: C.primary },
});
