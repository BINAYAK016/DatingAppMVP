import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
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
  Avatar,
  BottomSheet,
  Button,
  C,
  Chip,
  Field,
  Header,
  Icon,
  IconButton,
  Loading,
  Page,
  s,
  humanMessage,
} from "../../components/ui";
type SettingsSection = "privacy" | "discovery" | "notifications" | "account";
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
  const [resetOpen, setResetOpen] = useState(false),
    [resetting, setResetting] = useState(false),
    [resetError, setResetError] = useState("");
  const resetInFlight = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("privacy");
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
              onPress={() => {
                setSettingsSection("privacy");
                setSettingsOpen(true);
              }}
            />
          }
        />
        <View style={styles.summary}>
          <Avatar person={me} size={76} />
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <Text style={s.h2}>
              {me.name}, {me.age}
            </Text>
            <View style={[s.row, { gap: 4 }]}>
              <Icon name="location-outline" size={14} color={C.muted} />
              <Text style={s.small}>{me.city}</Text>
            </View>
            {me.demo && (
              <Text style={[s.meta, { color: C.primary }]}>
                Fictional demo profile
              </Text>
            )}
          </View>
        </View>
        <View style={[s.row, { marginBottom: 16 }]}>
          <View style={{ flex: 1 }}>
            <Button
              title="Edit profile"
              compact
              icon="create-outline"
              onPress={() => router.push("/edit-profile")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Preview profile"
              compact
              secondary
              icon="eye-outline"
              onPress={() => router.push(`/profile/${me.id}`)}
            />
          </View>
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
        <View style={s.card}>
          <Text style={[s.meta, { marginBottom: 8 }]}>
            YOUR PROFILE AT A GLANCE
          </Text>
          <View style={[s.row, { marginBottom: 10 }]}>
            <Icon name="heart-outline" size={18} color={C.primary} />
            <Text style={[s.label, { flex: 1 }]}>{me.intent}</Text>
          </View>
          {!!me.bio && (
            <Text numberOfLines={3} style={[s.small, { color: C.ink }]}>
              {me.bio}
            </Text>
          )}
          {!!me.interests.length && (
            <View style={[s.wrap, { marginTop: 12 }]}>
              {me.interests.slice(0, 4).map((interest) => (
                <Chip key={interest} label={interest} />
              ))}
            </View>
          )}
        </View>
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
        <View style={styles.moments}>
          {(
            [
              ["privacy", "Privacy & safety", "shield-checkmark-outline"],
              ["discovery", "Discovery & data", "options-outline"],
              ["notifications", "Notifications", "notifications-outline"],
              ["account", "Account", "person-outline"],
            ] as const
          ).map(([section, label, icon]) => (
            <Pressable
              key={section}
              accessibilityRole="button"
              accessibilityLabel={`Open ${section} settings`}
              style={styles.momentLink}
              onPress={() => {
                setSettingsSection(section);
                setSettingsOpen(true);
              }}
            >
              <Icon name={icon} size={20} color={C.primary} />
              <Text style={[s.label, { flex: 1 }]}>{label}</Text>
              <Icon name="chevron-forward" size={16} color={C.muted} />
            </Pressable>
          ))}
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
        {st.demoMode && me.demo && (
          <View style={styles.demoTools}>
            <View style={s.row}>
              <Icon name="flask-outline" color={C.primary} size={18} />
              <Text style={s.label}>Demo tools</Text>
            </View>
            <Text style={[s.small, { marginVertical: 10 }]}>
              Fictional, shared accounts. Use made-up messages and profile
              details.
            </Text>
            <Button
              title="Use my own account"
              compact
              secondary
              onPress={() =>
                router.push({ pathname: "/demo", params: { account: "1" } })
              }
            />
            <View style={{ marginTop: 8 }}>
              <Button
                title="Switch Demo User"
                compact
                secondary
                icon="people-outline"
                onPress={() => router.push("/demo")}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset Demo"
              onPress={() => {
                setResetError("");
                setResetOpen(true);
              }}
              style={{
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <Text style={s.link}>Reset Demo</Text>
            </Pressable>
          </View>
        )}
      </Page>
      <BottomSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={
          settingsSection === "privacy"
            ? "Privacy & safety"
            : settingsSection === "discovery"
              ? "Discovery & data"
              : settingsSection === "notifications"
                ? "Notifications"
                : "Account"
        }
      >
        <Text style={[s.body, { marginBottom: 24 }]}>
          Choose what feels right for you.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
        >
          {(
            [
              ["privacy", "Privacy"],
              ["discovery", "Discovery"],
              ["notifications", "Notifications"],
              ["account", "Account"],
            ] as const
          ).map(([section, label]) => (
            <Chip
              key={section}
              label={label}
              selected={settingsSection === section}
              onPress={() => setSettingsSection(section)}
            />
          ))}
        </ScrollView>
        {settingsSection === "privacy" && (
          <Text style={[s.label, { marginBottom: 12 }]}>Your space</Text>
        )}
        {(
          [
            ["posts_visible", "Share posts with matches"],
            ["stories_visible", "Share stories with matches"],
            ["messages_enabled", "Receive new messages and snaps"],
            ["interactions_enabled", "Allow comments and reactions"],
            ["data_saver", "Data saver · tap to play feed videos"],
          ] as const
        )
          .filter(([key]) =>
            settingsSection === "privacy"
              ? key !== "data_saver"
              : settingsSection === "discovery" && key === "data_saver",
          )
          .map(([key, label]) => (
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
                {...(Platform.OS === "web"
                  ? { activeThumbColor: C.white }
                  : {})}
                thumbColor={C.white}
                accessibilityLabel={label}
                value={pendingSettings[key] ?? me[key]}
                disabled={pendingSettings[key] !== undefined}
                trackColor={{ false: C.line, true: C.primary }}
                onValueChange={(value) => void settings(key, value)}
              />
            </View>
          ))}
        {settingsSection === "discovery" && (
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
        )}
        {settingsSection === "notifications" && (
          <>
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
                {...(Platform.OS === "web"
                  ? { activeThumbColor: C.white }
                  : {})}
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
          </>
        )}
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
        )
          .filter((item) =>
            settingsSection === "account"
              ? item.title !== "Privacy & safety"
              : settingsSection === "privacy" &&
                item.title === "Privacy & safety",
          )
          .map((item) => (
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
        {settingsSection === "account" && (
          <>
            <View style={{ marginTop: 16 }}>
              <Button
                title={st.demoMode && me.demo ? "Switch Demo User" : "Sign out"}
                secondary
                onPress={() => {
                  if (st.demoMode && me.demo)
                    return closeThen(() => router.push("/demo"));
                  void st
                    .signOut()
                    .then(() => {
                      setSettingsOpen(false);
                      router.replace("/welcome");
                    })
                    .catch((e) => st.toast(e.message));
                }}
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
                  Your profile, messages, matches and media will be removed from
                  the live beta server. This cannot be undone. Type DELETE to
                  confirm.
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
          </>
        )}
      </BottomSheet>
      <BottomSheet
        visible={resetOpen && !!st.demoMode && me.demo}
        onClose={() => {
          if (!resetInFlight.current) setResetOpen(false);
        }}
        title="Reset demo data?"
      >
        <Text style={[s.body, { marginBottom: 16 }]}>
          This restores all 30 fictional profiles, matches, chats, stories,
          games, dates and Sangai feed activity to the predefined beta world.
        </Text>
        <Text style={[s.body, { marginBottom: 24 }]}>
          Changes made by every demo user will be replaced. This affects
          everyone testing this demo server.
        </Text>
        {!!resetError && (
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: C.red, marginBottom: 16 }]}
          >
            {resetError}
          </Text>
        )}
        <Button
          title={resetting ? "Resetting demo…" : "Reset all demo data"}
          disabled={resetting}
          onPress={async () => {
            if (resetInFlight.current) return;
            resetInFlight.current = true;
            setResetting(true);
            setResetError("");
            try {
              await st.resetDemo();
              if (mounted.current) {
                setResetOpen(false);
                router.replace("/(tabs)");
              }
            } catch (error: any) {
              if (mounted.current && error.name !== "SessionChangedError")
                setResetError(humanMessage(error.message));
            } finally {
              resetInFlight.current = false;
              if (mounted.current) setResetting(false);
            }
          }}
        />
        <View style={{ height: 12 }} />
        <Button
          title="Keep current demo"
          secondary
          disabled={resetting}
          onPress={() => setResetOpen(false)}
        />
      </BottomSheet>
    </>
  );
}
const styles = StyleSheet.create({
  summary: {
    backgroundColor: C.blush,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  demoTools: {
    backgroundColor: C.lavender,
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },
  accountStatus: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 16,
  },
  moments: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  momentLink: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  plus: { backgroundColor: C.peach, padding: 16, borderRadius: 18 },
  setting: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    minHeight: 62,
    paddingVertical: 10,
  },
});
