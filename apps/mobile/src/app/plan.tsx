import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../lib/store";
import { Button, Chip, Field, Header, Icon, Page, s } from "../components/ui";
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
  return (
    <Page>
      <Header back title="Plan a Date" eyebrow="AN INVITATION TOGETHER" />
      <View style={[s.wrap, { marginBottom: 20 }]}>
        {[
          "Coffee",
          "Dinner",
          "Movie",
          "Walk",
          "Hiking",
          "Activity",
          "Something else",
        ].map((kind) => (
          <Chip
            key={kind}
            label={kind}
            selected={title === kind}
            onPress={() => setTitle(kind)}
          />
        ))}
      </View>
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
      <Text style={[s.small, { marginBottom: 16 }]}>
        Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}. Your match
        sees the invitation in their local time.
      </Text>
      <View style={s.note}>
        <View style={s.row}>
          <Icon name="shield-checkmark-outline" />
          <Text style={s.label}>A little care goes a long way.</Text>
        </View>
        <Text style={[s.body, { marginTop: 12 }]}>
          Choose a public place. Arrange your own transport. Let someone you
          trust know your plans. We never share live location.
        </Text>
      </View>
      <Button
        title={busy ? "Sending…" : "Send date invitation"}
        disabled={busy || !title || !date || !time || !target}
        onPress={async () => {
          setBusy(true);
          try {
            if (
              !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
            )
              throw new Error(
                "Use YYYY-MM-DD for the date and HH:MM for time.",
              );
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
        }}
      />
      <Text style={[s.small, { marginTop: 17 }]}>
        A suggestion becomes a shared plan only when your match accepts.
      </Text>
    </Page>
  );
}
