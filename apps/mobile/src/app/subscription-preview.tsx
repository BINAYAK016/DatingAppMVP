import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, C, Header, Icon, Page, s } from "../components/ui";
import { PLUS_BENEFITS, PRICE_REGIONS, priceLabel } from "../lib/pricing";
export default function SubscriptionPreview() {
  const params = useLocalSearchParams<{ region?: string; period?: string }>();
  const region = params.region === "AU" ? "AU" : "NP";
  const period = params.period === "annual" ? "annual" : "monthly";
  return (
    <Page
      footer={<Button title="Back to plans" onPress={() => router.back()} />}
    >
      <Header back title="Your Plus preview" action={<View />} />
      <View style={styles.summary}>
        <Icon name="sparkles-outline" color={C.primary} size={36} />
        <Text style={[s.meta, { marginTop: 24, color: C.brandTextOnTint }]}>
          SANGAI PLUS · {PRICE_REGIONS[region].label.toUpperCase()}
        </Text>
        <Text accessibilityLabel="Selected plan price" style={styles.price}>
          {priceLabel(region, period)}
        </Text>
        <Text style={[s.body, { color: C.textOnTint }]}>
          {period === "annual" ? "Full annual price" : "Monthly price"}
        </Text>
        {period === "annual" && (
          <Text style={[s.small, { marginTop: 12, color: C.textOnTint }]}>
            20% less than twelve monthly payments, rounded to the nearest minor
            currency unit.
          </Text>
        )}
        <View style={[s.divider, { marginVertical: 24 }]} />
        {PLUS_BENEFITS.map((b) => (
          <View key={b.name} style={[s.row, { marginBottom: 14 }]}>
            <Icon name="checkmark" color={C.primary} size={18} />
            <Text style={[s.body, { color: C.ink, flex: 1 }]}>
              {b.name} · planned
            </Text>
          </View>
        ))}
      </View>
      <View style={{ paddingVertical: 28 }}>
        <Text accessibilityRole="header" style={s.h2}>
          Purchases are coming later
        </Text>
        <Text style={[s.body, { marginTop: 12 }]}>
          This is a price and benefits preview. No payment details are
          collected, no subscription starts, and no renewal is scheduled.
        </Text>
        <Text style={[s.label, { marginTop: 24, color: C.primary }]}>
          Your beta account remains Free.
        </Text>
      </View>
    </Page>
  );
}
const styles = StyleSheet.create({
  summary: { backgroundColor: C.blush, padding: 24, borderRadius: 28 },
  price: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "600",
    letterSpacing: -0.8,
    color: C.ink,
    marginVertical: 16,
  },
});
