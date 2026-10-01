import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, s } from "./ui";
import { useStore } from "../lib/store";
import { useGoogleConfig } from "../lib/useGoogleConfig";
import { authMessage } from "../lib/authMessage";
type GoogleIdentity = {
  initialize: (options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select: boolean;
    use_fedcm_for_button: boolean;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      theme: string;
      size: string;
      text: string;
      width: number;
      shape: string;
    },
  ) => void;
  disableAutoSelect: () => void;
};
const identity = () =>
  (window as Window & { google?: { accounts: { id: GoogleIdentity } } }).google
    ?.accounts.id;
let sdkPromise: Promise<GoogleIdentity> | undefined;
function loadGoogle() {
  if (identity()) return Promise.resolve(identity()!);
  if (!sdkPromise)
    sdkPromise = new Promise<GoogleIdentity>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      const timeout = setTimeout(() => {
        script.remove();
        sdkPromise = undefined;
        reject(
          new Error(
            "Google couldn’t load. Check your connection and try again.",
          ),
        );
      }, 15000);
      script.onload = () => {
        clearTimeout(timeout);
        const api = identity();
        if (api) resolve(api);
        else {
          sdkPromise = undefined;
          reject(new Error("Google couldn’t load. Please try again."));
        }
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        sdkPromise = undefined;
        reject(
          new Error(
            "Google couldn’t load. Check your connection and try again.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  return sdkPromise;
}
const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
export function GoogleAuth() {
  const config = useGoogleConfig(!!clientId);
  const { signIn } = useStore();
  const signInRef = useRef(signIn);
  useEffect(() => {
    signInRef.current = signIn;
  }, [signIn]);
  const element = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(312);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!config.available || !clientId) return;
    let active = true;
    void loadGoogle()
      .then((api) => {
        if (!active || !element.current) return;
        setError("");
        api.initialize({
          client_id: clientId,
          auto_select: false,
          use_fedcm_for_button: true,
          callback: (response) => {
            if (!active) return;
            if (!response.credential) {
              setError(
                "Google couldn’t confirm your account. Please try again.",
              );
              return;
            }
            setBusy(true);
            setError("");
            void signInRef
              .current("/auth/google", { idToken: response.credential })
              .catch((e) => {
                if (active) setError(authMessage(e));
              })
              .finally(() => {
                if (active) setBusy(false);
              });
          },
        });
        element.current.replaceChildren();
        api.renderButton(element.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: Math.min(400, Math.round(width)),
          shape: "rectangular",
        });
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(authMessage(e));
      });
    return () => {
      active = false;
    };
  }, [config.available, attempt, width]);
  return (
    <View
      style={{ gap: 8 }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {config.available ? (
        <>
          <View
            ref={element as unknown as React.Ref<View>}
            style={{
              minHeight: 48,
              alignItems: "center",
              opacity: busy ? 0.5 : 1,
            }}
            pointerEvents={busy ? "none" : "auto"}
          />
          {(!ready || busy) && !error && (
            <Text
              accessibilityLiveRegion="polite"
              style={[s.small, { textAlign: "center" }]}
            >
              {busy
                ? "Connecting to your Google account…"
                : "Loading Google sign-in…"}
            </Text>
          )}
        </>
      ) : (
        <Button
          title="Continue with Google"
          secondary
          icon="logo-google"
          disabled
          onPress={() => {}}
        />
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.small}>
          {error}
        </Text>
      )}
      {(error || config.error) && (
        <Button
          title="Retry Google connection"
          secondary
          onPress={() => {
            setError("");
            setReady(false);
            config.retry();
            setAttempt((value) => value + 1);
          }}
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
