import React, { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { PostCard } from "../../components/PostCard";
import { Button, Empty, Header, Page, Skeleton } from "../../components/ui";
import { useStore } from "../../lib/store";
import { Post } from "../../lib/types";
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { request } = useStore();
  const [post, setPost] = useState<Post | null>(null),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
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
              setError(
                "This moment couldn’t load. Try again, or check back later.",
              );
            }
          });
      };
      load();
      const timer = setInterval(load, 12000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
      // A retry restarts the existing focus loader and polling interval.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, request, attempt]),
  );
  return (
    <Page>
      <Header back title="A shared moment" eyebrow="JUST YOUR MATCHES" />
      {post ? (
        <PostCard post={post} active detail />
      ) : error ? (
        <>
          <Empty title="Let’s try that again" body={error} />
          <Button
            title="Retry"
            onPress={() => {
              setError("");
              setAttempt((value) => value + 1);
            }}
          />
        </>
      ) : (
        <Skeleton height={420} />
      )}
    </Page>
  );
}
