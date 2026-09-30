import { ImageSourcePropType } from "react-native";

// Bundled artwork is restricted to the server's explicitly fictional fixtures.
// Real account photos always use authenticated media; missing photos stay empty.
export const demoPortraits: Record<string, ImageSourcePropType> = {
  "10000000-0000-4000-8000-000000000001": require("../../assets/demo/aarav.jpg"),
  "10000000-0000-4000-8000-000000000002": require("../../assets/demo/anaya.jpg"),
  "10000000-0000-4000-8000-000000000003": require("../../assets/demo/samira.jpg"),
  "10000000-0000-4000-8000-000000000004": require("../../assets/demo/rohan.jpg"),
  "10000000-0000-4000-8000-000000000005": require("../../assets/demo/nisha.jpg"),
};
