import React from "react";
import { View, type ColorValue } from "react-native";
import createIconSet from "@expo/vector-icons/createIconSet";
import glyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json";
import { C } from "../theme";

// The complete existing icon font, losslessly encoded for browsers. No glyphs
// are removed, so dynamically selected icons keep the same names and shapes.
const WebIonicons = createIconSet(
  glyphMap,
  "sangai-ionicons",
  // Metro resolves bundled font assets with a static require.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../../assets/fonts/Ionicons.woff2"),
);
export type IconName = keyof typeof glyphMap;
export type IconProps = { name: IconName; size?: number; color?: ColorValue };

export function Icon({ name, size = 22, color = C.ink }: IconProps) {
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <WebIonicons name={name} size={size} color={color} />
    </View>
  );
}
