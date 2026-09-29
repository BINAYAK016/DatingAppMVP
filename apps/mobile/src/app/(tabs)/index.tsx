import React, { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Button,
  C,
  Chip,
  Empty,
  Header,
  Icon,
  Page,
  s,
} from "../../components/ui";
import { CITIES } from "../../lib/types";
import { useStore } from "../../lib/store";
export default function Discover() {
  const st = useStore();
  const [city, setCity] = useState("All cities"),
    [index, setIndex] = useState(0);
  if (!st.data) return null;
  const people = st.data.discover.filter(
    (p) => city === "All cities" || p.city === city,
  );
  const p = people[index % Math.max(people.length, 1)];
  return (
    <Page refresh>
      <Header title="Discover" eyebrow="GOOD CONNECTIONS START HERE" />
      <Text style={[s.body, { marginBottom: 20 }]}>
        Meet the person behind the profile. Your moments stay private until you
        both match.
      </Text>
      <View style={[s.wrap, { marginBottom: 20 }]}>
        {["All cities", ...CITIES].map((c) => (
          <Chip
            key={c}
            label={c}
            selected={city === c}
            onPress={() => {
              setCity(c);
              setIndex(0);
            }}
          />
        ))}
      </View>
      {p ? (
        <>
          <Pressable
            onPress={() => router.push(`/profile/${p.id}`)}
            style={{
              borderRadius: 27,
              overflow: "hidden",
              backgroundColor: C.peach,
              marginBottom: 16,
            }}
          >
            {p.avatar_id ? (
              <Image
                source={{
                  uri: `${st.url}/v1/media/${p.avatar_id}`,
                  headers: { Authorization: `Bearer ${st.token}` },
                }}
                style={{ height: 330, width: "100%" }}
              />
            ) : (
              <View
                style={{
                  height: 320,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    width: 250,
                    height: 250,
                    borderRadius: 125,
                    borderWidth: 1,
                    borderColor: "#FFFFFF88",
                    left: -70,
                    top: -50,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    width: 250,
                    height: 250,
                    borderRadius: 125,
                    backgroundColor: "#FFFFFF33",
                    right: -50,
                    bottom: -70,
                  }}
                />
                <Text style={s.heroInitial}>{p.name[0]}</Text>
                <Text
                  style={[
                    s.eyebrow,
                    { position: "absolute", top: 24, left: 22 },
                  ]}
                >
                  {p.demo ? "DEMO PROFILE" : "A NEW POSSIBILITY"}
                </Text>
              </View>
            )}
            <LinearGradient
              colors={[C.blush, C.lavender]}
              style={{ padding: 24 }}
            >
              <Text
                style={{ fontWeight: "700", fontSize: 32, color: C.ink }}
              >
                {p.name}, {p.age}
              </Text>
              <View style={[s.row, { marginTop: 7 }]}>
                <Icon name="location-outline" size={14} color={C.primary} />
                <Text style={{ color: C.muted, fontSize: 12 }}>{p.city}</Text>
              </View>
              <Text
                style={{
                  color: C.muted,
                  fontSize: 13,
                  lineHeight: 21,
                  marginTop: 14,
                }}
              >
                {p.bio}
              </Text>
            </LinearGradient>
          </Pressable>
          <View style={[s.wrap, { marginBottom: 18 }]}>
            {p.interests.map((i) => (
              <Chip key={i} label={i} />
            ))}
          </View>
          <View style={[s.card, { backgroundColor: "#FBE4EB" }]}>
            <Text style={s.eyebrow}>A LITTLE ABOUT ME</Text>
            <Text
              style={{
                fontWeight: "700",
                fontSize: 22,
                lineHeight: 30,
                color: C.ink,
              }}
            >
              {p.prompt || "Say hello and find out."}
            </Text>
          </View>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Button
                title="Next person"
                secondary
                onPress={() => setIndex(index + 1)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Say hello"
                icon="heart-outline"
                onPress={() => router.push(`/profile/${p.id}`)}
              />
            </View>
          </View>
        </>
      ) : (
        <Empty
          title={
            st.data.me.paused
              ? "You’re taking a pause"
              : "Room for a new connection"
          }
          body={
            st.data.me.paused
              ? "Resume discovery in Profile whenever you feel ready."
              : "No new people fit these preferences right now. Try another city or check your preferences."
          }
        />
      )}
    </Page>
  );
}
