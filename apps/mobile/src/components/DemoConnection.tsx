import React, { useState } from "react";
import { Text, View } from "react-native";
import { useStore } from "../lib/store";
import { connectionSettingsEnabled } from "../lib/connection";
import { BottomSheet, Button, Field, Header, Icon, Page, s, C } from "./ui";

export function DemoConnectionSettings({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return visible && connectionSettingsEnabled ? (
    <ConnectionForm onClose={onClose} />
  ) : null;
}

function ConnectionForm({ onClose }: { onClose: () => void }) {
  const st = useStore();
  const [server, setServer] = useState(st.url);
  return (
    <BottomSheet visible onClose={onClose} title="Connection settings">
      <Text style={[s.body, { marginBottom: 20 }]}>
        Connect this beta to your running Sangai server.
      </Text>
      <Field label="Backend URL" value={server} onChangeText={setServer} />
      <Button
        title="Save & reconnect"
        onPress={() => {
          st.setUrl(server);
          onClose();
        }}
      />
      <Text style={[s.small, { marginTop: 20 }]}>
        Android emulator: http://10.0.2.2:4100{"\n"}iOS Simulator:
        http://localhost:4100
      </Text>
    </BottomSheet>
  );
}

export function DemoConfigRecovery() {
  const st = useStore();
  const [settings, setSettings] = useState(false);
  return (
    <>
      <Page>
        <Header title="Sangai Beta" action={<View />} />
        <View style={{ paddingVertical: 32, gap: 16, alignItems: "center" }}>
          <Icon name="cloud-offline-outline" color={C.primary} size={40} />
          <Text style={[s.h2, { textAlign: "center" }]}>
            {st.demoConfigError ? "Let’s reconnect" : "Opening Sangai"}
          </Text>
          <Text style={[s.body, { textAlign: "center" }]}>
            {st.demoConfigError
              ? "We couldn’t reach the beta server. Check the connection and try again."
              : "Checking which experience is available on this server."}
          </Text>
        </View>
        <Button
          title="Retry"
          disabled={!st.demoConfigError}
          onPress={() => void st.loadDemoConfig()}
        />
        <View style={{ height: 12 }} />
        {connectionSettingsEnabled && (
          <Button
            title="Connection settings"
            secondary
            onPress={() => setSettings(true)}
          />
        )}
      </Page>
      <DemoConnectionSettings
        visible={settings}
        onClose={() => setSettings(false)}
      />
    </>
  );
}
