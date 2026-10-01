export type GameQuestion = {
  id: string;
  q: string;
  options: { id: string; label: string }[];
};
export type GameDefinitionV2 = {
  id: string;
  definitionVersion: number;
  title: string;
  subtitle: string;
  emoji: string;
  category: "Get to know you" | "Make them laugh" | "See if you click";
  durationMinutes: string;
  players: 2;
  mechanic: "choices" | "truths" | "guess" | "rapid" | "questions";
  questions: GameQuestion[];
  suggestions?: string[];
};
const question = (
  id: string,
  q: string,
  ...labels: string[]
): GameQuestion => ({
  id,
  q,
  options: labels.map((label, i) => ({ id: String(i), label })),
});

// Published versions are immutable. Add a new version to this registry when
// changing questions or rules; existing sessions retain their original version.
const definitions: GameDefinitionV2[] = [
  {
    id: "this-or-that",
    definitionVersion: 1,
    title: "This or That",
    subtitle: "Five little choices. Discover your shared favourites.",
    emoji: "❤️",
    category: "Make them laugh",
    durationMinutes: "2–3",
    players: 2,
    mechanic: "choices",
    questions: [
      question("escape", "Beach or mountains?", "Beach 🌊", "Mountains 🏔️"),
      question(
        "sunday",
        "Your ideal Sunday?",
        "Slow coffee ☕",
        "An unplanned adventure 🌅",
      ),
      question(
        "date",
        "First date energy?",
        "Momos and a walk",
        "Dinner and dressing up",
      ),
      question(
        "music",
        "Our soundtrack?",
        "Live music 🎵",
        "A shared playlist 🎧",
      ),
      question(
        "surprise",
        "A little surprise?",
        "A thoughtful note",
        "A spontaneous plan",
      ),
    ],
  },
  {
    id: "would-you-rather",
    definitionVersion: 1,
    title: "Would You Rather",
    subtitle: "A few ridiculous choices. Tell them why.",
    emoji: "😂",
    category: "Make them laugh",
    durationMinutes: "2–3",
    players: 2,
    mechanic: "choices",
    questions: [
      question(
        "together",
        "Would you rather…",
        "Travel the world together ✈️",
        "Build a cosy home together 🏡",
      ),
      question(
        "challenge",
        "Pick our challenge",
        "Cook a mystery recipe",
        "Learn a dance together",
      ),
      question(
        "power",
        "One shared superpower?",
        "Speak every language",
        "Teleport anywhere",
      ),
      question(
        "day",
        "A day together?",
        "No phones at all",
        "Say yes to every new food",
      ),
      question(
        "story",
        "Our first great story?",
        "Get delightfully lost",
        "Win a trivia night",
      ),
    ],
  },
  {
    id: "two-truths",
    definitionVersion: 1,
    title: "Two Truths & a Lie",
    subtitle: "Three stories. One invented. Take turns guessing.",
    emoji: "🤫",
    category: "Get to know you",
    durationMinutes: "3–5",
    players: 2,
    mechanic: "truths",
    questions: [],
  },
  {
    id: "guess-my-answer",
    definitionVersion: 1,
    title: "Guess My Answer",
    subtitle: "Pick your answer privately. Can your match guess?",
    emoji: "🧠",
    category: "Get to know you",
    durationMinutes: "3–5",
    players: 2,
    mechanic: "guess",
    questions: [
      question(
        "weekend",
        "My ideal weekend?",
        "A cosy day in",
        "A hike",
        "Food with friends",
        "A spontaneous trip",
      ),
      question(
        "treat",
        "My favourite little treat?",
        "Coffee",
        "Something sweet",
        "A book",
        "A new playlist",
      ),
      question(
        "trip",
        "My dream getaway?",
        "Mountains",
        "By the ocean",
        "A bustling city",
        "Somewhere quiet",
      ),
      question(
        "date",
        "My first-date pick?",
        "Coffee",
        "Food",
        "Live music",
        "A sunset walk",
      ),
      question(
        "learn",
        "What would I try next?",
        "Dancing",
        "Cooking",
        "Photography",
        "A new sport",
      ),
      question(
        "hello",
        "My favourite hello?",
        "A funny meme",
        "A thoughtful question",
        "A voice call",
        "A plan to meet",
      ),
    ],
  },
  {
    id: "rapid-fire",
    definitionVersion: 1,
    title: "Rapid Fire",
    subtitle: "Ten quick choices. Your own 90-second round.",
    emoji: "⚡",
    category: "Make them laugh",
    durationMinutes: "2",
    players: 2,
    mechanic: "rapid",
    questions: [
      question("drink", "Coffee or tea?", "Coffee ☕", "Tea 🍵"),
      question("escape", "Beach or mountains?", "Beach 🌊", "Mountains 🏔️"),
      question("time", "Morning or night?", "Morning 🌅", "Night 🌙"),
      question("hello", "Call or text?", "Call 📞", "Text 💬"),
      question("weekend", "Stay in or go out?", "Stay in 🏠", "Go out 🎉"),
      question("food", "Sweet or savoury?", "Sweet", "Savoury"),
      question("plan", "Plan or improvise?", "Plan", "Improvise"),
      question("movie", "Comedy or adventure?", "Comedy", "Adventure"),
      question("trip", "Road trip or flight?", "Road trip", "Flight"),
      question("date", "Dinner or breakfast date?", "Dinner", "Breakfast"),
    ],
  },
  {
    id: "compatibility-challenge",
    definitionVersion: 1,
    title: "Compatibility Challenge",
    subtitle: "Notice what you share. Be curious about differences.",
    emoji: "✨",
    category: "See if you click",
    durationMinutes: "3–5",
    players: 2,
    mechanic: "choices",
    questions: [
      question(
        "communication",
        "When something is on my mind…",
        "Talk it through soon",
        "Take time, then talk",
      ),
      question(
        "weekend",
        "A lovely shared weekend?",
        "Explore somewhere new",
        "Recharge somewhere familiar",
      ),
      question(
        "plan",
        "How do we make plans?",
        "Pick a time together",
        "Leave room for spontaneity",
      ),
      question(
        "care",
        "A little way to show care?",
        "Time and attention",
        "A thoughtful small gesture",
      ),
      question(
        "friends",
        "Meeting each other's friends?",
        "A small gathering",
        "One person at a time",
      ),
      question(
        "date",
        "A date that feels good?",
        "Something playful",
        "A long conversation",
      ),
    ],
  },
  {
    id: "20-questions",
    definitionVersion: 1,
    title: "20 Questions",
    subtitle: "Take turns asking. Follow your curiosity.",
    emoji: "💬",
    category: "Get to know you",
    durationMinutes: "5–10",
    players: 2,
    mechanic: "questions",
    questions: [],
    suggestions: [
      "What's a place you've always wanted to visit?",
      "What small thing made you smile recently?",
      "What's a food you'd happily eat every week?",
      "What do your friends love about you?",
      "What would your perfect Saturday look like?",
      "What's something you'd love to learn?",
    ],
  },
];
for (const definition of definitions) {
  for (const q of definition.questions) {
    for (const option of q.options) Object.freeze(option);
    Object.freeze(q.options);
    Object.freeze(q);
  }
  Object.freeze(definition.questions);
  if (definition.suggestions) Object.freeze(definition.suggestions);
  Object.freeze(definition);
}
export const gameDefinitionsV2: readonly GameDefinitionV2[] =
  Object.freeze(definitions);
export function definitionFor(kind: string, version = 1) {
  return gameDefinitionsV2.find(
    (d) => d.id === kind && d.definitionVersion === version,
  );
}
