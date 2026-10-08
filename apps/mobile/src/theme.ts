import { Platform, type TextStyle, type ViewStyle } from "react-native";

// Sangai's original palette stays intact; semantic foregrounds make warm
// surfaces readable without changing the brand colours.
export const C = {
  bg: "#FFFBF8",
  ink: "#2C2529",
  muted: "#7A6D73",
  line: "#EEE4E3",
  primary: "#AA536B",
  blush: "#F7E6E9",
  peach: "#F8E9DE",
  lavender: "#EFEBF5",
  white: "#FFFFFF",
  red: "#A7374B",
  textOnTint: "#6F6168",
  brandTextOnTint: "#944259",
  controlBorder: "#89757D",
  surfaceSubtle: "#F5EFEC",
  primaryPressed: "#944259",
  focus: "#944259",
  scrim: "#2C252966",
  accent: "#DB947B",
  success: "#41624D",
  successSoft: "#E7EEE7",
  warning: "#79582D",
  warningSoft: "#F8E9DE",
} as const;

const font = {
  editorial: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "Georgia, 'Times New Roman', serif",
  }),
  body: Platform.select({
    ios: "System",
    android: "sans-serif",
    default:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  }),
};
const type = {
  display: {
    fontFamily: font.editorial,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "400",
    letterSpacing: -1,
    color: C.ink,
  },
  title: {
    fontFamily: font.editorial,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "400",
    letterSpacing: -0.6,
    color: C.ink,
  },
  section: {
    fontFamily: font.editorial,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "400",
    letterSpacing: -0.3,
    color: C.ink,
  },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 24, color: C.ink },
  small: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: C.textOnTint,
  },
  meta: {
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 18,
    color: C.textOnTint,
  },
  label: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: C.ink,
  },
  eyebrow: {
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: C.brandTextOnTint,
  },
} satisfies Record<string, TextStyle>;

export const T = {
  font,
  type,
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    page: 20,
    xl: 24,
    xxl: 32,
    section: 40,
    hero: 48,
  },
  radius: { input: 14, button: 16, card: 22, media: 28, sheet: 28, pill: 999 },
  layout: {
    content: 680,
    narrowShell: 760,
    desktopShell: 1180,
    rail: 220,
    sheet: 620,
    minTarget: 44,
  },
  motion: { feedback: 120, state: 180, reveal: 240, celebrate: 300 },
  shadow: {
    card: {
      boxShadow: "0 3px 16px rgba(44, 37, 41, 0.035)",
    } satisfies ViewStyle,
    raised: {
      boxShadow: "0 12px 40px rgba(44, 37, 41, 0.12)",
    } satisfies ViewStyle,
  },
} as const;
