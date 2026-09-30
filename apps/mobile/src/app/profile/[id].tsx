import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Person } from "../../lib/types";
import { useStore } from "../../lib/store";
import {
  BottomSheet,
  Button,
  Empty,
  Header,
  IconButton,
  Page,
  Skeleton,
} from "../../components/ui";
import {
  ProfileHero,
  ProfileStory,
} from "../../components/ProfilePresentation";
export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const st = useStore();
  const [p, setPerson] = useState<Person | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const { request } = st;
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setPerson(await request<Person>(`/profiles/${id}`));
    } catch {
      setPerson(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id, request]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);
  const isMatch = st.data?.matches.some((m) => m.id === id),
    own = st.data?.me.id === id;
  return (
    <>
      <Page>
        <Header
          back
          title={p?.name || "Profile"}
          action={
            p && !own ? (
              <IconButton
                name="ellipsis-horizontal"
                label="Profile options"
                onPress={() => setOptionsOpen(true)}
              />
            ) : (
              <View />
            )
          }
        />
        {loading ? (
          <View style={{ gap: 24 }}>
            <Skeleton height={430} radius={22} />
            <Skeleton width="45%" height={24} />
            <Skeleton height={80} />
          </View>
        ) : !p ? (
          <>
            <Empty
              title="Let’s try that again"
              body={
                failed
                  ? "We couldn’t open this profile. Check your connection and try again."
                  : "This profile is no longer available."
              }
            />
            <Button
              title="Retry profile"
              secondary
              onPress={() => void load()}
            />
          </>
        ) : (
          <>
            <ProfileHero person={p} />
            <ProfileStory person={p} />
            {isMatch ? (
              <Button
                title="Open your conversation"
                icon="chatbubble-outline"
                onPress={() => router.push(`/chat/${id}`)}
              />
            ) : (
              !own && (
                <Button
                  title="Back to Discover"
                  icon="heart-outline"
                  onPress={() =>
                    router.canGoBack()
                      ? router.back()
                      : router.replace("/(tabs)")
                  }
                />
              )
            )}
          </>
        )}
      </Page>
      <BottomSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        title="Profile options"
      >
        <Button
          title="Safety & privacy"
          secondary
          icon="shield-checkmark-outline"
          onPress={() => {
            setOptionsOpen(false);
            router.push({ pathname: "/safety", params: { target: id } });
          }}
        />
      </BottomSheet>
    </>
  );
}
