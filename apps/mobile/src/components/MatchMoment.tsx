import React, { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, C, Icon, PersonImage, s } from "./ui";
import { Person } from "../lib/types";
import { useReducedMotion } from "../lib/useReducedMotion";

export function MatchMoment({
  me,
  person,
  onChat,
  onExplore,
}: {
  me: Person;
  person: Person;
  onChat: () => void;
  onExplore: () => void;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  useEffect(() => {
    const motion = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : 300,
      useNativeDriver: true,
    });
    motion.start();
    return () => motion.stop();
  }, [progress, reduced]);
  return (
    <Modal
      visible
      accessibilityLabel="It’s a Match!"
      animationType={reduced ? "none" : "fade"}
      onRequestClose={onExplore}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 500,
            alignSelf: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              paddingVertical: 12,
            }}
          >
            <Icon name="heart-outline" color={C.primary} size={22} />
            <Text style={[s.label, { color: C.primary, fontSize: 18 }]}>
              sangai
            </Text>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingVertical: 16,
            }}
          >
            <Animated.View
              style={{
                justifyContent: "center",
                opacity: progress,
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 20,
                }}
              >
                <View
                  style={{
                    width: "44%",
                    height: Math.min(300, height * 0.28),
                    borderRadius: 20,
                    overflow: "hidden",
                    borderWidth: 5,
                    borderColor: C.white,
                    transform: [{ rotate: "-8deg" }],
                  }}
                >
                  <PersonImage
                    person={me}
                    style={{ width: "100%", height: "100%" }}
                  />
                </View>
                <View
                  style={{
                    width: "44%",
                    height: Math.min(300, height * 0.28),
                    borderRadius: 20,
                    overflow: "hidden",
                    borderWidth: 5,
                    borderColor: C.white,
                    marginLeft: -24,
                    transform: [{ rotate: "8deg" }],
                  }}
                >
                  <PersonImage
                    person={person}
                    style={{ width: "100%", height: "100%" }}
                  />
                </View>
                <View
                  style={{
                    position: "absolute",
                    bottom: 10,
                    alignSelf: "center",
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: C.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 4,
                    borderColor: C.bg,
                  }}
                >
                  <Icon name="heart" color={C.white} size={24} />
                </View>
              </View>
              <Text
                accessibilityRole="header"
                style={[s.display, { textAlign: "center", marginTop: 12 }]}
              >
                It’s a Match!
              </Text>
              <Text
                style={[
                  s.body,
                  {
                    textAlign: "center",
                    color: C.muted,
                    marginTop: 12,
                    paddingHorizontal: 16,
                  },
                ]}
              >
                You and {person.name} chose each other. Every good story starts
                with a hello.
              </Text>
              {person.demo && (
                <Text style={[s.small, { textAlign: "center", marginTop: 12 }]}>
                  Fictional demo connection
                </Text>
              )}
            </Animated.View>
          </ScrollView>
          <Button title="Start Chat" onPress={onChat} />
          <View style={{ height: 12 }} />
          <Button title="Keep discovering" secondary onPress={onExplore} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
