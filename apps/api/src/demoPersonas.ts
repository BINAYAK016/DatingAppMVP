import { createHash } from "node:crypto";
import { profileInput } from "./validation";

// Fictional private-beta fixtures. These names/answers describe no real person.
// Identity metadata is confined to this demo catalog; it does not extend the
// production profile schema or infer orientation from gender preferences.
export const DEMO_CATALOG_VERSION = 1;
export const DEMO_REFERENCE_DATE = "2026-10-02";
export const DEMO_BASE_TIMESTAMP = "2026-10-02T08:00:00.000Z";
export const DEMO_INTENTS = [
  "Serious relationship",
  "Marriage",
  "Casual dating",
] as const;
export type DemoSelectorGroup = "men" | "women" | "lgbtq";
export type DemoProfile = ReturnType<typeof profileInput.parse>;
export type DemoPersona = {
  id: string;
  index: number;
  selectorGroup: DemoSelectorGroup;
  orientation: string;
  pronouns: string;
  age: number;
  birthDate: string;
  color: string;
  vibe: string;
  fictional: true;
  profile: DemoProfile;
};
export function id(index: number): string {
  if (!Number.isInteger(index) || index < 1 || index > 30)
    throw new Error("Demo persona index must be between 1 and 30.");
  return `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}
export const demoIds = Array.from({ length: 30 }, (_, index) => id(index + 1));
export function demoEntityId(kind: string, key: string | number): string {
  if (!kind || kind.length > 80 || String(key).length > 200)
    throw new Error("Invalid deterministic demo entity key.");
  const bytes = createHash("sha256")
    .update(`sangai-private-demo:v${DEMO_CATALOG_VERSION}:${kind}:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function demoTimestamp(offsetSeconds = 0): string {
  if (!Number.isSafeInteger(offsetSeconds))
    throw new Error("Demo timestamp offset must be an integer.");
  return new Date(
    Date.parse(DEMO_BASE_TIMESTAMP) + offsetSeconds * 1000,
  ).toISOString();
}

const valley = ["Kathmandu", "Lalitpur", "Bhaktapur"] as const;
const nepal = [...valley, "Pokhara"] as const;
const colors = [
  "#DDE7C9",
  "#F2D7CC",
  "#D5DFEF",
  "#E7DCF0",
  "#F2E5C1",
  "#CDE5DF",
];
type PersonaInput = {
  index: number;
  name: string;
  age: number;
  city: DemoProfile["city"];
  gender: string;
  group: DemoSelectorGroup;
  orientation: string;
  pronouns: string;
  profession: string;
  education: string;
  vibe: string;
  interests: string[];
  hobbies: string[];
  bio: string;
  prompt: string;
  preferences?: Partial<DemoProfile["preferences"]>;
};
function person(p: PersonaInput): DemoPersona {
  const intent = DEMO_INTENTS[(p.index - 1) % DEMO_INTENTS.length];
  const defaults = {
    cities: [...nepal],
    genders: [p.gender === "Man" ? "Woman" : "Man"],
    intents: [...DEMO_INTENTS],
    minAge: p.index % 4 === 0 ? 24 : 21,
    maxAge: p.index % 5 === 0 ? 32 : 35,
  };
  const profile = profileInput.parse({
    name: p.name,
    city: p.city,
    gender: p.gender,
    bio: p.bio,
    intent,
    interests: p.interests,
    prompt: p.prompt,
    languages:
      p.index % 3 === 0
        ? ["Nepali", "English", "Hindi"]
        : ["Nepali", "English"],
    hobbies: p.hobbies,
    profession: p.profession,
    education: p.education,
    lifestyle: {
      smoking: p.index % 7 === 0 ? "Occasionally" : "Never",
      drinking: p.index % 3 === 0 ? "Never" : "Socially",
      pets:
        p.index % 3 === 0
          ? "Cat person"
          : p.index % 3 === 1
            ? "Dog person"
            : "Love both",
      fitness:
        p.index % 3 === 0
          ? "Sometimes"
          : p.index % 3 === 1
            ? "Regularly"
            : "Outdoor walks",
    },
    preferences: { ...defaults, ...p.preferences },
  });
  return {
    id: id(p.index),
    index: p.index,
    selectorGroup: p.group,
    orientation: p.orientation,
    pronouns: p.pronouns,
    age: p.age,
    birthDate: `${2026 - p.age}-04-${String(1 + ((p.index * 7) % 20)).padStart(2, "0")}`,
    color: colors[(p.index - 1) % colors.length],
    vibe: p.vibe,
    fictional: true,
    profile,
  };
}

export const demoPersonas: DemoPersona[] = [
  person({
    index: 1,
    name: "Aarav",
    age: 28,
    city: "Kathmandu",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Software developer",
    education: "Computer science graduate",
    vibe: "Quiet curiosity",
    interests: ["Coffee", "Reading", "Hiking", "Photography"],
    hobbies: ["Bookshop browsing", "Weekend trails", "Film photography"],
    bio: "Usually the quiet one until someone mentions a good book or a new walking trail. I build software, overthink coffee equipment, and make room for unplanned afternoons. Hoping to meet someone who enjoys an easy conversation as much as a small adventure.",
    prompt:
      "My ideal first hour together: compare our latest reads over coffee, then take the long way home.",
    preferences: { minAge: 24, maxAge: 32, cities: [...valley] },
  }),
  person({
    index: 2,
    name: "Anaya",
    age: 27,
    city: "Lalitpur",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "Product designer",
    education: "Design graduate",
    vibe: "Thoughtful creative",
    interests: ["Art", "Coffee", "Travel", "Reading"],
    hobbies: ["Pottery", "Sketching", "Museum afternoons"],
    bio: "A little art, a little adventure. My kitchen shelf is slowly becoming a collection of uneven pottery bowls. I like thoughtful people, clear communication, and making ordinary weekends feel special. Looking for a relationship with space for both shared plans and our own interests.",
    prompt:
      "Together we could make two very wobbly mugs and promise to actually use them.",
    preferences: { minAge: 25, maxAge: 34 },
  }),
  person({
    index: 3,
    name: "Samira",
    age: 25,
    city: "Kathmandu",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "Food writer",
    education: "Communications graduate",
    vibe: "Warm and playful",
    interests: ["Food", "Music", "Hiking", "Coffee"],
    hobbies: ["Recipe experiments", "Open-mic evenings", "Momo comparisons"],
    bio: "Momos, music, and a surprisingly detailed list of places to try. Up for relaxed dates and seeing how we get along.",
    prompt:
      "Tell me your mildly controversial food opinion. I will listen before defending steamed momos.",
    preferences: {
      minAge: 23,
      maxAge: 31,
      intents: ["Casual dating", "Serious relationship"],
    },
  }),
  person({
    index: 4,
    name: "Rohan",
    age: 30,
    city: "Pokhara",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Travel coordinator",
    education: "Tourism graduate",
    vibe: "Easygoing explorer",
    interests: ["Travel", "Music", "Coffee", "Hiking"],
    hobbies: ["Lakeside walks", "Playlist making", "Train-route planning"],
    bio: "Nepali roots and a soft spot for a scenic detour. I plan trips for work but leave my own weekends open. A good connection, for me, is being comfortable enough to share both an exciting story and a quiet moment.",
    prompt:
      "I will make the road-trip playlist if you choose our first snack stop.",
    preferences: { minAge: 24, maxAge: 35 },
  }),
  person({
    index: 5,
    name: "Nisha",
    age: 26,
    city: "Pokhara",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "School librarian",
    education: "Education graduate",
    vibe: "Gentle and grounded",
    interests: ["Reading", "Art", "Hiking", "Tea"],
    hobbies: ["Reading circles", "Watercolor", "Sunset walks"],
    bio: "Lakeside sunsets, books with bent corners, and a kettle that is always ready. I enjoy slow conversations and people who keep their word. Looking toward a lasting partnership while enjoying the getting-to-know-you part.",
    prompt:
      "A small joy: rain on the roof while we swap recommendations for our next read.",
    preferences: {
      minAge: 25,
      maxAge: 34,
      intents: ["Marriage", "Serious relationship"],
    },
  }),
  person({
    index: 6,
    name: "Dev",
    age: 24,
    city: "Bhaktapur",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Sports event assistant",
    education: "Sports management diploma",
    vibe: "Outgoing teammate",
    interests: ["Football", "Food", "Music", "Fitness"],
    hobbies: ["Five-a-side football", "Trivia nights", "Cooking for friends"],
    bio: "Probably organizing the next friendly football game. I bring enthusiasm, snacks, and an ability to laugh at a missed goal. Here for fun dates and honest expectations.",
    prompt:
      "Our low-pressure first-date challenge: find a snack neither of us has tried.",
    preferences: {
      minAge: 21,
      maxAge: 29,
      intents: ["Casual dating", "Serious relationship"],
    },
  }),
  person({
    index: 7,
    name: "Ishan",
    age: 29,
    city: "Lalitpur",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Illustrator",
    education: "Fine arts graduate",
    vibe: "Observant storyteller",
    interests: ["Art", "Photography", "Reading", "Coffee"],
    hobbies: ["Street sketches", "Board games", "Used-book hunting"],
    bio: "I notice tiny details, sketch them, and occasionally turn them into stories. My best weekends include a creative project and a long lunch. Hoping to build something steady with someone who is curious about the world.",
    prompt:
      "The quickest way to make me smile: point out a detail on our walk that I missed.",
    preferences: { minAge: 24, maxAge: 34, cities: [...valley] },
  }),
  person({
    index: 8,
    name: "Pranav",
    age: 32,
    city: "Kathmandu",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Small business owner",
    education: "Business graduate",
    vibe: "Practical optimist",
    interests: ["Food", "Travel", "Fitness", "Coffee"],
    hobbies: ["Sunday meal prep", "Badminton", "Market browsing"],
    bio: "I run a small stationery business and still get excited about a very good notebook. I value consistency, humour, and supporting each other's ambitions. Looking for a partner to build a home with, without rushing the first conversation.",
    prompt:
      "A useful skill I can offer: remembering the tiny things that make your day easier.",
    preferences: {
      minAge: 26,
      maxAge: 35,
      intents: ["Marriage", "Serious relationship"],
    },
  }),
  person({
    index: 9,
    name: "Milan",
    age: 23,
    city: "Pokhara",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Music tutor",
    education: "Music diploma",
    vibe: "Playful music lover",
    interests: ["Music", "Gaming", "Food", "Travel"],
    hobbies: ["Guitar covers", "Co-op games", "Playlist swaps"],
    bio: "Learning songs, teaching chords, and trying not to collect another guitar. I like playful people and dates with room to be ourselves.",
    prompt:
      "Send me one song for a sunny walk. I will trade you one for a rainy evening.",
    preferences: {
      minAge: 21,
      maxAge: 28,
      intents: ["Casual dating", "Serious relationship"],
    },
  }),
  person({
    index: 10,
    name: "Sujan",
    age: 31,
    city: "Bhaktapur",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Civil engineer",
    education: "Engineering graduate",
    vibe: "Patient problem solver",
    interests: ["Hiking", "Photography", "Tea", "Reading"],
    hobbies: ["Early walks", "Puzzle books", "Home gardening"],
    bio: "A patient person with an impractical number of balcony plants. I like solving problems together, taking care of the small things, and leaving time for tea. Interested in a committed relationship with someone equally kind and straightforward.",
    prompt:
      "A green flag I appreciate: being able to disagree and still listen well.",
    preferences: { minAge: 25, maxAge: 35 },
  }),
  person({
    index: 11,
    name: "Kabir",
    age: 35,
    city: "Kathmandu",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Community workshop coordinator",
    education: "Social work graduate",
    vibe: "Steady conversationalist",
    interests: ["Reading", "Food", "Art", "Travel"],
    hobbies: ["Repair workshops", "Cooking", "Documentaries"],
    bio: "Happiest when a meal turns into a long conversation. My work involves practical workshops; my weekends involve trying to fix things before buying new ones. Ready for a lasting partnership rooted in respect, everyday care, and a shared sense of humour.",
    prompt:
      "The best compliment: feeling relaxed enough around each other to be ordinary.",
    preferences: {
      minAge: 28,
      maxAge: 35,
      intents: ["Marriage", "Serious relationship"],
    },
  }),
  person({
    index: 12,
    name: "Yug",
    age: 21,
    city: "Lalitpur",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Game art student",
    education: "Studying digital arts",
    vibe: "Curious gamer",
    interests: ["Gaming", "Art", "Music", "Food"],
    hobbies: ["Co-op games", "Pixel art", "Café doodles"],
    bio: "Co-op games and café doodles. Still figuring out my next creative project; happy to meet someone for a relaxed first date.",
    prompt:
      "Together we could finish a co-op level without blaming the controller.",
    preferences: {
      minAge: 21,
      maxAge: 26,
      intents: ["Casual dating", "Serious relationship"],
    },
  }),
  person({
    index: 13,
    name: "Tarin",
    age: 29,
    city: "Kathmandu",
    gender: "Man",
    group: "men",
    orientation: "Straight",
    pronouns: "he/him",
    profession: "Photographer",
    education: "Visual communication graduate",
    vibe: "Creative wanderer",
    interests: ["Photography", "Travel", "Art", "Coffee"],
    hobbies: ["Photo walks", "Collage journals", "New recipes"],
    bio: "I collect stories through a camera and terrible puns through my friends. I like making plans but can happily follow an interesting detour. Looking for a serious connection that still feels light enough to laugh at ourselves.",
    prompt:
      "Our next small adventure: take a photo walk and compare the details we noticed.",
    preferences: { minAge: 25, maxAge: 35, cities: [...valley] },
  }),
  person({
    index: 14,
    name: "Meera",
    age: 33,
    city: "Lalitpur",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "Café owner",
    education: "Hospitality graduate",
    vibe: "Warm organiser",
    interests: ["Coffee", "Food", "Reading", "Fitness"],
    hobbies: ["Bread baking", "Morning yoga", "Board games"],
    bio: "Running a small café taught me to love early mornings and a good routine. I enjoy people who are kind when nobody is watching. Looking toward marriage, with real conversations and a few enjoyable dates before big plans.",
    prompt:
      "A tradition I would like to share: a slow Sunday breakfast we take turns making.",
    preferences: {
      minAge: 28,
      maxAge: 35,
      intents: ["Marriage", "Serious relationship"],
    },
  }),
  person({
    index: 15,
    name: "Riya",
    age: 22,
    city: "Bhaktapur",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "Animation student",
    education: "Studying animation",
    vibe: "Bright improviser",
    interests: ["Art", "Gaming", "Music", "Food"],
    hobbies: ["Stop-motion clips", "Karaoke", "Snack experiments"],
    bio: "Making tiny animations and big snack plans. Up for playful dates, clear communication, and seeing where a conversation goes.",
    prompt:
      "My very specific talent: choosing a karaoke song everyone can join in.",
    preferences: {
      minAge: 21,
      maxAge: 27,
      intents: ["Casual dating", "Serious relationship"],
    },
  }),
  person({
    index: 16,
    name: "Aditi",
    age: 28,
    city: "Pokhara",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "Outdoor activity instructor",
    education: "Recreation diploma",
    vibe: "Calm adventurer",
    interests: ["Hiking", "Fitness", "Photography", "Travel"],
    hobbies: ["Easy trails", "Cycling", "Cloud spotting"],
    bio: "Adventurous enough to suggest a new trail, sensible enough to bring extra water. I appreciate gentle humour and people who treat plans as a team effort. Here for a relationship that can handle both lively days and quiet ones.",
    prompt:
      "My favourite kind of adventure ends with a view, a snack, and nobody feeling rushed.",
    preferences: { minAge: 24, maxAge: 35 },
  }),
  person({
    index: 17,
    name: "Saanvi",
    age: 30,
    city: "Kathmandu",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "Accountant",
    education: "Commerce graduate",
    vibe: "Grounded planner",
    interests: ["Reading", "Travel", "Food", "Music"],
    hobbies: ["Weekend baking", "Budget travel", "Jigsaw puzzles"],
    bio: "Good at spreadsheets, slightly less good at keeping a sourdough starter alive. I value a partner who is thoughtful, reliable, and able to have the awkward conversations kindly. Looking for marriage with a friendship underneath it.",
    prompt:
      "We will get along if we can make plans and also laugh when one goes sideways.",
    preferences: {
      minAge: 27,
      maxAge: 35,
      intents: ["Marriage", "Serious relationship"],
    },
  }),
  person({
    index: 18,
    name: "Kavya",
    age: 24,
    city: "Lalitpur",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "Radio production assistant",
    education: "Media graduate",
    vibe: "Musical social spark",
    interests: ["Music", "Food", "Art", "Travel"],
    hobbies: ["Gig nights", "Audio editing", "Café exploring"],
    bio: "Usually finding the next small gig or a snack after it. Here for fun dates and people who say what they mean.",
    prompt: "Pick a song and tell me the memory attached to it.",
    preferences: {
      minAge: 21,
      maxAge: 30,
      intents: ["Casual dating", "Serious relationship"],
    },
  }),
  person({
    index: 19,
    name: "Pema",
    age: 27,
    city: "Bhaktapur",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "Ceramics maker",
    education: "Craft design diploma",
    vibe: "Patient maker",
    interests: ["Art", "Tea", "Reading", "Hiking"],
    hobbies: ["Clay workshops", "Plant care", "Slow walks"],
    bio: "I make ceramics and still lose track of time when a piece is almost right. I appreciate patience, good questions, and a home filled with small handmade things. Looking for a connection that grows through ordinary kindness.",
    prompt:
      "A small thing that matters: asking how someone's day went and waiting for the real answer.",
    preferences: { minAge: 24, maxAge: 34, cities: [...valley] },
  }),
  person({
    index: 20,
    name: "Reva",
    age: 34,
    city: "Pokhara",
    gender: "Woman",
    group: "women",
    orientation: "Straight",
    pronouns: "she/her",
    profession: "Research editor",
    education: "Literature postgraduate",
    vibe: "Thoughtful book lover",
    interests: ["Reading", "Hiking", "Food", "Photography"],
    hobbies: ["Reading groups", "Easy walks", "Home cooking"],
    bio: "A book lover who is happy to put the book down for good company. I enjoy a gentle routine, a curious mind, and a partner who can communicate directly without making everything a debate. Looking for marriage, with time to learn how we fit into each other's lives.",
    prompt:
      "Together we could host a tiny dinner where nobody has to dress up.",
    preferences: {
      minAge: 29,
      maxAge: 35,
      intents: ["Marriage", "Serious relationship"],
    },
  }),
  person({
    index: 21,
    name: "Arin",
    age: 26,
    city: "Kathmandu",
    gender: "Man",
    group: "lgbtq",
    orientation: "Gay",
    pronouns: "he/him",
    profession: "Software developer",
    education: "Computer science graduate",
    vibe: "Quiet wit",
    interests: ["Gaming", "Coffee", "Reading", "Music"],
    hobbies: ["Co-op puzzles", "Playlist swaps", "Bookshop visits"],
    bio: "Quiet until the conversation turns to a clever game or an excellent plot twist. I make software and strong coffee. Happy to start with a relaxed date and see how we connect.",
    prompt:
      "Our first debate: which fictional world would actually be pleasant to live in?",
    preferences: {
      genders: ["Man"],
      minAge: 23,
      maxAge: 33,
      cities: [...nepal],
      intents: [...DEMO_INTENTS],
    },
  }),
  person({
    index: 22,
    name: "Neel",
    age: 28,
    city: "Lalitpur",
    gender: "Man",
    group: "lgbtq",
    orientation: "Gay",
    pronouns: "he/him",
    profession: "Travel photographer",
    education: "Media graduate",
    vibe: "Curious explorer",
    interests: ["Travel", "Photography", "Food", "Hiking"],
    hobbies: ["Photo journals", "Short hikes", "Recipe collecting"],
    bio: "I travel slowly, photograph the little details, and ask too many questions about local snacks. Looking for a man who is curious, considerate, and ready for a steady relationship. We can begin with an easy walk.",
    prompt:
      "Tell me about a place you liked for a reason no guidebook would mention.",
    preferences: {
      genders: ["Man"],
      minAge: 24,
      maxAge: 34,
      cities: [...nepal],
    },
  }),
  person({
    index: 23,
    name: "Lumi",
    age: 27,
    city: "Kathmandu",
    gender: "Woman",
    group: "lgbtq",
    orientation: "Lesbian",
    pronouns: "she/her",
    profession: "Mural artist",
    education: "Fine arts graduate",
    vibe: "Expressive maker",
    interests: ["Art", "Music", "Reading", "Coffee"],
    hobbies: ["Paint studies", "Gallery afternoons", "Board games"],
    bio: "A mural artist with paint on most of my comfortable clothes. I like women who are thoughtful, direct, and able to enjoy a very ordinary evening. Looking toward a lasting partnership, with room for our separate creative lives.",
    prompt: "Together we could choose a colour for a room we do not own yet.",
    preferences: {
      genders: ["Woman"],
      minAge: 23,
      maxAge: 33,
      cities: [...valley],
      intents: [...DEMO_INTENTS],
    },
  }),
  person({
    index: 24,
    name: "Zoya",
    age: 30,
    city: "Lalitpur",
    gender: "Woman",
    group: "lgbtq",
    orientation: "Lesbian",
    pronouns: "she/her",
    profession: "Independent shop owner",
    education: "Business graduate",
    vibe: "Playful pragmatist",
    interests: ["Food", "Travel", "Art", "Fitness"],
    hobbies: ["Cooking classes", "Badminton", "Weekend markets"],
    bio: "Running a small shop, planning a large lunch. Here to meet women for easy dates, honest communication, and a bit of shared fun.",
    prompt:
      "A surprisingly good first date: compare our very different market shopping strategies.",
    preferences: {
      genders: ["Woman"],
      minAge: 24,
      maxAge: 34,
      cities: [...valley],
      intents: [...DEMO_INTENTS],
    },
  }),
  person({
    index: 25,
    name: "Sora",
    age: 29,
    city: "Kathmandu",
    gender: "Man",
    group: "lgbtq",
    orientation: "Bisexual",
    pronouns: "he/him",
    profession: "Photographer",
    education: "Visual arts graduate",
    vibe: "Observant adventurer",
    interests: ["Photography", "Travel", "Coffee", "Art"],
    hobbies: ["Photo walks", "Film swaps", "Cooking"],
    bio: "I photograph people doing interesting work, but prefer leaving the camera at home on a date. Looking for a steady connection with someone who values curiosity and care. A relaxed walk is a good place to start.",
    prompt: "What is one ordinary moment you wish you had photographed?",
    preferences: {
      genders: ["Man", "Woman", "Non-binary"],
      minAge: 23,
      maxAge: 33,
      cities: [...nepal],
    },
  }),
  person({
    index: 26,
    name: "Esha",
    age: 26,
    city: "Bhaktapur",
    gender: "Woman",
    group: "lgbtq",
    orientation: "Bisexual",
    pronouns: "she/her",
    profession: "Musician",
    education: "Music graduate",
    vibe: "Warm collaborator",
    interests: ["Music", "Food", "Reading", "Art"],
    hobbies: ["Piano sessions", "Open-mic nights", "Baking"],
    bio: "Playing music with other people taught me to listen before jumping in. I would like a lasting partnership with kindness, humour, and enough independence for our own projects. Equally happy with a concert or a quiet meal.",
    prompt:
      "A lovely kind of teamwork: one person cooks while the other chooses the soundtrack.",
    preferences: {
      genders: ["Man", "Woman", "Non-binary"],
      minAge: 23,
      maxAge: 34,
      cities: [...nepal],
    },
  }),
  person({
    index: 27,
    name: "Tavi",
    age: 25,
    city: "Lalitpur",
    gender: "Woman",
    group: "lgbtq",
    orientation: "Pansexual",
    pronouns: "she/they",
    profession: "Creative producer",
    education: "Media arts graduate",
    vibe: "Open-minded storyteller",
    interests: ["Art", "Gaming", "Music", "Coffee"],
    hobbies: ["Short films", "Improv games", "Zine making"],
    bio: "Making small films, collecting unusual mugs, and saying yes to a low-pressure new experience. Interested in people rather than a narrow type, with clear expectations and good company.",
    prompt:
      "Let's invent a silly premise for a film and see how far one coffee takes us.",
    preferences: {
      genders: ["Man", "Woman", "Non-binary"],
      minAge: 21,
      maxAge: 33,
      cities: [...nepal],
    },
  }),
  person({
    index: 28,
    name: "Rio",
    age: 24,
    city: "Kathmandu",
    gender: "Non-binary",
    group: "lgbtq",
    orientation: "Queer",
    pronouns: "they/them",
    profession: "Game designer",
    education: "Interactive design graduate",
    vibe: "Quiet playful thinker",
    interests: ["Gaming", "Reading", "Coffee", "Art"],
    hobbies: ["Tabletop prototypes", "Pixel art", "Puzzle nights"],
    bio: "Designing little games and appreciating people who make room for a quiet pause. I am non-binary and interested in men. Looking for something steady, starting with an easy conversation and perhaps a co-op game.",
    prompt:
      "A good teammate explains the rules kindly and does not mind when I ask twice.",
    preferences: {
      genders: ["Man"],
      minAge: 23,
      maxAge: 34,
      cities: ["Kathmandu", "Lalitpur", "Pokhara"],
      intents: [...DEMO_INTENTS],
    },
  }),
  person({
    index: 29,
    name: "Noor",
    age: 27,
    city: "Lalitpur",
    gender: "Non-binary",
    group: "lgbtq",
    orientation: "Pansexual",
    pronouns: "they/them",
    profession: "Service designer",
    education: "Design postgraduate",
    vibe: "Thoughtful systems thinker",
    interests: ["Art", "Travel", "Reading", "Tea"],
    hobbies: ["Community workshops", "Sketch notes", "Walking tours"],
    bio: "I design services for work and keep weekends pleasingly unscheduled. I am drawn to people who are curious, kind, and comfortable talking about what they want. Hoping to build a lasting partnership without making the first date an interview.",
    prompt:
      "Tell me about a tiny design choice that makes your everyday life better.",
    preferences: {
      genders: ["Man", "Woman", "Non-binary"],
      minAge: 23,
      maxAge: 35,
      cities: [...nepal],
    },
  }),
  person({
    index: 30,
    name: "Avi",
    age: 31,
    city: "Pokhara",
    gender: "Man",
    group: "lgbtq",
    orientation: "Queer",
    pronouns: "he/they",
    profession: "Community events coordinator",
    education: "Community development diploma",
    vibe: "Sociable listener",
    interests: ["Food", "Music", "Hiking", "Art"],
    hobbies: ["Picnic planning", "Trivia evenings", "Easy trails"],
    bio: "I bring people together for workshops and wonderfully ordinary picnics. Interested in men and non-binary people, relaxed dates, and honest expectations. My favourite social skill is helping the quiet person join the conversation.",
    prompt:
      "An underrated first-date question: what makes a group gathering feel welcoming to you?",
    preferences: {
      genders: ["Man", "Non-binary"],
      minAge: 23,
      maxAge: 35,
      cities: [...nepal],
      intents: [...DEMO_INTENTS],
    },
  }),
];
export const personas = demoPersonas;

export type DemoEligibilityContext = {
  at?: Date | string;
  matchedPairs?: readonly (readonly [string, string])[];
  closedPairs?: readonly (readonly [string, string])[];
  blockedPairs?: readonly (readonly [string, string])[];
  decisions?: readonly { actor: string; target: string; undone?: boolean }[];
  pausedIds?: readonly string[];
  suspendedIds?: readonly string[];
};
export function demoAge(
  persona: DemoPersona,
  at: Date | string = DEMO_REFERENCE_DATE,
): number {
  const date = at instanceof Date ? at : new Date(at);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid demo eligibility date.");
  const birthday = new Date(persona.birthDate);
  let years = date.getUTCFullYear() - birthday.getUTCFullYear();
  if (
    date.getUTCMonth() < birthday.getUTCMonth() ||
    (date.getUTCMonth() === birthday.getUTCMonth() &&
      date.getUTCDate() < birthday.getUTCDate())
  )
    years--;
  return years;
}
function includesPair(
  pairs: readonly (readonly [string, string])[] | undefined,
  a: string,
  b: string,
) {
  return !!pairs?.some(
    ([first, second]) =>
      (first === a && second === b) || (first === b && second === a),
  );
}
// This oracle deliberately does not import discovery's SQL or call the engine.
// It models explicit reciprocal preferences and scenario exclusions independently
// so reports can compare expected IDs/reasons against actual API results.
export function demoEligibility(
  actor: DemoPersona,
  target: DemoPersona,
  context: DemoEligibilityContext = {},
) {
  const reasons: string[] = [];
  if (actor.id === target.id) reasons.push("self");
  for (const [label, owner, other] of [
    ["actor", actor, target],
    ["target", target, actor],
  ] as const) {
    const p = owner.profile.preferences;
    if (p.genders.length && !p.genders.includes(other.profile.gender))
      reasons.push(`${label}-gender-preference`);
    if (p.cities.length && !p.cities.includes(other.profile.city))
      reasons.push(`${label}-city-preference`);
    if (p.intents.length && !p.intents.includes(other.profile.intent))
      reasons.push(`${label}-intention-preference`);
    const age = demoAge(other, context.at || DEMO_REFERENCE_DATE);
    if (age < p.minAge || age > p.maxAge)
      reasons.push(`${label}-age-preference`);
    if (context.pausedIds?.includes(owner.id)) reasons.push(`${label}-paused`);
    if (context.suspendedIds?.includes(owner.id))
      reasons.push(`${label}-suspended`);
  }
  if (includesPair(context.blockedPairs, actor.id, target.id))
    reasons.push("blocked");
  if (includesPair(context.matchedPairs, actor.id, target.id))
    reasons.push("already-matched");
  if (includesPair(context.closedPairs, actor.id, target.id))
    reasons.push("closed-connection");
  if (
    context.decisions?.some(
      (d) => d.actor === actor.id && d.target === target.id && !d.undone,
    )
  )
    reasons.push("already-decided");
  return {
    eligible: reasons.length === 0,
    reasons,
    sharedInterests: actor.profile.interests.filter((interest) =>
      target.profile.interests.includes(interest),
    ),
  };
}
export function expectedDemoCandidates(
  actor: DemoPersona,
  context: DemoEligibilityContext = {},
) {
  return demoPersonas
    .filter((target) => demoEligibility(actor, target, context).eligible)
    .map((target) => target.id);
}
