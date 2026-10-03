import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { connectionSettingsEnabled } from "../lib/connection";
import { Redirect, router } from "expo-router";
import { DemoAvatarArt } from "../components/DemoAvatarArt";
import {
  DemoConfigRecovery,
  DemoConnectionSettings,
} from "../components/DemoConnection";
import {
  Button,
  C,
  Header,
  Icon,
  Loading,
  Page,
  PersonImage,
  Skeleton,
  humanMessage,
  s,
} from "../components/ui";
import { DEMO_GROUPS, DemoGroup, DemoPerson, DemoUsersPage } from "../lib/demo";
import { useStore } from "../lib/store";

export default function Demo() {
  const st = useStore();
  if (!st.ready || st.bootstrapError) return <Loading />;
  if (st.demoMode === null) return <DemoConfigRecovery />;
  if (!st.demoMode)
    return <Redirect href={st.token ? "/(tabs)" : "/welcome"} />;
  return <DemoSelector key={st.url} />;
}

function DemoSelector() {
  const st = useStore();
  const [group, setGroup] = useState<DemoGroup>("men");
  const [settings, setSettings] = useState(false);
  const [entering, setEntering] = useState<string | null>(null);
  const [entryError, setEntryError] = useState("");
  const enteringRef = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const enter = async (person: DemoPerson) => {
    if (enteringRef.current) return;
    enteringRef.current = true;
    setEntering(person.id);
    setEntryError("");
    try {
      await st.signIn("/auth/demo", { id: person.id });
      if (mounted.current) router.replace("/(tabs)");
    } catch (error: any) {
      if (mounted.current && error.name !== "SessionChangedError")
        setEntryError(humanMessage(error.message));
    } finally {
      enteringRef.current = false;
      if (mounted.current) setEntering(null);
    }
  };
  return (
    <>
      <Page>
        <Header title="Sangai Beta" eyebrow="DEMO MODE" action={<View />} />
        <Text style={[s.body, { marginBottom: 8 }]}>
          Explore Sangai using a demo profile.
        </Text>
        <Text style={[s.small, { marginBottom: 24 }]}>
          All 30 people are fictional adults. Switch perspectives to discover,
          match, chat and play together. No signup needed.
        </Text>
        {!!st.data?.me.demo && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to current demo account"
            onPress={() => router.replace("/(tabs)")}
            style={styles.returnLink}
          >
            <Icon name="arrow-back" size={18} color={C.primary} />
            <Text style={s.link}>Return as {st.data.me.name}</Text>
          </Pressable>
        )}
        <Text style={[s.h2, { marginBottom: 14 }]}>Choose a profile</Text>
        <View style={[s.wrap, { marginBottom: 20 }]}>
          {DEMO_GROUPS.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityState={{
                selected: group === item.id,
                disabled: !!entering,
              }}
              aria-pressed={group === item.id}
              disabled={!!entering}
              onPress={() => {
                setGroup(item.id);
                setEntryError("");
              }}
              style={[
                styles.group,
                group === item.id && styles.selectedGroup,
                !!entering && { opacity: 0.5 },
              ]}
            >
              <Text style={[s.label, group === item.id && { color: C.white }]}>
                {item.title} · {st.demoConfig?.groups[item.id] ?? 10}
              </Text>
            </Pressable>
          ))}
        </View>
        {!!entryError && (
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: C.red, marginBottom: 16 }]}
          >
            {entryError}
          </Text>
        )}
        <DemoUsers
          key={`${st.url}:${group}`}
          group={group}
          entering={entering}
          onEnter={enter}
        />
        <View style={{ gap: 12, marginTop: 20 }}>
          {connectionSettingsEnabled && (
            <Button
              title="Connection settings"
              secondary
              onPress={() => setSettings(true)}
            />
          )}
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(st.url + "/policies")}
            style={styles.policy}
          >
            <Text style={s.small}>Privacy, safety & beta terms</Text>
          </Pressable>
        </View>
      </Page>
      <DemoConnectionSettings
        visible={settings}
        onClose={() => setSettings(false)}
      />
    </>
  );
}

function DemoUsers({
  group,
  entering,
  onEnter,
}: {
  group: DemoGroup;
  entering: string | null;
  onEnter: (person: DemoPerson) => void;
}) {
  const st = useStore(),
    { request } = st;
  const [items, setItems] = useState<DemoPerson[]>([]),
    [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true),
    [moreLoading, setMoreLoading] = useState(false),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    request<DemoUsersPage>(`/demo/users?group=${group}&limit=6`)
      .then((result) => {
        if (active) {
          setItems(result.items);
          setNextCursor(result.nextCursor);
          setError("");
        }
      })
      .catch((failure: any) => {
        if (active && failure.name !== "SessionChangedError")
          setError(humanMessage(failure.message));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, group, retry]);
  const loadMore = async () => {
    if (!nextCursor || pending.current) return;
    pending.current = true;
    setMoreLoading(true);
    setError("");
    try {
      const result = await request<DemoUsersPage>(
        `/demo/users?group=${group}&limit=6&cursor=${encodeURIComponent(nextCursor)}`,
      );
      if (!mounted.current) return;
      setItems((old) => [
        ...new Map(
          [...old, ...result.items].map((person) => [person.id, person]),
        ).values(),
      ]);
      setNextCursor(result.nextCursor);
    } catch (failure: any) {
      if (mounted.current && failure.name !== "SessionChangedError")
        setError(humanMessage(failure.message));
    } finally {
      pending.current = false;
      if (mounted.current) setMoreLoading(false);
    }
  };
  if (loading)
    return (
      <View accessibilityLabel="Loading demo profiles" style={{ gap: 16 }}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height={190} />
        ))}
      </View>
    );
  return (
    <View style={{ gap: 16 }}>
      {items.map((person) => (
        <View key={person.id} style={styles.person}>
          <View style={[s.row, { alignItems: "flex-start" }]}>
            {st.data?.me.demo ? (
              <PersonImage
                person={person}
                style={{ width: 76, height: 92, borderRadius: 14 }}
              />
            ) : (
              <DemoAvatarArt
                person={person}
                style={{ width: 76, height: 92, borderRadius: 14 }}
              />
            )}
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={s.h2}>
                {person.name}, {person.age}
              </Text>
              <Text style={s.small}>
                {person.city} · {person.gender}
              </Text>
              <Text style={s.small}>
                {person.pronouns} · {person.orientation}
              </Text>
              <Text style={s.small}>
                Interested in {person.looking_for.join(", ")}
              </Text>
              <Text style={[s.meta, { color: C.primary }]}>FICTIONAL DEMO</Text>
            </View>
          </View>
          <Text numberOfLines={2} style={[s.body, { marginVertical: 14 }]}>
            {person.bio}
          </Text>
          <Button
            title={
              entering === person.id
                ? `Entering as ${person.name}…`
                : `Enter as ${person.name}`
            }
            disabled={!!entering || st.loading}
            onPress={() => onEnter(person)}
          />
          {!!st.data?.me.demo && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${person.name} profile`}
              disabled={!!entering}
              onPress={() => router.push(`/profile/${person.id}`)}
              style={styles.policy}
            >
              <Text style={s.link}>View profile</Text>
            </Pressable>
          )}
        </View>
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={[s.body, { color: C.red }]}>
          {error}
        </Text>
      )}
      {!items.length && !error && (
        <Text style={s.body}>
          No demo profiles are available in this group.
        </Text>
      )}
      {!items.length && !!error && (
        <Button
          title="Retry loading demos"
          onPress={() => {
            setLoading(true);
            setError("");
            setRetry((value) => value + 1);
          }}
        />
      )}
      {!!nextCursor && (
        <Button
          title={moreLoading ? "Loading more profiles…" : "Load more profiles"}
          disabled={moreLoading || !!entering}
          secondary
          onPress={() => void loadMore()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: C.blush,
  },
  selectedGroup: { backgroundColor: C.primary },
  person: { borderRadius: 18, padding: 18, backgroundColor: C.white },
  returnLink: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 44,
    marginBottom: 16,
  },
  policy: { minHeight: 44, justifyContent: "center", alignItems: "center" },
});
