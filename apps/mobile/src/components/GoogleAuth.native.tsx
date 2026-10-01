import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import {
  GoogleSignin,
  GoogleSigninButton,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { Button, s } from "./ui";
import { useStore } from "../lib/store";
import { useGoogleConfig } from "../lib/useGoogleConfig";
import { authMessage } from "../lib/authMessage";
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const configured = !!webClientId && (Platform.OS !== "ios" || !!iosClientId);
if (configured) GoogleSignin.configure({ webClientId, iosClientId });
export function GoogleAuth() {
  const { signIn } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const config = useGoogleConfig(configured);
  return (
    <View style={{ gap: 8 }}>
      <GoogleSigninButton
        accessibilityLabel="Continue with Google"
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Light}
        style={{ width: "100%", height: 48 }}
        disabled={!config.available || config.loading || busy}
        onPress={async () => {
          setBusy(true);
          setError("");
          try {
            await GoogleSignin.hasPlayServices();
            const result = await GoogleSignin.signIn();
            if (!isSuccessResponse(result)) return;
            if (!result.data.idToken)
              throw new Error(
                "Google couldn’t confirm your account. Please try again or use email.",
              );
            await signIn("/auth/google", { idToken: result.data.idToken });
          } catch (e) {
            setError(
              isErrorWithCode(e) &&
                e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
                ? "Google Play Services needs an update. You can continue with email."
                : isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS
                  ? "Google sign-in is already open. Finish that window to continue."
                  : isErrorWithCode(e)
                    ? "Google sign-in couldn’t finish. Please try again or use email."
                    : authMessage(e),
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      {(busy || config.loading) && (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.small, { textAlign: "center" }]}
        >
          {busy
            ? "Connecting to your Google account…"
            : "Checking Google sign-in…"}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.small}>
          {error}
        </Text>
      )}
      {config.error && (
        <Button
          title="Retry Google connection"
          secondary
          onPress={config.retry}
        />
      )}
      {!config.available && !config.loading && !config.error && (
        <Text style={[s.small, { textAlign: "center" }]}>
          Google isn’t available yet.
        </Text>
      )}
    </View>
  );
}
