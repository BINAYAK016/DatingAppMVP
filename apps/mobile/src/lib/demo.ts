import { Person } from "./types";

export type DemoGroup = "men" | "women" | "lgbtq";
export type DemoConfig = {
  enabled: boolean;
  version: number;
  groups: Record<DemoGroup, number>;
};
export type DemoPerson = Person & {
  demo_group: DemoGroup;
  orientation: string;
  pronouns: string;
  looking_for: string[];
};
export type DemoUsersPage = { items: DemoPerson[]; nextCursor: string | null };
export const DEMO_GROUPS: { id: DemoGroup; title: string }[] = [
  { id: "men", title: "Men" },
  { id: "women", title: "Women" },
  { id: "lgbtq", title: "LGBTQ+ / Other" },
];
