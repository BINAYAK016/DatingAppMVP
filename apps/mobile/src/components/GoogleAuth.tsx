import React from "react";
import { Text, View } from "react-native";
import { Button, s } from "./ui";
export function GoogleAuth() {
  return (
    <View style={{ gap: 8 }}>
      <Button
        title="Continue with Google"
        secondary
        icon="logo-google"
        disabled
        onPress={() => {}}
      />
      <Text style={[s.small, { textAlign: "center" }]}>
        Google is unavailable in this preview.
      </Text>
    </View>
  );
}
