export type Person = {
  id: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  intent: string;
  interests: string[];
  prompt: string;
  gender: string;
  avatar_id?: string;
  media?: { id: string; kind: string; position: number }[];
  color: string;
  demo: boolean;
  followed?: boolean;
  preview?: string;
  unread?: number;
  languages: string[];
  hobbies: string[];
  profession: string;
  education: string;
  lifestyle: Record<string, string>;
};
export type Comment = {
  parent_id?: string;
  id: string;
  author: Person;
  body: string;
  created_at: string;
};
export type Post = {
  id: string;
  author: Person;
  body: string;
  media_id?: string;
  kind?: string;
  created_at: string;
  comments: Comment[];
  likes: number;
  liked: boolean;
  saved: boolean;
};
export type Story = {
  id: string;
  author: Person;
  body: string;
  media_id?: string;
  kind?: string;
  expires_at: string;
};
export type GameDefinition = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  questions: { q: string; options: string[] }[];
};
export type State = {
  me: Person & {
    email: string;
    email_verified_at: string | null;
    adult_declared_at: string | null;
    onboarded_at: string | null;
    onboarding_step: number;
    birth_date: string | null;
    paused: boolean;
    notifications: boolean;
    posts_visible: boolean;
    stories_visible: boolean;
    messages_enabled: boolean;
    interactions_enabled: boolean;
    data_saver: boolean;
    preferences: {
      cities: string[];
      genders: string[];
      intents?: string[];
      minAge: number;
      maxAge: number;
    };
  };
  matches: Person[];
  discover: Person[];
  undoId: string | null;
  feed: Post[];
  stories: Story[];
  notifications: {
    id: string;
    body: string;
    kind: string;
    read: boolean;
    created_at: string;
  }[];
  games: GameDefinition[];
};
export const CITIES = [
  "Kathmandu",
  "Bhaktapur",
  "Lalitpur",
  "Pokhara",
  "Sydney",
  "Melbourne",
  "Perth",
  "Brisbane",
];
export const INTERESTS = [
  "Coffee",
  "Hiking",
  "Art",
  "Music",
  "Food",
  "Travel",
  "Reading",
  "Photography",
  "Fitness",
  "Gaming",
  "Films",
  "Dancing",
];
