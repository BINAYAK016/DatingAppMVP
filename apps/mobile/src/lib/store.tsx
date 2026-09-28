import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { File } from "expo-file-system";
import { State } from "./types";
const DEFAULT_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:4100"
    : "http://localhost:4100");
type Store = {
  data: State | null;
  token: string | null;
  url: string;
  ready: boolean;
  loading: boolean;
  notice: string;
  setUrl: (v: string) => void;
  toast: (s: string) => void;
  request: <T = any>(
    path: string,
    body?: unknown,
    method?: string,
  ) => Promise<T>;
  refresh: () => Promise<void>;
  signIn: (path: string, body: unknown) => Promise<void>;
  signOut: () => Promise<void>;
  upload: (asset: {
    uri: string;
    mimeType?: string | null;
    type?: string | null;
  }) => Promise<{ id: string; kind: string }>;
};
const Context = createContext<Store>(null as unknown as Store);
export const useStore = () => useContext(Context);
export function Provider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null),
    [url, setUrlValue] = useState(DEFAULT_URL),
    [data, setData] = useState<State | null>(null),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState("");
  const tokenRef = useRef<string | null>(null);
  const epoch = useRef(0);
  const toast = useCallback((s: string) => setNotice(s), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        setUrlValue(
          (await SecureStore.getItemAsync("sangai-server")) || DEFAULT_URL,
        );
        const restored = await SecureStore.getItemAsync("sangai-session");
        tokenRef.current = restored;
        setToken(restored);
      }
      setReady(true);
    })();
  }, []);
  const saveToken = useCallback(async (t: string | null) => {
    epoch.current++;
    tokenRef.current = t;
    setToken(t);
    if (Platform.OS !== "web") {
      if (t) await SecureStore.setItemAsync("sangai-session", t);
      else await SecureStore.deleteItemAsync("sangai-session");
    }
  }, []);
  const setUrl = (s: string) => {
    const value = s.trim().replace(/\/$/, "");
    setUrlValue(value);
    if (Platform.OS !== "web")
      void SecureStore.setItemAsync("sangai-server", value);
  };
  const request = useCallback(
    async <T = any,>(
      path: string,
      body?: unknown,
      method?: string,
    ): Promise<T> => {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 15000);
      const requestToken = tokenRef.current;
      try {
        const response = await fetch(url + "/v1" + path, {
          method: method || (body === undefined ? "GET" : "POST"),
          headers: {
            "Content-Type": "application/json",
            ...(requestToken
              ? { Authorization: "Bearer " + requestToken }
              : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) {
          if (
            response.status === 401 &&
            requestToken &&
            requestToken === tokenRef.current
          ) {
            await saveToken(null);
            setData(null);
          }
          throw new Error(result.message || "Could not complete that action.");
        }
        return result;
      } catch (e: any) {
        if (
          e.name === "AbortError" ||
          e.message === "Network request failed" ||
          e.message === "Failed to fetch"
        )
          throw new Error(
            "Cannot reach the beta server. Check Docker and the server address.",
          );
        throw e;
      } finally {
        clearTimeout(timer);
      }
    },
    [url, saveToken],
  );
  const refresh = useCallback(async () => {
    if (!tokenRef.current) return;
    const started = epoch.current;
    try {
      const next = await request<State>("/state");
      if (started === epoch.current) setData(next);
    } catch (e: any) {
      toast(e.message);
    }
  }, [request, toast]);
  useEffect(() => {
    if (!token) return;
    const first = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 12000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      clearTimeout(first);
      clearInterval(t);
      listener.remove();
    };
  }, [token, refresh]);
  const signIn = async (path: string, body: unknown) => {
    setLoading(true);
    try {
      const result = await request<{ token: string }>(path, body);
      await saveToken(result.token);
      await refresh();
    } finally {
      setLoading(false);
    }
  };
  const signOut = async () => {
    try {
      if (tokenRef.current) await request("/logout", {});
    } finally {
      await saveToken(null);
      setData(null);
    }
  };
  const upload = async (asset: {
    uri: string;
    mimeType?: string | null;
    type?: string | null;
  }) => {
    const form = new FormData();
    const video = asset.type === "video";
    if (Platform.OS === "web") {
      const blob = await (await fetch(asset.uri)).blob();
      form.append("file", blob, video ? "moment.mp4" : "moment.jpg");
    } else {
      // SDK 57 uses Expo's standards-based fetch; URI descriptor objects are not blobs.
      form.append("file", new File(asset.uri));
    }
    const response = await fetch(url + "/v1/media", {
      method: "POST",
      headers: { Authorization: "Bearer " + tokenRef.current },
      body: form,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Upload failed.");
    return result as { id: string; kind: string };
  };
  return (
    <Context.Provider
      value={{
        data,
        token,
        url,
        ready,
        loading,
        notice,
        setUrl,
        toast,
        request,
        refresh,
        signIn,
        signOut,
        upload,
      }}
    >
      {children}
    </Context.Provider>
  );
}
