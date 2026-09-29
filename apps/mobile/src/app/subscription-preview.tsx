import React from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Header, Icon, Page, s } from "../components/ui";
import { PLUS_BENEFITS, PRICE_REGIONS, priceLabel } from "../lib/pricing";

export default function SubscriptionPreview() {
  const params = useLocalSearchParams<{ region?: string; period?: string }>();
  const region = params.region === "AU" ? "AU" : "NP";
  const period = params.period === "annual" ? "annual" : "monthly";
  return <Page>
    <Header back title="Your Plus preview" eyebrow="SANGAI PLUS" />
    <View style={s.card}>
      <View style={s.row}><Icon name="sparkles-outline" /><Text style={s.h2}>A little more possibility.</Text></View>
      <Text accessibilityLabel="Selected plan price" style={[s.title, { marginTop: 24 }]}>{priceLabel(region, period)}</Text>
      <Text style={[s.body, { marginTop: 5 }]}>{period === "annual" ? "Full annual price" : "Monthly price"} · {PRICE_REGIONS[region].label}</Text>
      {period === "annual" && <Text style={[s.small, { marginTop: 8 }]}>20% discount against twelve monthly payments, rounded to the nearest minor currency unit.</Text>}
      <View style={s.divider} />
      {PLUS_BENEFITS.map(b => <Text key={b.name} style={[s.body, { marginBottom: 10 }]}>✓ {b.name} · planned</Text>)}
    </View>
    <View style={s.note}>
      <Text style={s.label}>Purchases are coming later</Text>
      <Text style={[s.body, { marginTop: 8 }]}>This is a price and benefits preview. No payment details are collected, no subscription starts, and no renewal is scheduled.</Text>
    </View>
    <Button title="Back to plans" onPress={() => router.back()} />
    <Text style={[s.small, { textAlign: "center", marginTop: 20 }]}>Your beta account remains Free.</Text>
  </Page>;
}
