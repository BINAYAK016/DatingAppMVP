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
export default function Profile() {
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
      <Header title="Profile" eyebrow="YOUR SPACE. YOUR PACE." />
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
            icon="images-outline"
            onPress={() =>
              router.push({ pathname: "/compose", params: { kind: "avatar" } })
            }
          />
        </View>
      </View>
      <View style={[s.card, s.row, { justifyContent: "space-between" }]}>
        <View>
          <Text style={s.h2}>{st.data.matches.length}</Text>
          <Text style={s.small}>connections</Text>
        </View>
        <Button
          title="My moments"
          secondary
          onPress={() => router.push("/my-posts")}
        />
      </View>
      <View style={s.card}>
        <Text style={s.h2}>The details that make you, you</Text>
        <Text style={[s.body, { marginTop: 12 }]}>
          {me.languages?.length
            ? `Languages: ${me.languages.join(", ")}`
            : "Languages not added"}
        </Text>
        {!!me.hobbies?.length && (
          <Text style={s.body}>Hobbies: {me.hobbies.join(", ")}</Text>
        )}
        {!!me.profession && <Text style={s.body}>{me.profession}</Text>}
        {!!me.education && <Text style={s.body}>{me.education}</Text>}
        {Object.entries(me.lifestyle || {})
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <Text key={key} style={s.body}>
              {key}: {value}
            </Text>
          ))}
        <Text style={[s.small, { marginTop: 12 }]}>
          {me.demo
            ? "Fictional demo account"
            : me.email_verified_at
              ? "Email verified · identity not verified"
              : "Email verification required"}
        </Text>
      </View>
      <View style={s.card}>
        <Text style={s.label}>ABOUT YOU</Text>
        <Text style={[s.body, { marginTop: 10 }]}>
          {me.bio || "Tell your matches a little about yourself."}
        </Text>
        <Text style={[s.body, { marginTop: 12 }]}>{me.intent}</Text>
        <Text style={[s.body, { marginTop: 12 }]}>
          {me.interests.join(" · ")}
        </Text>
        {!!me.prompt && (
          <Text style={[s.body, { marginTop: 12 }]}>{me.prompt}</Text>
        )}
      </View>
      <View style={[s.card, { backgroundColor: C.blush }]}>
        <Text style={s.h2}>A little more with Plus</Text>
        <Text style={[s.body, { marginVertical: 12 }]}>
          Explore our plans and proposed pricing. Your beta access stays free.
        </Text>
        <Button
          title="Explore Sangai plans"
          onPress={() => router.push("/subscriptions")}
        />
      </View>
      <Section title="Privacy & settings" />
      <View style={s.card}>
        {(
          [
            ["posts_visible", "Share posts with matches"],
            ["stories_visible", "Share stories with matches"],
            ["messages_enabled", "Receive new messages and snaps"],
            ["interactions_enabled", "Allow comments and reactions"],
            ["data_saver", "Data saver · tap to play feed videos"],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={[s.row, { marginVertical: 10 }]}>
            <Text style={[s.body, { flex: 1 }]}>{label}</Text>
            <Switch
              accessibilityLabel={label}
              value={me[key]}
              trackColor={{ true: C.primary }}
              onValueChange={(value) => void settings({ [key]: value })}
            />
          </View>
        ))}
      </View>
      <View style={{ marginBottom: 20 }}>
        <Button
          title="Saved moments"
          secondary
          onPress={() => router.push("/saved-posts")}
        />
      </View>
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
            trackColor={{ true: C.primary }}
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
            trackColor={{ true: C.primary }}
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
