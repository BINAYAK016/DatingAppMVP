import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { C, s } from "./ui";

export const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 1)}***@${domain}` : email;
};
export function OTPInput({
  value,
  onChange,
  disabled = false,
  label = "Verification code",
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const input = useRef<TextInput>(null);
  const didInitialFocus = useRef(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (disabled || didInitialFocus.current) return;
    const timer = setTimeout(() => {
      if (!input.current || didInitialFocus.current) return;
      didInitialFocus.current = true;
      input.current.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [disabled]);
  return (
    <View style={{ marginVertical: 24 }}>
      <Text style={[s.label, { marginBottom: 12 }]}>{label}</Text>
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <View
          style={styles.digits}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {Array.from({ length: 6 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.digit,
                focused && index === Math.min(value.length, 5) && styles.active,
              ]}
            >
              <Text style={styles.number}>{value[index] || ""}</Text>
            </View>
          ))}
        </View>
        <TextInput
          ref={input}
          accessibilityLabel={label}
          accessibilityHint="Enter or paste the six-digit code from your email."
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 6))}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          keyboardType="number-pad"
          inputMode="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
          caretHidden
          onFocus={() => {
            didInitialFocus.current = true;
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
      </Pressable>
      <Text style={[s.small, { marginTop: 12 }]}>
        You can paste all six digits at once.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  digits: { flexDirection: "row", gap: 8 },
  digit: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  active: { borderColor: C.primary, backgroundColor: C.blush },
  number: { fontSize: 24, color: C.ink, fontWeight: "600" },
  input: {
    ...StyleSheet.absoluteFill,
    opacity: 0.01,
    fontSize: 24,
    color: "transparent",
  },
});
