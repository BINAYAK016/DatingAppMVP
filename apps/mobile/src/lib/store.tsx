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
import { State } from "./types";
import { clearGameDrafts } from "./gameDrafts";
import { clearGameConversations } from "./gameChatBridge";
import {
  readSessionCredentials,
  writeSessionCredentials,
  clearSessionCredentials,
} from "./sessionCredentials";
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
  sessionError: string;
  sessionLoading: boolean;
  sessionKey: number;
  storageWarning: boolean;
  clearSavedSignIn: () => Promise<void>;
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
  const [sessionError, setSessionError] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [storageWarning, setStorageWarning] = useState(false);
  const credentialWrites = useRef<Promise<unknown>>(Promise.resolve());
  const persistCredentials = useCallback((write: () => Promise<void>) => {
    const pending = credentialWrites.current.catch(() => {}).then(write);
    credentialWrites.current = pending;
    return pending;
  }, []);
  const refreshSequence = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const urlRef = useRef(DEFAULT_URL);
  const epoch = useRef(0);
  const accountRef = useRef<string | undefined>(undefined);
  const reads = useRef(new Map<string, Promise<any>>());
  const refreshFlight = useRef<Promise<void> | null>(null);
  const refreshQueued = useRef(false);
  const toast = useCallback((s: string) => setNotice(s), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Platform.OS !== "web") {
          const server =
            (await SecureStore.getItemAsync("sangai-server")) || DEFAULT_URL;
          const restored = await readSessionCredentials(
            SecureStore,
            server,
            DEFAULT_URL,
          );
          if (!mounted) return;
          urlRef.current = server;
          setUrlValue(server);
          tokenRef.current = restored;
          setToken(tokenRef.current);
        }
      } catch {
        if (mounted)
          toast("Could not restore your saved sign-in. Please sign in again.");
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);
  const saveToken = useCallback(
    async (t: string | null) => {
      const started = epoch.current,
        server = urlRef.current;
      if (t && Platform.OS !== "web") {
        await persistCredentials(async () => {
          if (started !== epoch.current || server !== urlRef.current)
            throw new Error("Your session changed. Please sign in again.");
          await writeSessionCredentials(SecureStore, server, t);
        });
        if (started !== epoch.current || server !== urlRef.current)
          throw new Error("Your session changed. Please sign in again.");
      }
      if (t) setStorageWarning(false);
      epoch.current++;
      setSessionKey((value) => value + 1);
      reads.current.clear();
      if (!t || t !== tokenRef.current) {
        const previousAccount = accountRef.current;
        accountRef.current = undefined;
        clearGameConversations(previousAccount);
        void clearGameDrafts(previousAccount).catch(() =>
          toast(
            "Could not clear saved game drafts. Please retry signing out before closing the app.",
          ),
        );
      }
      tokenRef.current = t;
      setToken(t);
      setData(null);
      setSessionError("");
      if (!t && Platform.OS !== "web") {
        try {
          await persistCredentials(async () => {
            await clearSessionCredentials(SecureStore);
          });
          setStorageWarning(false);
        } catch {
          setStorageWarning(true);
        }
      }
    },
    [toast, persistCredentials],
  );
  const setUrl = (s: string) => {
    const value = s.trim().replace(/\/$/, "");
    try {
      const parsed = new URL(value);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash ||
        parsed.pathname !== "/"
      )
        throw new Error();
    } catch {
      toast("Enter a server address such as http://10.0.2.2:4100.");
      return;
    }
    if (value === urlRef.current) return;
    urlRef.current = value;
    // A bearer token belongs to its server and must never follow an address change.
    void saveToken(null);
    setUrlValue(value);
    if (Platform.OS !== "web")
      void persistCredentials(() =>
        SecureStore.setItemAsync("sangai-server", value),
      ).catch(() =>
        toast("Server changed for this session. Could not save the address."),
      );
  };
  const request = useCallback(
    <T = any,>(path: string, body?: unknown, method?: string): Promise<T> => {
      const started = epoch.current,
        server = urlRef.current;
      const requestToken = tokenRef.current;
      const verb = method || (body === undefined ? "GET" : "POST");
      const key = `${started}:${server}:${path}`;
      if (verb !== "GET") reads.current.clear();
      if (verb === "GET" && reads.current.has(key))
        return reads.current.get(key)!;
      const run = async (): Promise<T> => {
        const controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch(server + "/v1" + path, {
            method: verb,
            headers: {
              "Content-Type": "application/json",
              ...(requestToken
                ? { Authorization: "Bearer " + requestToken }
                : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
          });
          let result: any;
          try {
            result = await response.json();
          } catch {
            result = null;
          }
          if (!response.ok) {
            if (
              response.status === 401 &&
              started === epoch.current &&
              server === urlRef.current &&
              requestToken &&
              requestToken === tokenRef.current
            ) {
              await saveToken(null);
              setData(null);
            }
            const error = new Error(
              result?.message ||
                "Could not complete that action. Please try again.",
            ) as Error & { status: number; retryAfter?: number };
            error.status = response.status;
            error.retryAfter =
              Number(response.headers.get("Retry-After")) || undefined;
            throw error;
          }
          if (result === null)
            throw new Error(
              "The server response could not load. Please try again.",
            );
          if (
            started !== epoch.current ||
            server !== urlRef.current ||
            requestToken !== tokenRef.current
          ) {
            const error = new Error(
              "Your session changed. Please reopen this screen.",
            );
            error.name = "SessionChangedError";
            throw error;
          }
          return result;
        } catch (e: any) {
          if (
            e?.name === "AbortError" ||
            /fetch failed|failed to fetch|network request failed|ConnectException|ECONNREFUSED/i.test(
              String(e?.message || ""),
            )
          )
            throw new Error(
              "Cannot reach the beta server. Check Docker and the server address.",
            );
          throw e;
        } finally {
          clearTimeout(timer);
        }
      };
      const pending = run();
      if (verb === "GET") {
        reads.current.set(key, pending);
        void pending
          .finally(() => {
            if (reads.current.get(key) === pending) reads.current.delete(key);
          })
          .catch(() => {});
      }
      return pending;
    },
    [saveToken],
  );
  const refresh = useCallback((): Promise<void> => {
    if (!tokenRef.current) return Promise.resolve();
    if (refreshFlight.current) {
      refreshQueued.current = true;
      return refreshFlight.current;
    }
    const run = async () => {
      do {
        refreshQueued.current = false;
        const started = epoch.current;
        const sequence = ++refreshSequence.current;
        setSessionLoading(true);
        try {
          const next = await request<State>("/state");
          if (
            started === epoch.current &&
            sequence === refreshSequence.current
          ) {
            accountRef.current = next.me.id;
            setData(next);
            setSessionError("");
          }
        } catch (e: any) {
          if (
            started === epoch.current &&
            sequence === refreshSequence.current
          ) {
            setSessionError(e.message);
            if (e.name !== "SessionChangedError") toast(e.message);
          }
        } finally {
          if (sequence === refreshSequence.current) setSessionLoading(false);
        }
      } while (refreshQueued.current && tokenRef.current);
    };
    const pending = run().finally(() => {
      refreshFlight.current = null;
    });
    refreshFlight.current = pending;
    return pending;
  }, [request, toast]);
  useEffect(() => {
    if (!token) return;
    const first = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => {
      if (AppState.currentState === "active" && !refreshFlight.current)
        void refresh();
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
  return (
    <Context.Provider
      value={{
        data,
        token,
        url,
        ready,
        loading,
        notice,
        sessionError,
        sessionLoading,
        sessionKey,
        storageWarning,
        clearSavedSignIn: () => saveToken(null),
        setUrl,
        toast,
        request,
        refresh,
        signIn,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
