import React from "react";
import type { ColorValue } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { C } from "../theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export type IconProps = { name: IconName; size?: number; color?: ColorValue };

// Android and iOS retain Expo's original native Ionicons font and renderer.
export function Icon({ name, size = 22, color = C.ink }: IconProps) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      allowFontScaling={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
