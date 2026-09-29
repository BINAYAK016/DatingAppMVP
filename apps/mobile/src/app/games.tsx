import React, { useState } from "react";
import { Text, View, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../lib/store";
import {
  Avatar,
  Banner,
  Button,
  C,
  Empty,
  Header,
  Page,
  Section,
  s,
} from "../components/ui";
export default function Play() {
  const { target } = useLocalSearchParams<{ target?: string }>();
  const st = useStore();
  const [selection, setSelection] = useState({
      from: target,
      value: target || "",
    }),
    [busy, setBusy] = useState(false);
  const selected = selection.from === target ? selection.value : target || "";
  return (
    <Page>
      <Header back title="Dating games" eyebrow="BREAK THE ICE" />
      <Banner
        title={"Good chemistry\nstarts with curiosity."}
        body="Choose in secret. Reveal together. Discover the little things you have in common."
        emoji="⚄"
      />
      <Section title="Choose your partner" />
      {st.data?.matches.length ? (
        <View style={[s.wrap, { marginBottom: 20 }]}>
          {st.data.matches.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Play with ${p.name}`}
              accessibilityState={{ selected: selected === p.id }}
              onPress={() => setSelection({ from: target, value: p.id })}
              style={{
                alignItems: "center",
                gap: 8,
                padding: 12,
                borderRadius: 18,
                borderWidth: 2,
                borderColor: selected === p.id ? C.primary : "transparent",
              }}
            >
              <Avatar person={p} size={48} />
              <Text style={s.label}>{p.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Empty
          title="It takes two"
          body="Once you match with someone, invite them to a little game."
        />
      )}
      {st.data?.games.map((g, i) => (
        <View
          key={g.id}
          style={[
            s.card,
            {
              backgroundColor: ["#FBE4EB", "#FFE6D8", "#EEE8F8"][i],
              padding: 24,
            },
          ]}
        >
          <Text style={{ fontSize: 33, marginBottom: 16 }}>{g.emoji}</Text>
          <Text style={[s.title, { fontSize: 29, lineHeight: 36 }]}>
            {g.title}
          </Text>
          <Text style={[s.body, { marginTop: 9, marginBottom: 20 }]}>
            {g.subtitle}
          </Text>
          <Button
            title="Invite to play"
            disabled={!selected || busy}
            onPress={async () => {
              setBusy(true);
              try {
                const game = await st.request(`/games/${selected}`, {
                  kind: g.id,
                });
                router.push({
                  pathname: "/game/[id]",
                  params: { id: game.id, target: selected },
                });
              } catch (e: any) {
                st.toast(e.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      ))}
      <Text style={[s.small, { textAlign: "center" }]}>
        For fun and conversation. Shared choices aren’t a compatibility
        diagnosis.
      </Text>
    </Page>
  );
}
