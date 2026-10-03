import type { SessionCredentialStorage } from "./sessionCredentials";
// Browser session credentials live in HttpOnly cookies. Only bounded drafts
// use sessionStorage, scoped and cleared by the existing game draft lifecycle.
export const draftStorage: SessionCredentialStorage = {
  getItemAsync: async (key) => sessionStorage.getItem(key),
  setItemAsync: async (key, value) => {
    sessionStorage.setItem(key, value);
  },
  deleteItemAsync: async (key) => {
    sessionStorage.removeItem(key);
  },
};
export async function restoreCredentials(defaultServer: string) {
  return { server: defaultServer, session: null as string | null };
}
export async function saveCredentials(_server: string, _session: string) {}
export async function clearCredentials() {}
export async function saveServer(_server: string) {}
