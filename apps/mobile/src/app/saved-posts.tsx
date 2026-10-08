import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { PostCard } from "../components/PostCard";
import { Button, Empty, Header, Page, Skeleton } from "../components/ui";
import { useStore } from "../lib/store";
import { Post } from "../lib/types";

export default function Saved() {
  const { request, toast } = useStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setError(false);
      request<Post[]>("/saved-posts")
        .then((p) => {
          if (alive) setPosts(p);
        })
        .catch((e) => {
          if (alive) setError(true);
          toast(e.message);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
      // A retry restarts this existing focus request without changing its endpoint.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request, toast, attempt]),
  );
  return (
    <Page>
      <Header back title="Saved moments" eyebrow="WORTH COMING BACK TO" />
      {loading ? (
        <View style={{ gap: 16 }}>
          <Skeleton height={260} />
          <Skeleton height={140} />
        </View>
      ) : error ? (
        <>
          <Empty
            title="Let’s try that again"
            body="Your saved moments couldn’t load. Check your connection and try again."
          />
          <Button
            title="Retry"
            onPress={() => setAttempt((value) => value + 1)}
          />
        </>
      ) : posts.length ? (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      ) : (
        <Empty
          icon="bookmark-outline"
          title="Some moments stay with you"
          body="Save something you love from Sangai. It stays here while the author shares it with you."
        />
      )}
    </Page>
  );
}
