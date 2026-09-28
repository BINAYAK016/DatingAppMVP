import React, { useState } from "react";
import { Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { Avatar, Button, Field, Header, Page, s } from "../components/ui";
export default function NewCircle() {
  const st = useStore();
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [members, setMembers] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  return (
    <Page>
      <Header back title="Make a little circle." />
      <Field
        label="Circle name"
        value={name}
        onChangeText={setName}
        placeholder="The coffee people"
      />
      <Field
        label="What brings you together?"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Text style={[s.h2, { marginBottom: 12 }]}>Choose your people</Text>
      <Text style={[s.body, { marginBottom: 18 }]}>
        Everyone you select must also be mutually matched with each other. The
        server checks before creating your circle.
      </Text>
      {st.data?.matches.map((p) => (
        <Pressable
          key={p.id}
          onPress={() =>
            setMembers(
              members.includes(p.id)
                ? members.filter((m) => m !== p.id)
                : [...members, p.id],
            )
          }
          style={[s.card, s.row]}
        >
          <Avatar person={p} />
          <Text style={[s.label, { flex: 1 }]}>{p.name}</Text>
          <Text style={{ fontSize: 24 }}>
            {members.includes(p.id) ? "☑" : "☐"}
          </Text>
        </Pressable>
      ))}
      <Button
        title={busy ? "Creating…" : "Create our circle"}
        disabled={busy || !name.trim() || !members.length}
        onPress={async () => {
          setBusy(true);
          try {
            const c = await st.request("/circles", {
              name,
              description,
              members,
            });
            await st.refresh();
            router.replace(`/circle/${c.id}`);
          } catch (e: any) {
            st.toast(e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Page>
  );
}
