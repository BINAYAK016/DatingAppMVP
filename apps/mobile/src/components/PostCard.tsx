import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Post } from "../lib/types";
import { useStore } from "../lib/store";
import { Avatar, Button, C, Chip, Field, Icon, Media, s } from "./ui";
import { FeedVideo } from "./FeedVideo";
export function PostCard({
  post: source,
  active = false,
}: {
  post: Post;
  active?: boolean;
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
  if (deleted) return null;
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${post.author.name}'s profile`}
          onPress={() => router.push(`/profile/${post.author.id}`)}
        >
          <Avatar person={post.author} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>
            {post.author.name}
            {post.author.demo ? " · demo" : ""}
          </Text>
          <Text style={s.small}>
            {post.author.city} ·{" "}
            {new Date(post.created_at).toLocaleDateString()}
          </Text>
        </View>
        {post.author.id !== st.data?.me.id && (
          <Pressable
            accessibilityLabel="Report post"
            onPress={() =>
              router.push({
                pathname: "/safety",
                params: { target: post.author.id, context: "post:" + post.id },
              })
            }
          >
            <Icon name="ellipsis-horizontal" />
          </Pressable>
        )}
      </View>
      {post.media_id ? (
        post.kind === "video" ? (
          active && (!st.data?.me.data_saver || play) ? (
            <FeedVideo id={post.media_id} />
          ) : (
            <View
              style={[
                s.media,
                {
                  height: 360,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                },
              ]}
            >
              <Icon name="videocam-outline" size={36} />
              <Text style={s.small}>
                {st.data?.me.data_saver
                  ? "Data saver is on"
                  : "Video plays when this post is in view"}
              </Text>
              {!active ? (
                <Button
                  title="Open video moment"
                  secondary
                  onPress={() => router.push(`/post/${post.id}`)}
                />
              ) : (
                st.data?.me.data_saver && (
                  <Button
                    title="Play this video"
                    disabled={!active}
                    onPress={() => setPlay(true)}
                  />
                )
              )}
            </View>
          )
        ) : (
          <Media id={post.media_id} kind={post.kind} />
        )
      ) : (
        <View
          style={{
            marginTop: 16,
            padding: 22,
            backgroundColor: C.peach,
            borderRadius: 18,
            minHeight: 130,
            justifyContent: "center",
          }}
        >
          <Text style={[s.h2, { lineHeight: 30 }]}>{post.body}</Text>
        </View>
      )}
      {!!post.media_id && !!post.body && (
        <Text style={[s.body, { marginVertical: 12 }]}>{post.body}</Text>
      )}
      <View style={[s.row, { marginTop: 16, justifyContent: "space-between" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Like post"
          disabled={busy}
          style={s.row}
          onPress={() =>
            void act(() => st.request(`/posts/${post.id}/react`, {}))
          }
        >
          <Icon
            name={post.liked ? "heart" : "heart-outline"}
            color={post.liked ? C.primary : C.ink}
          />
          <Text style={s.small}>{post.likes || "Like"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comments"
          style={s.row}
          onPress={() => setOpen(!open)}
        >
          <Icon name="chatbubble-outline" size={20} />
          <Text style={s.small}>{post.comments.length || "Reply"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.saved ? "Unsave post" : "Save post"}
          disabled={busy}
          onPress={() =>
            void act(() =>
              st.request(`/posts/${post.id}/save`, { enabled: !post.saved }),
            )
          }
        >
          <Icon name={post.saved ? "bookmark" : "bookmark-outline"} size={20} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share privately"
          onPress={() => setSharing(!sharing)}
        >
          <Icon name="paper-plane-outline" size={20} />
        </Pressable>
      </View>
      {sharing && (
        <View style={{ marginTop: 20 }}>
          <Text style={[s.small, { marginBottom: 12 }]}>
            Share with a match who can already see the original post. Access is
            checked each time.
          </Text>
          <View style={s.wrap}>
            {st.data?.matches.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                onPress={() =>
                  void act(async () => {
                    await st.request(`/posts/${post.id}/share`, {
                      target: p.id,
                      clientId: randomUUID(),
                    });
                    setSharing(false);
                    st.toast("Moment shared in your conversation.");
                  })
                }
              />
            ))}
          </View>
        </View>
      )}
      {open && (
        <View style={{ marginTop: 20 }}>
          {post.comments.map((c) => (
            <View
              key={c.id}
              style={{ marginBottom: 14, marginLeft: c.parent_id ? 18 : 0 }}
            >
              <Text style={s.label}>
                {c.author.name}
                {c.parent_id ? " · reply" : ""}
              </Text>
              <Text style={s.body}>{c.body}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setParent(c.id)}
              >
                <Text style={s.link}>Reply to {c.author.name}</Text>
              </Pressable>
            </View>
          ))}
          {parent && (
            <Chip
              label="Replying to a comment · cancel"
              onPress={() => setParent(undefined)}
            />
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
        </View>
      )}
      {post.author.id === st.data?.me.id && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete my post"
          disabled={busy}
          style={{ marginTop: 16 }}
          onPress={async () => {
            setBusy(true);
            try {
              await st.request(`/posts/${post.id}`, {}, "DELETE");
              setDeleted(true);
              await st.refresh();
            } catch (e: any) {
              st.toast(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Text style={[s.small, s.danger]}>Delete my post</Text>
        </Pressable>
      )}
    </View>
  );
}
