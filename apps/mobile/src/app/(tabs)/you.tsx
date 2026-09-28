import React, { useState } from "react";
import { View, Text, Pressable, Switch, Linking, Share } from "react-native";
import { router } from "expo-router";
import { useStore } from "../../lib/store";
import { enableDeviceNotifications } from "../../lib/notifications";
import {
  Avatar,
  Button,
  C,
  Field,
  Header,
  Icon,
  Page,
  Section,
  s,
} from "../../components/ui";
export default function You() {
  const st = useStore();
  const [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false);
  if (!st.data) return null;
  const me = st.data.me;
  const settings = async (body: unknown) => {
    try {
      await st.request("/settings", body, "PATCH");
      await st.refresh();
    } catch (e: any) {
      st.toast(e.message);
    }
  };
  return (
    <Page refresh>
      <Header title="Simply, you." eyebrow="YOUR SPACE. YOUR PACE." />
      <View style={[s.card, { alignItems: "center", paddingVertical: 28 }]}>
        <Avatar person={me} size={96} />
        <Text style={[s.title, { fontSize: 30, marginTop: 15 }]}>
          {me.name}, {me.age}
        </Text>
        <Text style={s.body}>
          {me.city} {me.demo ? "· Demo account" : ""}
        </Text>
        <View style={[s.row, { marginTop: 20 }]}>
          <Button
            title="Edit profile"
            secondary
            icon="create-outline"
            onPress={() => router.push("/edit-profile")}
          />
          <Button
            title="Photo"
            secondary
            icon="camera-outline"
            onPress={() =>
              router.push({ pathname: "/compose", params: { kind: "avatar" } })
            }
          />
        </View>
      </View>
      <View style={[s.card, s.row, { justifyContent: "space-around" }]}>
        {[
          [String(st.data.matches.length), "connections"],
          [String(st.data.circles.length), "circles"],
          [
            String(st.data.feed.filter((p) => p.author.id === me.id).length),
            "moments",
          ],
        ].map(([value, label]) => (
          <View key={label} style={{ alignItems: "center" }}>
            <Text style={s.h2}>{value}</Text>
            <Text style={s.small}>{label}</Text>
          </View>
        ))}
      </View>
      <Section title="Your comfort comes first" />
      <View style={s.card}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Pause discovery</Text>
            <Text style={s.small}>
              A breather, or a good beginning. Existing chats stay.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Pause discovery"
            value={me.paused}
            trackColor={{ true: C.green }}
            onValueChange={(paused) => void settings({ paused })}
          />
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Notification preference</Text>
            <Text style={s.small}>
              Generic updates only. Your inbox is always here.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Notifications"
            value={me.notifications}
            trackColor={{ true: C.green }}
            onValueChange={(notifications) => void settings({ notifications })}
          />
        </View>
        <View style={{ marginTop: 18 }}>
          <Button
            title="Enable push on this device"
            secondary
            onPress={async () => {
              try {
                const token = await enableDeviceNotifications();
                await st.request("/device", { token });
                st.toast("Device registered for notifications.");
              } catch (e: any) {
                st.toast(e.message);
              }
            }}
          />
        </View>
      </View>
      {(
        [
          {
            title: "Privacy & safety",
            icon: "shield-checkmark-outline",
            action: () => router.push("/safety"),
          },
          {
            title: "Beta terms & data policy",
            icon: "document-text-outline",
            action: () => void Linking.openURL(st.url + "/policies"),
          },
          {
            title: "Export my data",
            icon: "download-outline",
            action: async () => {
              try {
                const exported = await st.request("/export");
                await Share.share({
                  title: "My Sangai data",
                  message: JSON.stringify(exported, null, 2),
                });
              } catch (e: any) {
                st.toast(e.message);
              }
            },
          },
        ] as const
      ).map((item) => (
        <Pressable
          key={item.title}
          onPress={item.action}
          style={[s.card, s.row, { paddingVertical: 18 }]}
        >
          <Icon name={item.icon} />
          <Text style={[s.label, { flex: 1 }]}>{item.title}</Text>
          <Icon name="chevron-forward" size={16} />
        </Pressable>
      ))}
      <View style={s.note}>
        <Text style={s.label}>A relationship is a good reason to leave.</Text>
        <Text style={[s.body, { marginTop: 7 }]}>
          Pause whenever you want. No streaks to lose. No pressure to keep
          scrolling.
        </Text>
      </View>
      <Button
        title={me.demo ? "Switch demo account / sign out" : "Sign out"}
        secondary
        onPress={() =>
          st
            .signOut()
            .then(() => router.replace("/"))
            .catch((e) => st.toast(e.message))
        }
      />
      <Pressable
        style={{ padding: 20, alignItems: "center" }}
        onPress={() => setDeleting(!deleting)}
      >
        <Text style={[s.small, s.danger]}>Delete my account</Text>
      </Pressable>
      {deleting && (
        <View style={s.card}>
          <Text style={[s.body, { marginBottom: 14 }]}>
            This removes your profile, messages, matches and uploaded media from
            the live beta server. This cannot be undone. Type DELETE to confirm.
          </Text>
          <Field
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="DELETE"
          />
          <Button
            title={busy ? "Deleting…" : "Permanently delete account"}
            disabled={confirmation !== "DELETE" || busy}
            onPress={async () => {
              setBusy(true);
              try {
                await st.request(
                  "/account",
                  { confirm: confirmation },
                  "DELETE",
                );
                await st.signOut();
                router.replace("/");
              } catch (e: any) {
                st.toast(e.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      )}
      <Text style={[s.small, { textAlign: "center", marginTop: 20 }]}>
        Sangai · Android + iOS private beta · No AI{"\n"}Sample accounts are
        fictional. No identity verification claim.
      </Text>
    </Page>
  );
}
