import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Person } from "../lib/types";
import { C, Chip, Icon, Media, PersonImage, s } from "./ui";

export function ProfileHero({ person }: { person: Person }) {
  return (
    <View style={styles.hero}>
      <PersonImage person={person} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["transparent", "#241F2499", "#241F24E0"]}
        style={styles.shade}
      />
      <View style={styles.identity}>
        {person.demo && <Text style={styles.demo}>FICTIONAL DEMO PROFILE</Text>}
        <Text style={styles.name}>
          {person.name}, {person.age}
        </Text>
        <View style={s.row}>
          <Icon name="location-outline" color={C.white} size={16} />
          <Text style={styles.location}>{person.city}</Text>
        </View>
      </View>
    </View>
  );
}

export function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[s.h2, { marginBottom: 14 }]}>{title}</Text>
      {children}
    </View>
  );
}

export function ProfileStory({ person }: { person: Person }) {
  const lifestyle = Object.entries(person.lifestyle || {}).filter(
    ([, value]) => value,
  );
  const details = [
    person.profession && {
      icon: "briefcase-outline" as const,
      text: person.profession,
    },
    person.education && {
      icon: "school-outline" as const,
      text: person.education,
    },
    person.languages?.length && {
      icon: "language-outline" as const,
      text: person.languages.join(", "),
    },
  ].filter(Boolean) as {
    icon: React.ComponentProps<typeof Icon>["name"];
    text: string;
  }[];
  return (
    <>
      <ProfileSection title="About me">
        <Text style={[s.body, { color: C.ink }]}>
          {person.bio || "A little more of their story is coming."}
        </Text>
      </ProfileSection>
      <View style={styles.intention}>
        <Icon name="heart-outline" color={C.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.small}>LOOKING FOR</Text>
          <Text style={[s.label, { marginTop: 4 }]}>{person.intent}</Text>
        </View>
      </View>
      {!!person.interests.length && (
        <ProfileSection title="Things I love">
          <View style={s.wrap}>
            {person.interests.map((i) => (
              <Chip key={i} label={i} />
            ))}
          </View>
        </ProfileSection>
      )}
      {!!person.prompt && (
        <View style={styles.prompt}>
          <Icon
            name="chatbubble-ellipses-outline"
            color={C.primary}
            size={24}
          />
          <Text style={[s.small, { marginTop: 16 }]}>
            A CONVERSATION STARTER
          </Text>
          <Text style={styles.promptText}>{person.prompt}</Text>
        </View>
      )}
      {(!!details.length || !!lifestyle.length || !!person.hobbies?.length) && (
        <ProfileSection title="A little more about me">
          {details.map((d) => (
            <View key={d.text} style={styles.detail}>
              <Icon name={d.icon} color={C.muted} size={20} />
              <Text style={[s.body, { flex: 1, color: C.ink }]}>{d.text}</Text>
            </View>
          ))}
          {!!person.hobbies?.length && (
            <View style={styles.detail}>
              <Icon name="sparkles-outline" color={C.muted} size={20} />
              <Text style={[s.body, { flex: 1, color: C.ink }]}>
                {person.hobbies.join(", ")}
              </Text>
            </View>
          )}
          {lifestyle.map(([key, value]) => (
            <View key={key} style={styles.lifestyle}>
              <Text style={[s.body, { textTransform: "capitalize" }]}>
                {key}
              </Text>
              <Text
                style={[s.body, { color: C.ink, flex: 1, textAlign: "right" }]}
              >
                {value}
              </Text>
            </View>
          ))}
        </ProfileSection>
      )}
      {!!person.media?.some((m) => m.id !== person.avatar_id) && (
        <ProfileSection title="More of my world">
          {person.media
            .filter((m) => m.id !== person.avatar_id)
            .map((m) => (
              <Media key={m.id} id={m.id} kind={m.kind} />
            ))}
        </ProfileSection>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 430,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.peach,
  },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "65%" },
  identity: { position: "absolute", left: 24, right: 24, bottom: 24, gap: 8 },
  name: {
    color: C.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "600",
    letterSpacing: -1,
  },
  location: { color: C.white, fontSize: 15 },
  demo: {
    color: "#FFFFFFCC",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  section: { paddingVertical: 24 },
  intention: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    backgroundColor: C.blush,
    padding: 20,
    borderRadius: 18,
  },
  prompt: {
    backgroundColor: C.lavender,
    padding: 24,
    borderRadius: 18,
    marginTop: 8,
  },
  promptText: {
    color: C.ink,
    fontSize: 23,
    lineHeight: 32,
    fontWeight: "500",
    letterSpacing: -0.4,
    marginTop: 12,
  },
  detail: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    paddingVertical: 10,
  },
  lifestyle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
    borderBottomColor: C.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
