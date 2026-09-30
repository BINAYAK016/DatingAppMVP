import React, { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../lib/store";
import {
  Avatar,
  Button,
  C,
  Field,
  Header,
  Icon,
  Page,
  SelectionTile,
  StepProgress,
  s,
} from "../components/ui";
export default function Plan() {
  const { target, title: initial } = useLocalSearchParams<{
    target?: string;
    title?: string;
  }>();
  const st = useStore();
  const [title, setTitle] = useState(initial || ""),
    [venue, setVenue] = useState(""),
    [date, setDate] = useState(""),
    [time, setTime] = useState("17:00"),
    [busy, setBusy] = useState(false);
  const [step, setStep] = useState(initial ? 1 : 0);
  const person = st.data?.matches.find((p) => p.id === target);
  const send = async () => {
    setBusy(true);
    try {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      )
        throw new Error("Use YYYY-MM-DD for the date and HH:MM for time.");
      const scheduled = new Date(`${date}T${time}:00`);
      const [year, month, day] = date.split("-").map(Number);
      if (
        !Number.isFinite(scheduled.getTime()) ||
        scheduled.getFullYear() !== year ||
        scheduled.getMonth() !== month - 1 ||
        scheduled.getDate() !== day ||
        scheduled <= new Date()
      )
        throw new Error("Choose a valid future date.");
      await st.request(`/plans/${target}`, {
        title,
        venue,
        scheduledAt: scheduled.toISOString(),
      });
      st.toast("Date idea sent. Your match can accept or decline.");
      router.back();
    } catch (e: any) {
      st.toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const activities = [
    {
      name: "Coffee",
      icon: "cafe-outline",
      subtitle: "A good conversation, a warm cup.",
    },
    {
      name: "Dinner",
      icon: "restaurant-outline",
      subtitle: "Make an evening of it.",
    },
    {
      name: "Movie",
      icon: "film-outline",
      subtitle: "Share a story on the big screen.",
    },
    {
      name: "Walk",
      icon: "footsteps-outline",
      subtitle: "A little fresh air together.",
    },
    {
      name: "Hiking",
      icon: "trail-sign-outline",
      subtitle: "Take the scenic route.",
    },
    {
      name: "Activity",
      icon: "color-palette-outline",
      subtitle: "Try something you both enjoy.",
    },
    {
      name: "Something else",
      icon: "sparkles-outline",
      subtitle: "Your own idea.",
    },
  ] as const;
  return (
    <Page
      key={step}
      footer={
        <View style={{ gap: 12 }}>
          <Button
            title={
              busy
                ? "Sending…"
                : step === 2
                  ? "Send date invitation"
                  : "Continue"
            }
            disabled={
              busy ||
              !title ||
              (step > 0 && (!date || !time)) ||
              (step === 2 && !target)
            }
            onPress={() => (step === 2 ? void send() : setStep(step + 1))}
          />
          {step > 0 && (
            <Button
              title="Previous step"
              secondary
              disabled={busy}
              onPress={() => setStep(step - 1)}
            />
          )}
        </View>
      }
    >
      <Header back title="Plan a Date" action={<View />} />
      <StepProgress current={step + 1} total={3} />
      {!!person && (
        <View style={styles.with}>
          <Avatar person={person} size={36} />
          <Text style={s.body}>
            An invitation for{" "}
            <Text style={{ color: C.ink, fontWeight: "600" }}>
              {person.name}
            </Text>
          </Text>
        </View>
      )}
      {step === 0 ? (
        <>
          <Text style={[styles.heading, { marginTop: 24 }]}>
            What sounds good?
          </Text>
          <Text style={[s.body, { marginBottom: 24 }]}>
            A small plan can be a great beginning.
          </Text>
          <View style={{ gap: 12 }}>
            {activities.map((kind) => (
              <SelectionTile
                key={kind.name}
                title={kind.name}
                subtitle={kind.subtitle}
                icon={kind.icon}
                selected={title === kind.name}
                onPress={() => setTitle(kind.name)}
              />
            ))}
          </View>
        </>
      ) : step === 1 ? (
        <>
          <Text style={[styles.heading, { marginTop: 24 }]}>
            Make it your own.
          </Text>
          <Text style={[s.body, { marginBottom: 24 }]}>
            Pick a time and a public place.
          </Text>
          <Field
            label="The idea"
            value={title}
            onChangeText={setTitle}
            placeholder="Coffee and a slow walk"
          />
          <Field
            label="Public place / venue · optional"
            value={venue}
            onChangeText={setVenue}
            placeholder="A favorite café or a public park"
          />
          <Field
            label="Date · YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
          />
          <Field
            label="Time · HH:MM · your local time"
            value={time}
            onChangeText={setTime}
          />
          <Text style={s.small}>
            Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}. Your
            match sees the invitation in their local time.
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.heading, { marginTop: 24 }]}>
            A date to look forward to.
          </Text>
          <Text style={[s.body, { marginBottom: 24 }]}>
            Here’s the idea you’re about to share.
          </Text>
          <View style={styles.summary}>
            <Icon
              name={
                activities.find((a) => a.name === title)?.icon ||
                "heart-outline"
              }
              size={36}
              color={C.primary}
            />
            <Text style={[s.h2, { marginTop: 20 }]}>{title}</Text>
            <View style={styles.detail}>
              <Icon name="calendar-outline" size={20} color={C.muted} />
              <Text style={[s.body, { color: C.ink }]}>
                {date} · {time}
              </Text>
            </View>
            {!!venue && (
              <View style={styles.detail}>
                <Icon name="location-outline" size={20} color={C.muted} />
                <Text style={[s.body, { flex: 1, color: C.ink }]}>{venue}</Text>
              </View>
            )}
          </View>
          <Text style={[s.body, { marginTop: 20 }]}>
            Your match can accept or decline. A suggestion becomes a shared plan
            only when they accept.
          </Text>
        </>
      )}
      <View style={styles.safety}>
        <Icon name="shield-checkmark-outline" size={20} color={C.primary} />
        <Text style={[s.small, { flex: 1 }]}>
          Meet in public, arrange your own transport and tell someone you trust.
          Your live location stays private.
        </Text>
      </View>
    </Page>
  );
}
const styles = StyleSheet.create({
  heading: {
    color: C.ink,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "600",
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  with: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 },
  summary: { backgroundColor: C.blush, borderRadius: 18, padding: 24 },
  detail: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginTop: 16,
  },
  safety: {
    flexDirection: "row",
    gap: 12,
    marginTop: 32,
    alignItems: "flex-start",
  },
});
