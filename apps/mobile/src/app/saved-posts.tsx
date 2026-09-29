import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { PostCard } from "../components/PostCard";
import { Empty, Header, Page } from "../components/ui";
import { useStore } from "../lib/store";
import { Post } from "../lib/types";
export default function Saved() {
  const { request, toast } = useStore();
  const [posts, setPosts] = useState<Post[]>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      request<Post[]>("/saved-posts")
        .then((p) => {
          if (alive) setPosts(p);
        })
        .catch((e) => toast(e.message));
      return () => {
        alive = false;
      };
    }, [request, toast]),
  );
  return (
    <Page>
      <Header back title="Saved moments" eyebrow="JUST FOR YOU" />
      {posts.length ? (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      ) : (
        <Empty
          title="Keep a little inspiration"
          body="Save a post from Sangai. It stays available only while the author shares it with you."
        />
      )}
    </Page>
  );
}
