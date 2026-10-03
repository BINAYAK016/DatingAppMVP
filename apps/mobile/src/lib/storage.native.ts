import * as SecureStore from "expo-secure-store";
import {
  readSessionCredentials,
  writeSessionCredentials,
  clearSessionCredentials,
} from "./sessionCredentials";
import { connectionSettingsEnabled } from "./connection";
export const draftStorage = SecureStore;
export async function restoreCredentials(defaultServer: string) {
  const server = connectionSettingsEnabled
    ? (await SecureStore.getItemAsync("sangai-server")) || defaultServer
    : defaultServer;
  return {
    server,
    session: await readSessionCredentials(SecureStore, server, defaultServer),
  };
}
export async function saveCredentials(server: string, session: string) {
  await writeSessionCredentials(SecureStore, server, session);
}
export async function clearCredentials() {
  await clearSessionCredentials(SecureStore);
}
export async function saveServer(server: string) {
  await SecureStore.setItemAsync("sangai-server", server);
}
