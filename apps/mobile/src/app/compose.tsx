import React, { useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Button, C, Field, Header, Icon, Page, s } from "../components/ui";
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
  const publish = async () => {
    setBusy(true);
    try {
      let mediaId: string | undefined;
      if (asset) {
        setStage("Uploading & preparing your media…");
        mediaId = (await st.upload(asset)).id;
      }
      setStage("Sharing your moment…");
      if (kind === "avatar") {
        if (!mediaId) throw new Error("Choose a photo first.");
        await st.request("/profile/photo", { mediaId });
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
        kind === "snap"
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
  return (
    <Page>
      <Header
        back
        title={
          kind === "snap"
            ? "A little just for you."
            : kind === "story"
              ? "Here for a moment."
              : kind === "avatar"
                ? "Your first impression."
                : "Share your everyday."
        }
        eyebrow={
          kind === "snap"
            ? "PRIVATE SNAP"
            : kind === "story"
              ? "24-HOUR STORY"
              : kind === "avatar"
                ? "PROFILE PHOTO"
                : "A NEW MOMENT"
        }
      />
      <View style={s.note}>
        <Text style={s.body}>
          {kind === "snap"
            ? "Only this match can open it, once, for up to 30 seconds. Unopened snaps expire in 24 hours. Screenshots are still possible."
            : kind === "story"
              ? "Visible only to your current mutual matches. Disappears after 24 hours."
              : kind === "avatar"
                ? "This photo is visible on your discovery profile."
                : "Your post, likes, and conversations stay inside your mutual-match community."}
        </Text>
      </View>
      {kind !== "avatar" && (
        <Field
          label={kind === "snap" ? "A little caption" : "What’s on your mind?"}
          value={body}
          onChangeText={(v) =>
            setBody(
              v.slice(0, kind === "snap" ? 140 : kind === "story" ? 300 : 2000),
            )
          }
          placeholder="The little things make the best stories…"
          multiline
        />
      )}
      {asset ? (
        <View style={s.card}>
          {asset.type === "video" ? (
            <View style={{ alignItems: "center", padding: 30 }}>
              <Icon name="videocam-outline" size={45} />
              <Text style={[s.body, { marginTop: 12 }]}>
                Video selected · {Math.round((asset.duration || 0) / 1000)}{" "}
                seconds
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: asset.uri }}
              style={{ width: "100%", height: 270, borderRadius: 16 }}
            />
          )}
          <View style={{ marginTop: 12 }}>
            <Button
              title="Remove media"
              secondary
              onPress={() => setAsset(null)}
              disabled={busy}
            />
          </View>
        </View>
      ) : (
        <View
          style={[
            s.card,
            { padding: 30, alignItems: "center", borderStyle: "dashed" },
          ]}
        >
          <Icon name="images-outline" size={40} />
          <Text style={[s.body, { marginTop: 15 }]}>
            A photo. A short video. A real moment.
          </Text>
        </View>
      )}
      <View style={[s.row, { marginBottom: 12 }]}>
        <View style={{ flex: 1 }}>
          <Button
            title="Library"
            secondary
            icon="images-outline"
            disabled={busy}
            onPress={() => void pick(false)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Camera"
            secondary
            icon="camera-outline"
            disabled={busy}
            onPress={() => void pick(true)}
          />
        </View>
      </View>
      {kind !== "avatar" && (
        <Button
          title="Record a video · up to 30 seconds"
          secondary
          icon="videocam-outline"
          disabled={busy}
          onPress={() => void pick(true, true)}
        />
      )}
      <View style={{ height: 20 }} />
      <Button
        title={
          busy
            ? "One moment…"
            : kind === "snap"
              ? "Send snap"
              : kind === "avatar"
                ? "Use this photo"
                : "Share with my matches"
        }
        disabled={
          busy ||
          (!body.trim() && !asset) ||
          ((kind === "snap" || kind === "avatar") && !asset)
        }
        onPress={() => void publish()}
      />
      {busy && (
        <View style={[s.row, { marginTop: 16, justifyContent: "center" }]}>
          <ActivityIndicator color={C.green} />
          <Text style={s.small}>{stage}</Text>
        </View>
      )}
    </Page>
  );
}
