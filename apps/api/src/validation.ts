import { z } from "zod";
export const cities = [
  "Kathmandu",
  "Bhaktapur",
  "Lalitpur",
  "Pokhara",
  "Sydney",
  "Melbourne",
  "Perth",
  "Brisbane",
] as const;
export const uuid = z.string().uuid();
export const text = (max = 2000) => z.string().trim().min(1).max(max);
export const profileInput = z.object({
  name: text(60),
  city: z.enum(cities),
  bio: z.string().max(600),
  intent: text(100),
  interests: z.array(text(32)).max(12),
  prompt: z.string().max(300),
  gender: text(40),
  languages: z.array(text(40)).max(8).default([]),
  hobbies: z.array(text(40)).max(8).default([]),
  profession: z.string().max(100).default(""),
  education: z.string().max(100).default(""),
  lifestyle: z
    .object({
      smoking: z.string().max(40).optional(),
      drinking: z.string().max(40).optional(),
      pets: z.string().max(40).optional(),
      fitness: z.string().max(40).optional(),
    })
    .default({}),
  preferences: z
    .object({
      cities: z.array(z.enum(cities)).max(8),
      genders: z.array(text(40)).max(8),
      intents: z.array(text(100)).max(5).default([]),
      minAge: z.number().int().min(18).max(99),
      maxAge: z.number().int().min(18).max(99),
    })
    .refine((p) => p.maxAge >= p.minAge),
});
export const registerInput = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(10).max(128),
    name: text(60).optional(),
    city: z.enum(cities).optional(),
    birthDate: z.iso.date().optional(),
    acceptedPolicies: z.literal(true),
  })
  .refine(
    (v) => {
      if (!v.birthDate) return true;
      const d = new Date(v.birthDate);
      const cutoff = new Date();
      cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
      return d <= cutoff && d > new Date("1900-01-01");
    },
    { message: "This beta is only for adults aged 18 or older." },
  );
export const gameCatalog = [
  {
    id: "this-or-that",
    title: "This or that",
    subtitle: "Five little choices. A lot to discover.",
    emoji: "⚡",
    questions: [
      {
        q: "Your ideal Sunday?",
        options: ["Slow coffee", "An unplanned adventure"],
      },
      {
        q: "First date energy?",
        options: ["Momos & a walk", "Dinner & a little dressing up"],
      },
      { q: "A dream escape?", options: ["Mountain cabin", "By the ocean"] },
      {
        q: "Your love language today?",
        options: ["Quality time", "Little thoughtful gestures"],
      },
      {
        q: "Weekend soundtrack?",
        options: ["Live music", "A shared playlist"],
      },
    ],
  },
  {
    id: "would-you-rather",
    title: "Would you rather?",
    subtitle: "The playful questions that skip small talk.",
    emoji: "🎲",
    questions: [
      {
        q: "A spontaneous date?",
        options: ["Cook a mystery recipe", "Catch the next bus out"],
      },
      {
        q: "Pick our challenge",
        options: ["No phones for a day", "Say yes to new food"],
      },
      {
        q: "A shared superpower?",
        options: ["Speak every language", "Travel anywhere instantly"],
      },
      {
        q: "One adventure together?",
        options: ["Learn to dance", "Try pottery"],
      },
      {
        q: "A memorable first story?",
        options: ["Get delightfully lost", "Win a trivia night"],
      },
    ],
  },
  {
    id: "two-truths",
    title: "Two Truths & a Lie",
    subtitle: "Three little stories. Can you spot the invented one?",
    emoji: "🫣",
    questions: [],
  },
] as const;
