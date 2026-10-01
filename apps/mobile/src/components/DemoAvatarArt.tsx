import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { demoPalette } from "../lib/demoArt";
import { Person } from "../lib/types";

export function DemoAvatarArt({
  person,
  style,
}: {
  person: Partial<Person>;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = demoPalette(person.id);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${person.name || "Demo"} · fictional illustrated avatar`}
      style={[
        {
          width: "100%",
          height: "100%",
          overflow: "hidden",
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      <View
        style={{
          position: "absolute",
          width: "68%",
          height: "58%",
          borderRadius: 100,
          bottom: "-15%",
          left: "16%",
          backgroundColor: colors.shirt,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: "34%",
          height: "40%",
          borderRadius: 100,
          top: "19%",
          left: "33%",
          backgroundColor: colors.skin,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: "36%",
          height: "19%",
          borderTopLeftRadius: 100,
          borderTopRightRadius: 100,
          top: "16%",
          left: "32%",
          backgroundColor: colors.hair,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: "9%",
          height: "9%",
          borderRadius: 100,
          top: "13%",
          right: "13%",
          backgroundColor: "#FFFFFF80",
        }}
      />
    </View>
  );
}
