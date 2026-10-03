import React, { useState } from "react";
import { Text, View } from "react-native";
import { useStore } from "../lib/store";
import { Button, C, Header, Icon, Page, Skeleton, s } from "./ui";
export function AuthRecovery() {
  const st = useStore();
  const [leaving, setLeaving] = useState(false);
  return (
    <Page>
      <Header
        title={st.sessionError ? "Let’s reconnect" : "Opening your account"}
        action={<View />}
      />
      <View style={{ alignItems: "center", paddingVertical: 32, gap: 24 }}>
        <Icon
          name={
            st.sessionError ? "cloud-offline-outline" : "lock-closed-outline"
          }
          size={48}
          color={C.primary}
        />
        <Text style={[s.body, { textAlign: "center" }]}>
          {st.sessionError
            ? "You’re signed in. We couldn’t load your account yet. Check your connection and try again."
            : "We’re safely connecting to your profile."}
        </Text>
        {st.sessionLoading && <Skeleton height={12} width="70%" />}
      </View>
      <Button
        title={st.sessionLoading ? "Connecting…" : "Try again"}
        disabled={st.sessionLoading || leaving}
        onPress={() => void st.refresh()}
      />
      <View style={{ height: 12 }} />
      <Button
        title={leaving ? "Signing out…" : "Sign out"}
        secondary
        disabled={leaving}
        onPress={async () => {
          setLeaving(true);
          try {
            await st.signOut();
          } catch {
            /* The store reports a failed logout and preserves browser sign-in for retry. */
          } finally {
            setLeaving(false);
          }
        }}
      />
    </Page>
  );
}
