import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Button, C, Chip, Header, Icon, Page, s } from "../components/ui";
import {
  BillingPeriod,
  FREE_BENEFITS,
  PLUS_BENEFITS,
  PRICE_REGIONS,
  PriceRegion,
  priceLabel,
} from "../lib/pricing";
export default function Subscriptions() {
  const [region, setRegion] = useState<PriceRegion>("NP");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  return (
    <Page
      footer={
        <View>
          <Button
            title="Preview Sangai Plus"
            onPress={() =>
              router.push({
                pathname: "/subscription-preview",
                params: { region, period },
              })
            }
          />
          <Text style={[s.small, { textAlign: "center", marginTop: 10 }]}>
            Plan preview · purchases unavailable in this beta
          </Text>
        </View>
      }
    >
      <Header back title="Sangai Plus" action={<View />} />
      <LinearGradient
        colors={[C.blush, C.peach]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.symbol}>
          <Icon name="sparkles-outline" size={36} color={C.primary} />
        </View>
        <Text style={styles.headline}>A little more{"\n"}possibility.</Text>
        <Text style={[s.body, { marginTop: 12 }]}>
          Extra room to find your together.
        </Text>
      </LinearGradient>
      <View style={styles.controls}>
        <Text style={[s.small, { marginBottom: 12 }]}>PREVIEW REGION</Text>
        <View style={s.wrap}>
          {(Object.keys(PRICE_REGIONS) as PriceRegion[]).map((r) => (
            <Chip
              key={r}
              label={PRICE_REGIONS[r].label}
              selected={region === r}
              onPress={() => setRegion(r)}
            />
          ))}
        </View>
        <View style={[s.row, { marginTop: 20 }]}>
          <Chip
            label="Monthly"
            selected={period === "monthly"}
            onPress={() => setPeriod("monthly")}
          />
          <Chip
            label="Annual · save 20%"
            selected={period === "annual"}
            onPress={() => setPeriod("annual")}
          />
        </View>
      </View>
      <View style={styles.price}>
        <Text accessibilityLabel="Proposed price" style={styles.amount}>
          {priceLabel(region, period)}
        </Text>
        <Text style={[s.body, { marginTop: 8 }]}>
          {period === "annual"
            ? "Proposed yearly total · save 20%"
            : "Proposed monthly price"}
        </Text>
      </View>
      <Text style={[s.small, { marginBottom: 20 }]}>PLANNED PLUS BENEFITS</Text>
      {PLUS_BENEFITS.map((x, i) => (
        <View key={x.name} style={styles.benefit}>
          <View style={styles.benefitIcon}>
            <Icon
              name={
                ["arrow-undo-outline", "options-outline", "sparkles-outline"][
                  i
                ] as React.ComponentProps<typeof Icon>["name"]
              }
              color={C.primary}
              size={22}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{x.name}</Text>
            <Text style={[s.body, { marginTop: 5 }]}>{x.detail}</Text>
          </View>
        </View>
      ))}
      <View style={styles.free}>
        <View style={[s.row, { marginBottom: 12 }]}>
          <Icon name="heart-outline" color={C.primary} />
          <Text style={s.h2}>Your beta access is Free.</Text>
        </View>
        <Text style={[s.body, { marginBottom: 20 }]}>
          Everything at the heart of a connection.
        </Text>
        {FREE_BENEFITS.map((x) => (
          <View key={x} style={[s.row, { marginBottom: 14 }]}>
            <Icon name="checkmark" color={C.primary} size={18} />
            <Text style={[s.body, { flex: 1, color: C.ink }]}>{x}</Text>
          </View>
        ))}
        <Text style={s.small}>
          Three standard games are here first; four more will follow. Core
          dating and safety stay free.
        </Text>
      </View>
      <Text style={[s.small, { marginTop: 24 }]}>
        No paid subscription is active. Likes stay hidden until a mutual match
        on every plan. Plus never guarantees a match or another person’s
        response.
      </Text>
    </Page>
  );
}
const styles = StyleSheet.create({
  hero: { padding: 28, borderRadius: 18 },
  symbol: { marginBottom: 24 },
  headline: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "600",
    letterSpacing: -0.9,
    color: C.ink,
  },
  controls: { paddingVertical: 28 },
  price: { paddingBottom: 28 },
  amount: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "600",
    color: C.ink,
    letterSpacing: -0.8,
  },
  benefit: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 24,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: C.blush,
  },
  free: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingTop: 28,
    marginTop: 8,
  },
});
