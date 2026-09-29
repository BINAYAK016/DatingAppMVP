import React from "react";
import { Text, View } from "react-native";
import { Button, Empty, Header, Icon, Page, s } from "../components/ui";
import { useStore } from "../lib/store";

export default function Activity() {
  const st = useStore();
  const updates =
    st.data?.notifications.filter((n) => n.kind !== "request") || [];
  return (
    <Page refresh>
      <Header back title="Activity" eyebrow="YOUR CONNECTIONS" />
      {updates.map((n) => (
        <View key={n.id} style={[s.card, s.row]}>
          <Icon name="heart-outline" />
          <Text style={[s.body, { flex: 1 }]}>{n.body}</Text>
          {!n.read && <Text style={s.tag}>NEW</Text>}
        </View>
      ))}
      {!updates.length && (
        <Empty
          title="All caught up"
          body="Updates from your matches will appear here. Likes stay private until you both match."
        />
      )}
      {!!updates.length && (
        <Button
          title="Mark updates as read"
          secondary
          onPress={() =>
            st
              .request("/notifications/read", {})
              .then(st.refresh)
              .catch((e) => st.toast(e.message))
          }
        />
      )}
    </Page>
  );
}
