import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, C, Empty, Header, Icon, Page, s } from "../components/ui";
import { useStore } from "../lib/store";

export default function Activity() {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const updates =
    st.data?.notifications.filter((n) => n.kind !== "request") || [];
  return (
    <Page refresh>
      <Header back title="Activity" eyebrow="YOUR CONNECTIONS" />
      {updates.map((n) => (
        <View
          key={n.id}
          style={[
            s.row,
            {
              alignItems: "flex-start",
              gap: 16,
              paddingVertical: 20,
              borderBottomWidth: 1,
              borderBottomColor: C.line,
            },
          ]}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              backgroundColor: n.read ? C.lavender : C.blush,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="heart-outline" color={C.primary} size={22} />
          </View>
          <Text style={[s.body, { flex: 1, color: C.ink }]}>{n.body}</Text>
          {!n.read && (
            <View
              accessibilityLabel="Unread update"
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: C.primary,
                marginTop: 8,
              }}
            />
          )}
        </View>
      ))}
      {!updates.length && (
        <Empty
          title="All caught up"
          body="Updates from your matches will appear here. Likes stay private until you both match."
        />
      )}
      {updates.some((n) => !n.read) && (
        <View style={{ marginTop: 24 }}>
          <Button
            title={busy ? "Marking as read…" : "Mark updates as read"}
            secondary
            disabled={busy}
            onPress={async () => {
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              try {
                await st.request("/notifications/read", {});
                await st.refresh();
              } catch (e: any) {
                st.toast(e.message);
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          />
        </View>
      )}
    </Page>
  );
}
