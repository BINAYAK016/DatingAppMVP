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
  color: string;
  demo: boolean;
  followed?: boolean;
};
export type Comment = {
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
};
export type Story = {
  id: string;
  author: Person;
  body: string;
  media_id?: string;
  kind?: string;
  expires_at: string;
};
export type Circle = {
  id: string;
  name: string;
  description: string;
  owner: string;
  members: Person[];
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
    paused: boolean;
    notifications: boolean;
    preferences: {
      cities: string[];
      genders: string[];
      minAge: number;
      maxAge: number;
    };
  };
  matches: Person[];
  discover: Person[];
  requests: { from: Person; note: string }[];
  feed: Post[];
  stories: Story[];
  circles: Circle[];
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
