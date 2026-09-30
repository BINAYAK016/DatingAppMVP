import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { Button, s } from "./ui";
import { useStore } from "../lib/store";
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const configured = !!webClientId && (Platform.OS !== "ios" || !!iosClientId);
if (configured) GoogleSignin.configure({ webClientId, iosClientId });
export function GoogleAuth() {
  const { signIn, toast } = useStore();
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Button
        title={busy ? "Connecting…" : "Continue with Google"}
        secondary
        icon="logo-google"
        disabled={!configured || busy}
        onPress={async () => {
          setBusy(true);
          try {
            await GoogleSignin.hasPlayServices();
            const result = await GoogleSignin.signIn();
            if (isSuccessResponse(result) && result.data.idToken)
              await signIn("/auth/google", { idToken: result.data.idToken });
          } catch {
            toast(
              "Google sign-in could not finish. Please try again or use email.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      {!configured && (
        <Text style={[s.small, { textAlign: "center" }]}>
          Google is unavailable in this beta.
        </Text>
      )}
    </View>
  );
}
