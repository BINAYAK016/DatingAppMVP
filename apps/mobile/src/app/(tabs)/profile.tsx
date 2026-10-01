import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Switch,
  Linking,
  Share,
  StyleSheet,
  Platform,
} from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { useStore } from "../../lib/store";
import { enableDeviceNotifications } from "../../lib/notifications";
import {
  BottomSheet,
  Button,
  C,
  Field,
  Header,
  Icon,
  IconButton,
  Loading,
  Page,
  s,
} from "../../components/ui";
import {
  ProfileHero,
  ProfileStory,
} from "../../components/ProfilePresentation";
type Setting =
  | "posts_visible"
  | "stories_visible"
  | "messages_enabled"
  | "interactions_enabled"
  | "data_saver"
  | "paused"
  | "notifications";

export default function Profile() {
  const st = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<
    Partial<Record<Setting, boolean>>
  >({});
  const settingsInFlight = useRef(new Set<Setting>());
  const [pushBusy, setPushBusy] = useState(false);
  const pushInFlight = useRef(false);
  const [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false);
  if (!st.data) return <Loading />;
  const me = st.data.me;
  const settings = async (key: Setting, value: boolean) => {
    if (settingsInFlight.current.has(key)) return;
    settingsInFlight.current.add(key);
    setPendingSettings((old) => ({ ...old, [key]: value }));
    try {
      await st.request("/settings", { [key]: value }, "PATCH");
      await st.refresh();
    } catch (e: any) {
      st.toast(e.message);
    } finally {
      settingsInFlight.current.delete(key);
      setPendingSettings((old) => {
        const next = { ...old };
        delete next[key];
        return next;
      });
    }
  };
  const canRegisterPush =
    Platform.OS !== "web" &&
    !!(
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId
    );
  const closeThen = (action: () => void) => {
    setSettingsOpen(false);
    action();
  };
  return (
    <>
      <Page refresh>
        <Header
          title="My profile"
          action={
            <IconButton
              name="settings-outline"
              label="Profile settings"
              onPress={() => setSettingsOpen(true)}
            />
          }
        />
        <ProfileHero person={me} />
        <View style={{ marginTop: 16 }}>
          <Button
            title="Edit profile"
            icon="create-outline"
            secondary
            onPress={() => router.push("/edit-profile")}
          />
        </View>
        {!me.demo && (
          <View style={styles.accountStatus}>
            <Icon
              name={me.demo ? "flask-outline" : "mail-outline"}
              size={16}
              color={C.muted}
            />
            <Text style={[s.small, { flex: 1 }]}>
              {me.demo
                ? "Fictional demo account"
                : me.email_verified_at
                  ? "Email verified · identity verification coming later"
                  : "Email verification required"}
            </Text>
          </View>
        )}
        <ProfileStory person={me} />
        <View style={styles.moments}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/my-posts")}
            style={styles.momentLink}
          >
            <Icon name="images-outline" color={C.primary} />
            <Text style={s.label}>My moments</Text>
            <Icon name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/saved-posts")}
            style={styles.momentLink}
          >
            <Icon name="bookmark-outline" color={C.primary} />
            <Text style={s.label}>Saved moments</Text>
            <Icon name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        </View>
        <View style={styles.plus}>
          <View style={[s.row, { marginBottom: 10 }]}>
            <Icon name="sparkles-outline" color={C.primary} />
            <Text style={s.h2}>A little more with Plus</Text>
          </View>
          <Text style={[s.body, { marginBottom: 20 }]}>
            Explore the possibilities. Your beta access is free.
          </Text>
          <Button
            title="Explore Sangai plans"
            onPress={() => router.push("/subscriptions")}
          />
        </View>
      </Page>
      <BottomSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Privacy & settings"
      >
        <Text style={[s.body, { marginBottom: 24 }]}>
          Choose what feels right for you.
        </Text>
        <Text style={[s.h2, { marginBottom: 12 }]}>Your space</Text>
        {(
          [
            ["posts_visible", "Share posts with matches"],
            ["stories_visible", "Share stories with matches"],
            ["messages_enabled", "Receive new messages and snaps"],
            ["interactions_enabled", "Allow comments and reactions"],
            ["data_saver", "Data saver · tap to play feed videos"],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={styles.setting}>
            <View style={{ flex: 1 }}>
              <Text style={[s.body, { color: C.ink }]}>{label}</Text>
              {pendingSettings[key] !== undefined && (
                <Text accessibilityLiveRegion="polite" style={s.small}>
                  Saving…
                </Text>
              )}
            </View>
            <Switch
              {...(Platform.OS === "web" ? { activeThumbColor: C.white } : {})}
              thumbColor={C.white}
              accessibilityLabel={label}
              value={pendingSettings[key] ?? me[key]}
              disabled={pendingSettings[key] !== undefined}
              trackColor={{ false: C.line, true: C.primary }}
              onValueChange={(value) => void settings(key, value)}
            />
          </View>
        ))}
        <View style={s.divider} />
        <View style={styles.setting}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Pause discovery</Text>
            <Text style={[s.small, { marginTop: 4 }]}>
              {pendingSettings.paused !== undefined
                ? "Saving…"
                : "Take a breather. Existing chats stay."}
            </Text>
          </View>
          <Switch
            {...(Platform.OS === "web" ? { activeThumbColor: C.white } : {})}
            thumbColor={C.white}
            accessibilityLabel="Pause discovery"
            value={pendingSettings.paused ?? me.paused}
            disabled={pendingSettings.paused !== undefined}
            trackColor={{ false: C.line, true: C.primary }}
            onValueChange={(paused) => void settings("paused", paused)}
          />
        </View>
        <View style={styles.setting}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Notification preference</Text>
            <Text style={[s.small, { marginTop: 4 }]}>
              {pendingSettings.notifications !== undefined
                ? "Saving…"
                : "Generic updates only."}
            </Text>
          </View>
          <Switch
            {...(Platform.OS === "web" ? { activeThumbColor: C.white } : {})}
            thumbColor={C.white}
            accessibilityLabel="Notifications"
            value={pendingSettings.notifications ?? me.notifications}
            disabled={pendingSettings.notifications !== undefined}
            trackColor={{ false: C.line, true: C.primary }}
            onValueChange={(notifications) =>
              void settings("notifications", notifications)
            }
          />
        </View>
        <View style={{ marginVertical: 16 }}>
          {canRegisterPush ? (
            <Button
              title={
                pushBusy
                  ? "Enabling notifications…"
                  : "Enable push on this device"
              }
              secondary
              disabled={pushBusy}
              onPress={async () => {
                if (pushInFlight.current) return;
                pushInFlight.current = true;
                setPushBusy(true);
                try {
                  const token = await enableDeviceNotifications();
                  await st.request("/device", { token });
                  st.toast("Device registered for notifications.");
                } catch (e: any) {
                  st.toast(e.message);
                } finally {
                  pushInFlight.current = false;
                  setPushBusy(false);
                }
              }}
            />
          ) : (
            <Text style={s.small}>
              {Platform.OS === "web"
                ? "Device notifications are available in the mobile app when enabled. Your in-app Activity inbox works here."
                : "Device notifications are not enabled in this beta build. Your in-app Activity inbox still works."}
            </Text>
          )}
        </View>
        <View style={s.divider} />
        {(
          [
            {
              title: "Privacy & safety",
              icon: "shield-checkmark-outline",
              action: () => closeThen(() => router.push("/safety")),
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
            accessibilityRole="button"
            key={item.title}
            onPress={item.action}
            style={styles.setting}
          >
            <Icon name={item.icon} size={22} color={C.muted} />
            <Text style={[s.label, { flex: 1 }]}>{item.title}</Text>
            <Icon name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        ))}
        <View style={{ marginTop: 24 }}>
          <Button
            title={me.demo ? "Switch demo account / sign out" : "Sign out"}
            secondary
            onPress={() =>
              st
                .signOut()
                .then(() => {
                  setSettingsOpen(false);
                  router.replace("/welcome");
                })
                .catch((e) => st.toast(e.message))
            }
          />
        </View>
        <Pressable
          accessibilityRole="button"
          style={{
            minHeight: 52,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 12,
          }}
          onPress={() => setDeleting(!deleting)}
        >
          <Text style={[s.small, s.danger]}>Delete my account</Text>
        </Pressable>
        {deleting && (
          <View style={[s.note, { marginTop: 8 }]}>
            <Text style={[s.body, { marginBottom: 16 }]}>
              Your profile, messages, matches and media will be removed from the
              live beta server. This cannot be undone. Type DELETE to confirm.
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
                  setSettingsOpen(false);
                  router.replace("/welcome");
                } catch (e: any) {
                  st.toast(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        )}
      </BottomSheet>
    </>
  );
}
const styles = StyleSheet.create({
  accountStatus: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 16,
  },
  moments: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    marginBottom: 24,
  },
  momentLink: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  plus: { backgroundColor: C.blush, padding: 24, borderRadius: 18 },
  setting: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    minHeight: 62,
    paddingVertical: 10,
  },
});
