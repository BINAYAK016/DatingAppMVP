import React from "react";
import { Text, View } from "react-native";
import { Button, s } from "./ui";
export function GoogleAuth() {
  return (
    <View style={{ marginBottom: 12 }}>
      <Button
        title="Continue with Google"
        secondary
        disabled
        onPress={() => {}}
      />
      <Text style={[s.small, { marginTop: 8 }]}>
        Google sign-in is available in a configured Android or iOS build. Use
        email in this browser preview.
      </Text>
    </View>
  );
}
