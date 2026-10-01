import { initializeDemoWorld } from "./demoWorld";

// Preserve the bootstrap and test import contract. Ordinary startup never
// restores activity after the current synthetic-world version was installed.
export { demoIds } from "./demoPersonas";
export const seed = initializeDemoWorld;
