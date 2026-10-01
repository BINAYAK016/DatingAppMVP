import React, { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Person } from "../../lib/types";
import { useStore } from "../../lib/store";
import { isUnavailable } from "../../lib/screenErrors";
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
    [failure, setFailure] = useState<"network" | "unavailable" | null>(null);
  const sequence = useRef(0);
  const { request } = st;
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setPerson(null);
    setFailure(null);
    setOptionsOpen(false);
    try {
      const next = await request<Person>(`/profiles/${id}`);
      if (sequence.current === current) {
        setPerson(next);
        if (!next) setFailure("unavailable");
      }
    } catch (e) {
      if (sequence.current === current)
        setFailure(isUnavailable(e) ? "unavailable" : "network");
    } finally {
      if (sequence.current === current) setLoading(false);
    }
  }, [id, request]);
  useFocusEffect(
    useCallback(() => {
      const first = setTimeout(() => void load(), 0);
      return () => {
        clearTimeout(first);
        sequence.current++;
        setPerson(null);
        setLoading(true);
        setOptionsOpen(false);
      };
    }, [load]),
  );
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
              title={
                failure === "network"
                  ? "Let’s try that again"
                  : "Profile unavailable"
              }
              body={
                failure === "network"
                  ? "We couldn’t open this profile. Check your connection and try again."
                  : "This profile is no longer available."
              }
            />
            {failure === "network" && (
              <Button
                title="Retry profile"
                secondary
                onPress={() => void load()}
              />
            )}
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
