import React, { useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useReducedMotion } from "../lib/useReducedMotion";
import { Post } from "../lib/types";
import { useStore } from "../lib/store";
import {
  Avatar,
  BottomSheet,
  Button,
  C,
  Chip,
  Empty,
  Field,
  Icon,
  IconButton,
  PrivateImage,
  s,
} from "./ui";
import { FeedVideo } from "./FeedVideo";

export function PostCard({
  post: source,
  active = false,
  detail = false,
}: {
  post: Post;
  active?: boolean;
  detail?: boolean;
}) {
  const st = useStore();
  const [updated, setUpdated] = useState<{ source: Post; value: Post } | null>(
    null,
  );
  const post = updated?.source === source ? updated.value : source;
  const [open, setOpen] = useState(false),
    [sharing, setSharing] = useState(false),
    [reply, setReply] = useState(""),
    [parent, setParent] = useState<string | undefined>(),
    [busy, setBusy] = useState(false),
    [deleted, setDeleted] = useState(false),
    [play, setPlay] = useState(false);
  const [options, setOptions] = useState(false),
    [photo, setPhoto] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setUpdated({ source, value: await st.request(`/posts/${post.id}`) });
      await st.refresh();
    } catch (e: any) {
      st.toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const reducedMotion = useReducedMotion();
  const [heartScale] = useState(() => new Animated.Value(1));
  const reactToMoment = () => {
    if (!reducedMotion)
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.16,
          duration: 100,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 140,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    if (Platform.OS === "android")
      void Haptics.performAndroidHapticsAsync(
        Haptics.AndroidHaptics.Context_Click,
      ).catch(() => {});
    else if (Platform.OS === "ios")
      void Haptics.selectionAsync().catch(() => {});
    void act(() => st.request(`/posts/${post.id}/react`, {}));
  };
  if (deleted) return null;
  return (
    <View style={styles.post}>
      {post.media_id ? (
        post.kind === "video" ? (
          active && (!st.data?.me.data_saver || play) ? (
            <FeedVideo id={post.media_id} />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Icon name="videocam-outline" size={32} color={C.primary} />
              <Text style={s.small}>
                {st.data?.me.data_saver
                  ? "A moment to play when you’re ready"
                  : "A little moment in motion"}
              </Text>
              {!active ? (
                <Button
                  title="Open video moment"
                  secondary
                  icon="play-outline"
                  onPress={() => router.push(`/post/${post.id}`)}
                />
              ) : (
                st.data?.me.data_saver && (
                  <Button
                    title="Play this video"
                    icon="play-outline"
                    disabled={!active}
                    onPress={() => setPlay(true)}
                  />
                )
              )}
            </View>
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View full photo"
            onPress={() => setPhoto(true)}
          >
            <PrivateImage id={post.media_id} style={styles.photo} />
          </Pressable>
        )
      ) : null}
      <View style={styles.author}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${post.author.name}'s profile`}
          onPress={() => router.push(`/profile/${post.author.id}`)}
        >
          <Avatar person={post.author} size={38} />
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.name}>
            {post.author.name}
            {post.author.demo ? " · demo" : ""}
          </Text>
          <Text style={s.small}>
            {post.author.city} ·{" "}
            {new Date(post.created_at).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
        <IconButton
          name="ellipsis-horizontal"
          label="Post options"
          onPress={() => setOptions(true)}
        />
      </View>
      {!!post.body && (
        <Text
          numberOfLines={!detail && post.media_id ? 4 : undefined}
          style={post.media_id ? styles.caption : styles.textMoment}
        >
          {post.body}
        </Text>
      )}
      {!detail && !!post.media_id && !!post.body && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Read full moment"
          onPress={() => router.push(`/post/${post.id}`)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={s.link}>Read moment</Text>
        </Pressable>
      )}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Like post"
          accessibilityState={{ selected: post.liked }}
          disabled={busy}
          style={styles.action}
          onPress={reactToMoment}
        >
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Icon
              name={post.liked ? "heart" : "heart-outline"}
              color={post.liked ? C.primary : C.ink}
              size={24}
            />
          </Animated.View>
          {!!post.likes && <Text style={styles.count}>{post.likes}</Text>}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comments"
          style={styles.action}
          onPress={() => setOpen(true)}
        >
          <Icon name="chatbubble-outline" size={22} />
          {!!post.comments.length && (
            <Text style={styles.count}>{post.comments.length}</Text>
          )}
        </Pressable>
        <IconButton
          name="paper-plane-outline"
          label="Share privately"
          onPress={() => setSharing(true)}
        />
        <View style={{ flex: 1 }} />
        <IconButton
          name={post.saved ? "bookmark" : "bookmark-outline"}
          label={post.saved ? "Unsave post" : "Save post"}
          disabled={busy}
          onPress={() =>
            void act(() =>
              st.request(`/posts/${post.id}/save`, { enabled: !post.saved }),
            )
          }
        />
      </View>
      <BottomSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        title="Share a little moment"
      >
        <Text style={[s.body, { marginBottom: 20 }]}>
          Send privately to a match who can see this moment.
        </Text>
        {st.data?.matches.length ? (
          st.data.matches.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={`Share with ${person.name}`}
              disabled={busy}
              style={styles.sharePerson}
              onPress={() =>
                void act(async () => {
                  await st.request(`/posts/${post.id}/share`, {
                    target: person.id,
                    clientId: randomUUID(),
                  });
                  setSharing(false);
                  st.toast("Moment shared in your conversation.");
                })
              }
            >
              <Avatar person={person} size={48} />
              <Text style={[s.body, { flex: 1, color: C.ink }]}>
                {person.name}
              </Text>
              <Icon name="paper-plane-outline" size={20} color={C.primary} />
            </Pressable>
          ))
        ) : (
          <Empty
            icon="paper-plane-outline"
            title="A moment for someone"
            body="Your matches will appear here when you connect."
          />
        )}
      </BottomSheet>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="A little conversation"
      >
        {post.comments.length ? (
          post.comments.map((comment) => (
            <View
              key={comment.id}
              style={[
                styles.comment,
                { marginLeft: comment.parent_id ? 20 : 0 },
              ]}
            >
              <Avatar person={comment.author} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={styles.commentName}>{comment.author.name}</Text>
                <Text style={[s.body, { color: C.ink, marginTop: 3 }]}>
                  {comment.body}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Reply to ${comment.author.name}`}
                  onPress={() => setParent(comment.id)}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={s.link}>Reply</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <Text style={[s.body, { paddingVertical: 20 }]}>
            Start with a thought, a question, a little hello.
          </Text>
        )}
        {parent && (
          <View style={{ marginBottom: 12 }}>
            <Chip
              label="Replying to a comment · cancel"
              onPress={() => setParent(undefined)}
            />
          </View>
        )}
        <Field
          value={reply}
          onChangeText={setReply}
          placeholder="A little thought…"
        />
        <Button
          title="Send reply"
          disabled={busy || !reply.trim()}
          onPress={() =>
            void act(async () => {
              await st.request(`/posts/${post.id}/comments`, {
                body: reply,
                parentId: parent,
              });
              setReply("");
              setParent(undefined);
            })
          }
        />
      </BottomSheet>
      <BottomSheet
        visible={options}
        onClose={() => setOptions(false)}
        title="This moment"
      >
        {post.author.id === st.data?.me.id ? (
          <Button
            title="Delete my post"
            secondary
            icon="trash-outline"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await st.request(`/posts/${post.id}`, {}, "DELETE");
                setDeleted(true);
                setOptions(false);
                await st.refresh();
              } catch (e: any) {
                st.toast(e.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <Button
            title="Report post"
            secondary
            icon="flag-outline"
            onPress={() => {
              setOptions(false);
              router.push({
                pathname: "/safety",
                params: { target: post.author.id, context: "post:" + post.id },
              });
            }}
          />
        )}
      </BottomSheet>
      <Modal
        visible={photo}
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={() => setPhoto(false)}
      >
        <SafeAreaView style={styles.fullPhoto}>
          <View style={styles.fullPhotoHeader}>
            <Text style={[s.h2, { flex: 1 }]}>{post.author.name}</Text>
            <IconButton
              name="close"
              label="Close photo"
              onPress={() => setPhoto(false)}
            />
          </View>
          {post.media_id && (
            <PrivateImage
              id={post.media_id}
              resizeMode="contain"
              style={{ flex: 1, width: "100%", borderRadius: 18 }}
            />
          )}
          {!!post.body && (
            <Text
              numberOfLines={3}
              style={[s.body, { color: C.ink, paddingVertical: 20 }]}
            >
              {post.body}
            </Text>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  post: {
    paddingBottom: 20,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  photo: {
    width: "100%",
    height: 400,
    borderRadius: 18,
    backgroundColor: C.blush,
  },
  videoPlaceholder: {
    height: 400,
    borderRadius: 18,
    backgroundColor: C.lavender,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    padding: 24,
  },
  author: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 12,
  },
  name: { fontSize: 14, color: C.ink, fontWeight: "600" },
  caption: { color: C.ink, fontSize: 16, lineHeight: 24 },
  textMoment: {
    color: C.ink,
    fontSize: 25,
    lineHeight: 35,
    letterSpacing: -0.5,
    fontWeight: "500",
    paddingTop: 8,
    paddingBottom: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    marginLeft: -6,
    marginRight: -6,
  },
  action: {
    minWidth: 44,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
  },
  count: { fontSize: 13, color: C.ink },
  sharePerson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    minHeight: 72,
  },
  comment: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  commentName: { fontSize: 14, fontWeight: "600", color: C.ink },
  fullPhoto: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  fullPhotoHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
});
