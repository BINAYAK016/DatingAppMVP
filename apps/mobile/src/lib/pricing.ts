export type PriceRegion = "NP" | "AU";
export type BillingPeriod = "monthly" | "annual";

// Display-only price hypotheses approved for the beta. Not store products or entitlements.
export const PRICE_REGIONS = {
  NP: { label: "Nepal", currency: "NPR", monthlyMinor: 29900 },
  AU: { label: "Australia", currency: "AUD", monthlyMinor: 799 },
} as const;

export function previewPrice(region: PriceRegion, period: BillingPeriod) {
  const p = PRICE_REGIONS[region];
  const minor =
    period === "annual"
      ? Math.round((p.monthlyMinor * 12 * 80) / 100)
      : p.monthlyMinor;
  return { currency: p.currency, minor, period };
}

export function priceLabel(region: PriceRegion, period: BillingPeriod) {
  const { currency, minor } = previewPrice(region, period);
  return `${currency} ${(minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const FREE_BENEFITS = [
  "Discover, match and chat",
  "Photos, videos, snaps and match-only stories",
  "Sangai posts and conversations",
  "Standard dating games as they launch",
  "Plan a Date",
  "Safety, reporting and privacy controls",
];

export const PLUS_BENEFITS = [
  { name: "Extra undos", detail: "More room to correct an accidental swipe." },
  {
    name: "Optional lifestyle filters",
    detail: "Refine preferences using details people choose to share.",
  },
  {
    name: "Bonus game packs",
    detail: "Future conversation starters beyond the seven standard games.",
  },
];
