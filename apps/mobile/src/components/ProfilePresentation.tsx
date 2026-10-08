import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Person } from "../lib/types";
import { C, Chip, Icon, Media, PersonImage, s, T } from "./ui";

export function ProfileHero({ person }: { person: Person }) {
  return (
    <View style={styles.hero}>
      <View style={styles.photo}>
        <PersonImage person={person} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.identity}>
        {person.demo && <Text style={styles.demo}>FICTIONAL DEMO PROFILE</Text>}
        <Text accessibilityRole="header" style={styles.name}>
          {person.name}, {person.age}
        </Text>
        <View style={s.row}>
          <Icon name="location-outline" color={C.muted} size={15} />
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
      <Text accessibilityRole="header" style={[s.h2, { marginBottom: 14 }]}>
        {title}
      </Text>
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
          <Text style={[s.meta, { color: C.textOnTint }]}>LOOKING FOR</Text>
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
          <Text style={[s.meta, { marginTop: 16, color: C.textOnTint }]}>
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
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 16,
  },
  photo: { aspectRatio: 1.05, maxHeight: 460, backgroundColor: C.peach },
  identity: { padding: 20, gap: 8 },
  name: {
    color: C.ink,
    fontFamily: T.font.editorial,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "400",
    letterSpacing: -0.5,
  },
  location: { color: C.muted, fontSize: 14 },
  demo: { color: C.primary, fontSize: 10, letterSpacing: 1, fontWeight: "600" },
  section: {
    padding: 20,
    marginBottom: 16,
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
  },
  intention: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    backgroundColor: C.blush,
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
  },
  prompt: {
    backgroundColor: C.lavender,
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
  },
  promptText: {
    color: C.ink,
    fontFamily: T.font.editorial,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "400",
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
