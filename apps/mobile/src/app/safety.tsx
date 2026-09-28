import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../lib/store";
import { Button, Field, Header, Page, Section, s } from "../components/ui";
export default function Safety() {
  const { target, context = "profile" } = useLocalSearchParams<{
    target?: string;
    context?: string;
  }>();
  const st = useStore();
  const { request, toast } = st;
  const [reason, setReason] = useState(""),
    [blocks, setBlocks] = useState<any[]>([]),
    [reports, setReports] = useState<any[]>([]),
    [confirm, setConfirm] = useState("");
  const load = useCallback(async () => {
    try {
      setBlocks(await request("/blocks"));
      setReports(await request("/reports"));
    } catch (e: any) {
      toast(e.message);
    }
  }, [request, toast]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await st.refresh();
      await load();
    } catch (e: any) {
      toast(e.message);
    }
  };
  return (
    <Page>
      <Header back title="Your comfort matters." eyebrow="PRIVACY & SAFETY" />
      <View style={s.note}>
        <Text style={s.body}>
          You never owe someone a conversation. Blocking immediately removes
          contact and social access. Your reports are private; the reported
          person cannot see who submitted them.
        </Text>
      </View>
      {target && target !== st.data?.me.id && (
        <>
          <Section title="Something didn’t feel right?" />
          <Field
            label="Tell us what happened"
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="Harassment, impersonation, scam, underage user, or another concern…"
          />
          <Button
            title="Submit a private report"
            disabled={!reason.trim()}
            onPress={() =>
              void act(async () => {
                await request("/reports", { target, reason, context });
                setReason("");
                toast("Report received. You can track it below.");
              })
            }
          />
          <View style={{ height: 16 }} />
          <Button
            title="Block this person"
            secondary
            onPress={() => setConfirm("block")}
          />
          <View style={{ height: 10 }} />
          <Button
            title="End this match"
            secondary
            onPress={() => setConfirm("unmatch")}
          />
          {confirm && (
            <View style={[s.card, { marginTop: 15 }]}>
              <Text style={[s.body, { marginBottom: 15 }]}>
                {confirm === "block"
                  ? "Block this person? You will lose contact, shared social access, and any circle that contains you both will pause."
                  : "End this match? Your chat and shared social access will close. This beta does not automatically restore ended matches."}
              </Text>
              <Button
                title={confirm === "block" ? "Yes, block" : "Yes, end match"}
                onPress={() =>
                  void act(async () => {
                    await request(`/${confirm}/${target}`, {});
                    setConfirm("");
                    toast("Your choice has been saved.");
                    router.replace("/(tabs)");
                  })
                }
              />
              <View style={{ height: 8 }} />
              <Button
                title="Keep things as they are"
                secondary
                onPress={() => setConfirm("")}
              />
            </View>
          )}
        </>
      )}
      <Section title="My reports" />
      {reports.length ? (
        reports.map((r) => (
          <View key={r.id} style={s.card}>
            <Text style={s.label}>{r.state.toUpperCase()}</Text>
            <Text style={s.body}>{r.reason}</Text>
            {r.resolution && (
              <Text style={[s.body, { marginTop: 10 }]}>
                Resolution: {r.resolution}
              </Text>
            )}
          </View>
        ))
      ) : (
        <Text style={s.body}>No reports submitted.</Text>
      )}
      <Section title="Blocked accounts" />
      {blocks.length ? (
        blocks.map((b) => (
          <View key={b.id} style={s.card}>
            <Text style={[s.h2, { marginBottom: 15 }]}>{b.name}</Text>
            <Button
              title="Unblock · does not restore the match"
              secondary
              onPress={() =>
                void act(() => request(`/block/${b.id}`, {}, "DELETE"))
              }
            />
          </View>
        ))
      ) : (
        <Text style={s.body}>No blocked accounts.</Text>
      )}
      <Section title="Before meeting someone" />
      <Text style={s.body}>
        Choose a public place, arrange independent transport, tell a trusted
        person if you wish, and never send money to someone you haven’t met.
        This beta is not an emergency service.
      </Text>
      <Text style={[s.small, { marginTop: 20 }]}>
        The local beta operator reviews reports in the moderator console. Public
        launch requires staffed safety coverage. Do not use this development
        build for emergencies or sensitive personal content.
      </Text>
    </Page>
  );
}
