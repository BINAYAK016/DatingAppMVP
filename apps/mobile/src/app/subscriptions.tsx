import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Button, C, Chip, Header, Icon, Page, s } from "../components/ui";
import { BillingPeriod, FREE_BENEFITS, PLUS_BENEFITS, PRICE_REGIONS, PriceRegion, priceLabel } from "../lib/pricing";

export default function Subscriptions() {
  const [region, setRegion] = useState<PriceRegion>("NP");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  return <Page>
    <Header back title="Find your together." eyebrow="SANGAI PLANS" />
    <View style={s.note}>
      <Text style={s.label}>Plan preview</Text>
      <Text style={[s.body, { marginTop: 5 }]}>Explore our proposed plans. Purchases are unavailable in this beta, and you won’t be charged.</Text>
    </View>
    <Text style={[s.label, { marginVertical: 12 }]}>Preview region</Text>
    <View style={s.wrap}>
      {(Object.keys(PRICE_REGIONS) as PriceRegion[]).map(r => <Chip key={r} label={PRICE_REGIONS[r].label} selected={region === r} onPress={() => setRegion(r)} />)}
    </View>
    <Text style={[s.label, { marginTop: 22, marginBottom: 12 }]}>Billing period</Text>
    <View style={[s.wrap, { marginBottom: 20 }]}>
      <Chip label="Monthly" selected={period === "monthly"} onPress={() => setPeriod("monthly")} />
      <Chip label="Annual · save 20%" selected={period === "annual"} onPress={() => setPeriod("annual")} />
    </View>
    <View style={s.card}>
      <View style={[s.row, { justifyContent: "space-between" }]}><Text style={s.h2}>Sangai Free</Text><Text style={s.tag}>YOUR BETA ACCESS</Text></View>
      <Text style={[s.title, { marginVertical: 14 }]}>Free</Text>
      <Text style={[s.body, { marginBottom: 17 }]}>Everything at the heart of a connection.</Text>
      {FREE_BENEFITS.map(x => <View key={x} style={[s.row, { marginBottom: 11 }]}><Icon name="checkmark" size={17} /><Text style={[s.body, { flex: 1, color: C.ink }]}>{x}</Text></View>)}
      <Text style={s.small}>Three standard games arrive first, then four more. Core dating and safety stay free.</Text>
    </View>
    <LinearGradient colors={[C.blush, C.lavender]} style={[s.card, { padding: 23 }]}>
      <View style={[s.row, { justifyContent: "space-between" }]}><Text style={s.h2}>Sangai Plus</Text><Icon name="sparkles-outline" /></View>
      <Text accessibilityLabel="Proposed price" style={[s.title, { fontSize: 32, marginTop: 18 }]}>{priceLabel(region, period)}</Text>
      <Text style={[s.body, { marginBottom: 18 }]}>{period === "annual" ? "Proposed yearly total · 20% off monthly × 12" : "Proposed monthly price"}</Text>
      {PLUS_BENEFITS.map(x => <View key={x.name} style={{ marginBottom: 15 }}><View style={s.row}><Text style={[s.label, { flex: 1 }]}>{x.name}</Text><Text style={s.small}>Planned</Text></View><Text style={[s.body, { marginTop: 4 }]}>{x.detail}</Text></View>)}
      <Button title="Preview Sangai Plus" onPress={() => router.push({ pathname: "/subscription-preview", params: { region, period } })} />
    </LinearGradient>
    <View style={s.card}><Text style={s.h2}>Your subscription</Text><Text style={[s.body, { marginTop: 8 }]}>No paid subscription is active. Selecting a plan here only changes the preview.</Text></View>
    <Text style={[s.small, { textAlign: "center" }]}>Likes stay hidden until a mutual match on every plan. Plus never guarantees a match or another person’s response.</Text>
  </Page>;
}
