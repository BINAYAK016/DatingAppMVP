import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Post } from "../lib/types";
import { useStore } from "../lib/store";
import { Avatar, Button, C, Field, Icon, Media, s } from "./ui";
export function PostCard({ post }: { post: Post }) {
  const st = useStore();
  const [open, setOpen] = useState(false),
    [reply, setReply] = useState(""),
    [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await st.refresh();
    } catch (e: any) {
      st.toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Pressable onPress={() => router.push(`/profile/${post.author.id}`)}>
          <Avatar person={post.author} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>
            {post.author.name} {post.author.demo ? "· demo" : ""}
          </Text>
          <Text style={s.small}>
            {post.author.city} ·{" "}
            {new Date(post.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Post options"
          onPress={() =>
            router.push({
              pathname: "/safety",
              params: { target: post.author.id, context: "post:" + post.id },
            })
          }
        >
          <Icon name="ellipsis-horizontal" size={20} />
        </Pressable>
      </View>
      {post.media_id ? (
        <Media id={post.media_id} kind={post.kind} />
      ) : (
        <View
          style={{
            marginTop: 17,
            padding: 20,
            backgroundColor: post.author.color || C.peach,
            borderRadius: 18,
            minHeight: 120,
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontWeight: "700",
              fontSize: 23,
              lineHeight: 32,
              color: C.ink,
            }}
          >
            {post.body}
          </Text>
          <Text
            style={[s.eyebrow, { marginTop: 15, marginBottom: 0, fontSize: 8 }]}
          >
            A LITTLE WINDOW INTO MY WORLD
          </Text>
        </View>
      )}
      {!!post.media_id && !!post.body && (
        <Text style={[s.body, { color: C.ink, marginVertical: 10 }]}>
          {post.body}
        </Text>
      )}
      <View style={[s.row, { marginTop: 15 }]}>
        <Pressable
          disabled={busy}
          accessibilityLabel="Like post"
          onPress={() =>
            void act(() => st.request(`/posts/${post.id}/react`, {}))
          }
          style={s.row}
        >
          <Icon
            name={post.liked ? "heart" : "heart-outline"}
            color={post.liked ? "#A84D69" : C.ink}
            size={22}
          />
          <Text style={s.small}>{post.likes || "Like"}</Text>
        </Pressable>
        <Pressable
          onPress={() => setOpen(!open)}
          style={[s.row, { marginLeft: 10 }]}
        >
          <Icon name="chatbubble-outline" size={19} />
          <Text style={s.small}>{post.comments.length || "Reply"}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Icon name="lock-closed-outline" size={12} />
        <Text style={s.small}>Matches only</Text>
      </View>
      {open && (
        <View style={{ marginTop: 18 }}>
          {post.comments.map((c) => (
            <View key={c.id} style={{ marginBottom: 12 }}>
              <Text style={s.label}>{c.author.name}</Text>
              <Text style={s.body}>{c.body}</Text>
            </View>
          ))}
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
                await st.request(`/posts/${post.id}/comments`, { body: reply });
                setReply("");
              })
            }
          />
        </View>
      )}
      {post.author.id === st.data?.me.id && (
        <Pressable
          style={{ marginTop: 12 }}
          onPress={() =>
            void act(() => st.request(`/posts/${post.id}`, {}, "DELETE"))
          }
        >
          <Text style={[s.small, s.danger]}>Delete my post</Text>
        </Pressable>
      )}
    </View>
  );
}
