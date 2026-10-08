import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../lib/store";
import {
  BottomSheet,
  Button,
  C,
  Empty,
  Field,
  Header,
  Icon,
  Page,
  Skeleton,
  T,
  s,
} from "../components/ui";
export default function Safety() {
  const {
    target,
    context = "profile",
    gameId,
  } = useLocalSearchParams<{
    target?: string;
    context?: string;
    gameId?: string;
  }>();
  const st = useStore();
  const { request, toast } = st;
  const [reason, setReason] = useState(""),
    [blocks, setBlocks] = useState<any[]>([]),
    [reports, setReports] = useState<any[]>([]),
    [confirm, setConfirm] = useState("");
  const [reportOpen, setReportOpen] = useState(false),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setBlocks(await request("/blocks"));
      setReports(await request("/reports"));
      setFailed(false);
    } catch (e: any) {
      toast(e.message);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [request, toast]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await st.refresh();
      await load();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const actions = [
    {
      title: "Submit a private report",
      body: "Tell us when something doesn’t feel right.",
      icon: "flag-outline",
      onPress: () => setReportOpen(true),
    },
    {
      title: "Block this person",
      body: "Stop contact and remove shared social access.",
      icon: "hand-left-outline",
      onPress: () => setConfirm("block"),
    },
    {
      title: "End this match",
      body: "Close your chat and shared social access.",
      icon: "heart-dislike-outline",
      onPress: () => setConfirm("unmatch"),
    },
  ] as const;
  return (
    <>
      <Page>
        <Header
          back
          title="Privacy & safety"
          eyebrow="ON YOUR TERMS"
          action={<View />}
        />
        <View style={styles.intro}>
          <Icon name="shield-checkmark-outline" size={38} color={C.primary} />
          <Text accessibilityRole="header" style={styles.headline}>
            Your comfort matters.
          </Text>
          <Text style={[s.body, { marginTop: 12 }]}>
            You never owe anyone a conversation. Your reports are private.
          </Text>
        </View>
        {target && target !== st.data?.me.id && (
          <View style={{ marginBottom: 28 }}>
            {actions.map((a) => (
              <Pressable
                key={a.title}
                accessibilityRole="button"
                accessibilityLabel={a.title}
                onPress={a.onPress}
                style={styles.action}
              >
                <Icon name={a.icon} size={24} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{a.title}</Text>
                  <Text style={[s.small, { marginTop: 4 }]}>{a.body}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={C.muted} />
              </Pressable>
            ))}
          </View>
        )}
        {loading ? (
          <View style={{ gap: 16 }}>
            <Skeleton height={28} width="50%" />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : failed ? (
          <>
            <Empty
              icon="cloud-offline-outline"
              title="Let’s try that again"
              body="We couldn’t load your safety settings."
            />
            <Button
              title="Retry safety settings"
              secondary
              onPress={() => void load()}
            />
          </>
        ) : (
          <>
            <Text style={[s.h2, { marginBottom: 12 }]}>My reports</Text>
            {reports.length ? (
              reports.map((r) => (
                <View key={r.id} style={styles.report}>
                  <Text style={[s.small, { color: C.brandTextOnTint }]}>
                    {r.state.toUpperCase()}
                  </Text>
                  <Text style={[s.body, { marginTop: 8, color: C.ink }]}>
                    {r.reason}
                  </Text>
                  {r.resolution && (
                    <Text style={[s.body, { marginTop: 12 }]}>
                      Resolution: {r.resolution}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={[s.body, { marginBottom: 28 }]}>
                You haven’t submitted any reports.
              </Text>
            )}
            <Text style={[s.h2, { marginTop: 12, marginBottom: 12 }]}>
              Blocked accounts
            </Text>
            {blocks.length ? (
              blocks.map((b) => (
                <View key={b.id} style={styles.block}>
                  <Text style={[s.label, { marginBottom: 16 }]}>{b.name}</Text>
                  <Button
                    title="Unblock · does not restore the match"
                    secondary
                    disabled={busy}
                    onPress={() =>
                      void act(() => request(`/block/${b.id}`, {}, "DELETE"))
                    }
                  />
                </View>
              ))
            ) : (
              <Text style={s.body}>No blocked accounts.</Text>
            )}
          </>
        )}
        <View style={styles.meeting}>
          <Icon name="cafe-outline" color={C.primary} size={24} />
          <Text style={[s.h2, { marginTop: 16 }]}>Before you meet</Text>
          <Text style={[s.body, { marginTop: 12 }]}>
            Choose a public place, arrange your own transport and tell someone
            you trust. Never send money to someone you haven’t met.
          </Text>
          <Text style={[s.small, { marginTop: 16 }]}>
            The beta operator reviews reports. Sangai is not an emergency
            service.
          </Text>
        </View>
      </Page>
      <BottomSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Something didn’t feel right?"
      >
        <Text style={[s.body, { marginBottom: 24 }]}>
          Tell us what happened. The person you report won’t see who submitted
          it.
        </Text>
        <Field
          label="Tell us what happened"
          value={reason}
          onChangeText={setReason}
          multiline
          placeholder="Harassment, impersonation, scam, underage user, or another concern…"
        />
        <Button
          title={busy ? "Submitting…" : "Submit a private report"}
          loading={busy}
          disabled={busy || !reason.trim()}
          onPress={() =>
            void act(async () => {
              await request("/reports", {
                target,
                reason,
                context,
                ...(gameId ? { gameId } : {}),
              });
              setReason("");
              setReportOpen(false);
              toast("Report received. You can track it below.");
            })
          }
        />
      </BottomSheet>
      <BottomSheet
        visible={!!confirm}
        onClose={() => setConfirm("")}
        title={confirm === "block" ? "Block this person?" : "End this match?"}
      >
        <Text style={[s.body, { marginBottom: 24 }]}>
          {confirm === "block"
            ? "You’ll lose contact and shared social access. Active games will close."
            : "Your chat and shared social access will close. Ended matches don’t automatically return."}
        </Text>
        <Button
          title={confirm === "block" ? "Yes, block" : "Yes, end match"}
          disabled={busy}
          onPress={() =>
            void act(async () => {
              await request(`/${confirm}/${target}`, {});
              setConfirm("");
              toast("Your choice has been saved.");
              router.replace("/(tabs)");
            })
          }
        />
        <View style={{ marginTop: 12 }}>
          <Button
            title="Keep things as they are"
            secondary
            onPress={() => setConfirm("")}
          />
        </View>
      </BottomSheet>
    </>
  );
}
const styles = StyleSheet.create({
  intro: {
    marginBottom: 28,
    padding: 24,
    backgroundColor: C.peach,
    borderRadius: T.radius.card,
  },
  headline: {
    ...T.type.title,
    marginTop: 20,
  },
  action: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    minHeight: 84,
    padding: 18,
    marginBottom: 10,
    backgroundColor: C.white,
    borderRadius: T.radius.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  report: {
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    backgroundColor: C.white,
    marginBottom: 12,
  },
  block: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  meeting: {
    backgroundColor: C.lavender,
    padding: 24,
    borderRadius: T.radius.card,
    marginTop: 32,
  },
});
