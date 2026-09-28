import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../lib/store";
import { Button, Field, Header, Icon, Page, s } from "../components/ui";
export default function Plan() {
  const {
    target,
    circle,
    title: initial,
  } = useLocalSearchParams<{
    target?: string;
    circle?: string;
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
      <Header
        back
        title={circle ? "Bring your circle together." : "Make a little plan."}
        eyebrow={
          circle ? "A PRIVATE CIRCLE EVENT" : "SOMETHING TO LOOK FORWARD TO"
        }
      />
      <Field
        label="The idea"
        value={title}
        onChangeText={setTitle}
        placeholder="Coffee and a slow walk"
      />
      <Field
        label="Public place / venue"
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
        title={
          busy
            ? "Sending…"
            : circle
              ? "Create circle event"
              : "Suggest this date"
        }
        disabled={busy || !title || !venue || !date || !time}
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
            if (
              !Number.isFinite(scheduled.getTime()) ||
              scheduled <= new Date()
            )
              throw new Error("Choose a valid future date.");
            await st.request(
              circle ? `/circles/${circle}/events` : `/plans/${target}`,
              { title, venue, scheduledAt: scheduled.toISOString() },
            );
            st.toast(
              circle
                ? "Your event is ready."
                : "Date idea sent. Your match can accept or decline.",
            );
            router.back();
          } catch (e: any) {
            st.toast(e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Text style={[s.small, { marginTop: 17 }]}>
        {circle
          ? "Only current members of this mutually matched circle can see and RSVP."
          : "A suggestion becomes a shared plan only when your match accepts."}
      </Text>
    </Page>
  );
}
