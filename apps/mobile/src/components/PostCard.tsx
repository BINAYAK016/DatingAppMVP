import React, { useRef, useState } from "react";
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
  T,
  s,
} from "./ui";
import { FeedVideo } from "./FeedVideo";
import { PhotoCarousel } from "./PhotoCarousel";

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
  const [photoId, setPhotoId] = useState<string | undefined>(post.media_id);
  const [hidden, setHidden] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const busyRef = useRef(false);
  const attachments = post.media?.length
    ? post.media
    : post.media_id
      ? [{ id: post.media_id, kind: post.kind || "image", position: 0 }]
      : [];
  const captionLimit = post.media_id ? 200 : 300;
  const shortened = !detail && post.body.length > captionLimit;
  const caption = shortened
    ? post.body.slice(0, captionLimit).trimEnd() + "…"
    : post.body;
  const act = async (fn: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const hideUnavailable = () => {
      setDeleted(true);
      setOpen(false);
      setSharing(false);
      setPhoto(false);
    };
    let saved = false;
    try {
      await fn();
      saved = true;
      try {
        setUpdated({ source, value: await st.request(`/posts/${post.id}`) });
      } catch (e: any) {
        if ([404, 410].includes(e.status)) hideUnavailable();
        else st.toast("Saved. This moment couldn’t refresh yet.");
      }
      await st.refresh();
    } catch (e: any) {
      // A failed read must not undo a mutation already confirmed by the server.
      if (!saved) setUpdated({ source, value: post });
      if (!saved && [403, 404, 410].includes(e.status)) {
        try {
          // Paused interactions and a recipient's access do not revoke ours.
          setUpdated({ source, value: await st.request(`/posts/${post.id}`) });
        } catch (visibility: any) {
          if ([404, 410].includes(visibility.status)) hideUnavailable();
        }
      }
      st.toast(e.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const reducedMotion = useReducedMotion();
  const [heartScale] = useState(() => new Animated.Value(1));
  const reactToMoment = () => {
    if (busyRef.current) return;
    setUpdated({
      source,
      value: {
        ...post,
        liked: !post.liked,
        likes: Math.max(0, post.likes + (post.liked ? -1 : 1)),
      },
    });
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
  if (hidden)
    return (
      <View style={styles.post}>
        <Text style={s.small}>Hidden for this visit.</Text>
        <Button title="Undo hide" secondary onPress={() => setHidden(false)} />
      </View>
    );
  return (
    <View style={styles.post}>
      <View style={styles.author}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${post.author.name}'s profile`}
          onPress={() => router.push(`/profile/${post.author.id}`)}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
        >
          <Avatar person={post.author} size={44} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
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
      {post.media_id ? (
        post.kind === "video" ? (
          active && (!st.data?.me.data_saver || play) ? (
            <FeedVideo id={post.media_id} />
          ) : (
            <View style={styles.videoPlaceholder}>
              <PrivateImage
                id={post.media_id}
                thumbnail
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.videoPrompt}>
                <Icon name="play" size={28} color={C.white} />
                <Button
                  title={!active ? "Open video moment" : "Play this video"}
                  icon="play-outline"
                  onPress={() =>
                    !active ? router.push("/post/" + post.id) : setPlay(true)
                  }
                />
              </View>
            </View>
          )
        ) : (
          <PhotoCarousel
            items={attachments}
            onOpen={(id) => {
              setPhotoId(id);
              setPhoto(true);
            }}
          />
        )
      ) : null}
      {!!post.body && (
        <Text
          style={
            post.media_id
              ? styles.caption
              : [
                  styles.textMoment,
                  post.body.trim().endsWith("?") && styles.question,
                ]
          }
        >
          {caption}
        </Text>
      )}
      {shortened && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Read full moment"
          onPress={() => router.push(`/post/${post.id}`)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={s.link}>Read more</Text>
        </Pressable>
      )}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Like post"
          aria-pressed={post.liked}
          accessibilityState={{ selected: post.liked }}
          disabled={busy}
          style={[styles.action, busy && { opacity: 0.65 }]}
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
        title="Comments"
        footer={
          <>
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
              onChangeText={(value) => setReply(value.slice(0, 2000))}
              editable={!busy}
              placeholder="A little thought…"
            />
            <Button
              title="Send reply"
              loading={busy}
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
          </>
        }
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
            onPress={() => {
              setOptions(false);
              setConfirmDelete(true);
            }}
          />
        ) : (
          <View style={{ gap: 12 }}>
            <Button
              title="Hide for this visit"
              secondary
              icon="eye-off-outline"
              onPress={() => {
                setOptions(false);
                setHidden(true);
              }}
            />
            <Button
              title="Block or end match"
              secondary
              icon="hand-left-outline"
              onPress={() => {
                setOptions(false);
                router.push({
                  pathname: "/safety",
                  params: {
                    target: post.author.id,
                    context: "post:" + post.id,
                  },
                });
              }}
            />
            <Button
              title="Report post"
              secondary
              icon="flag-outline"
              onPress={() => {
                setOptions(false);
                router.push({
                  pathname: "/safety",
                  params: {
                    target: post.author.id,
                    context: "post:" + post.id,
                  },
                });
              }}
            />
          </View>
        )}
      </BottomSheet>
      <BottomSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this post?"
      >
        <Text style={[s.body, { marginBottom: 18 }]}>
          Your photos, caption and comments will be removed from your matches’
          feed.
        </Text>
        <Button
          title="Keep my post"
          secondary
          onPress={() => setConfirmDelete(false)}
        />
        <Button
          title="Delete post"
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
          {photoId && (
            <PrivateImage
              id={photoId}
              resizeMode="contain"
              style={{ flex: 1, width: "100%", borderRadius: 18 }}
            />
          )}
          {!!post.body && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Read full moment"
              onPress={() => {
                setPhoto(false);
                router.push("/post/" + post.id);
              }}
            >
              <Text
                numberOfLines={3}
                style={[s.body, { color: C.ink, paddingVertical: 20 }]}
              >
                {post.body}
              </Text>
              <Text style={s.link}>Read full moment</Text>
            </Pressable>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  post: {
    padding: 18,
    marginBottom: 20,
    borderRadius: T.radius.card,
    ...T.shadow.card,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
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
    marginTop: 0,
    marginBottom: 12,
  },
  name: { fontSize: 16, lineHeight: 23, color: C.ink, fontWeight: "600" },
  caption: { color: C.ink, fontSize: 16, lineHeight: 24, marginTop: 14 },
  question: {
    backgroundColor: C.peach,
    padding: 20,
    borderRadius: 18,
    marginVertical: 8,
    fontFamily: T.font.editorial,
    fontSize: 24,
    lineHeight: 33,
  },
  videoPrompt: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#2C2529AA",
    alignItems: "center",
  },
  textMoment: {
    color: C.ink,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "400",
    paddingTop: 8,
    paddingBottom: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
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
    padding: 14,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: C.bg,
  },
  commentName: { fontSize: 14, fontWeight: "600", color: C.ink },
  fullPhoto: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  fullPhotoHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
});
