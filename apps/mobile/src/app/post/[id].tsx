import React, { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { PostCard } from "../../components/PostCard";
import { Empty, Header, Page } from "../../components/ui";
import { useStore } from "../../lib/store";
import { Post } from "../../lib/types";
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { request } = useStore();
  const [post, setPost] = useState<Post | null>(null),
    [error, setError] = useState("");
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = () => {
        if (AppState.currentState !== "active") return;
        request<Post>(`/posts/${id}`)
          .then((p) => {
            if (alive) {
              setPost(p);
              setError("");
            }
          })
          .catch(() => {
            if (alive) {
              setPost(null);
              setError("This moment is no longer shared with you.");
            }
          });
      };
      load();
      const timer = setInterval(load, 12000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [id, request]),
  );
  return (
    <Page>
      <Header back title="A shared moment" />
      {post ? (
        <PostCard post={post} active />
      ) : (
        <Empty
          title={error ? "Moment unavailable" : "Loading moment…"}
          body={error}
        />
      )}
    </Page>
  );
}
