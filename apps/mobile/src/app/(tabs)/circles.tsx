import React from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useStore } from "../../lib/store";
import {
  Avatar,
  Banner,
  Button,
  Empty,
  Header,
  Icon,
  Page,
  Section,
  s,
} from "../../components/ui";
export default function Circles() {
  const st = useStore();
  return (
    <Page refresh>
      <Header
        title="Your kind of people."
        eyebrow="SMALL CIRCLES. REAL CONNECTIONS."
      />
      <Banner
        title={"A shared spark.\nA little community."}
        body="Every person in a circle is mutually matched with everyone else. A truly private place to belong."
        emoji="◌"
      />
      <Section title="Your circles" aside="Invite-only" />
      {st.data?.circles.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => router.push(`/circle/${c.id}`)}
          style={s.card}
        >
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>{c.name}</Text>
              <Text style={[s.body, { marginTop: 8 }]}>{c.description}</Text>
            </View>
            <Icon name="arrow-up-right-box-outline" />
          </View>
          <View style={[s.row, { marginTop: 20 }]}>
            {c.members.slice(0, 5).map((p) => (
              <Avatar key={p.id} person={p} size={34} />
            ))}
            <Text style={s.small}>{c.members.length} mutual matches</Text>
          </View>
        </Pressable>
      ))}
      {!st.data?.circles.length && (
        <Empty
          title="Start something small"
          body="Create a circle with people who are all mutually matched. If any pair unmatches, that circle pauses."
        />
      )}
      <Button
        title="Create a circle"
        icon="add"
        onPress={() => router.push("/new-circle")}
      />
      <Text style={[s.small, { textAlign: "center", marginTop: 17 }]}>
        Conversations and events stay within your circle.
      </Text>
    </Page>
  );
}
