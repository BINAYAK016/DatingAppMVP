import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  browserAuth,
  apiHeaders,
  apiCredentials,
  resumeSession,
  sessionFromSignIn,
  checkSession,
} from "./auth";
import {
  restoreCredentials,
  saveCredentials,
  clearCredentials,
  saveServer,
} from "./storage";
import { defaultServer, connectionSettingsEnabled } from "./connection";
import { isForeground, listenForResume } from "./lifecycle";
import { State } from "./types";
import { DemoConfig } from "./demo";
import { clearGameDrafts } from "./gameDrafts";
import { clearGameConversations } from "./gameChatBridge";
const DEFAULT_URL = defaultServer;
type Store = {
  data: State | null;
  token: string | null;
  url: string;
  ready: boolean;
  bootstrapError: string;
  retryBootstrap: () => void;
  loading: boolean;
  notice: string;
  sessionError: string;
  sessionLoading: boolean;
  sessionKey: number;
  storageWarning: boolean;
  demoMode: boolean | null;
  demoConfig: DemoConfig | null;
  demoConfigError: string;
  loadDemoConfig: () => Promise<void>;
  resetDemo: () => Promise<void>;
  loadMoreMatches: () => Promise<void>;
  loadMoreStories: () => Promise<void>;
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
  const [bootstrapError, setBootstrapError] = useState("");
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const retryBootstrap = () => {
    setReady(false);
    setBootstrapError("");
    setBootstrapAttempt((n) => n + 1);
  };
  const [demoMode, setDemoMode] = useState<boolean | null>(null);
  const [demoConfig, setDemoConfig] = useState<DemoConfig | null>(null);
  const [demoConfigError, setDemoConfigError] = useState("");
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
  const dataRef = useRef<State | null>(null);
  const loadedPages = useRef({ matches: 1, stories: 1 });
  const pageFlights = useRef(new Map<string, Promise<void>>());
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
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
        {
          const saved = await restoreCredentials(DEFAULT_URL);
          const server = saved.server;
          const restored = browserAuth
            ? await resumeSession(server)
            : saved.session;
          if (!mounted) return;
          urlRef.current = server;
          setUrlValue(server);
          tokenRef.current = restored;
          setToken(tokenRef.current);
        }
      } catch {
        if (mounted) {
          if (browserAuth)
            setBootstrapError(
              "We couldn’t restore your sign-in. Check your connection and try again.",
            );
          else
            toast(
              "Could not restore your saved sign-in. Please sign in again.",
            );
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast, bootstrapAttempt]);
  const saveToken = useCallback(
    async (t: string | null) => {
      const started = epoch.current,
        server = urlRef.current;
      if (t) {
        await persistCredentials(async () => {
          if (started !== epoch.current || server !== urlRef.current)
            throw new Error("Your session changed. Please sign in again.");
          await saveCredentials(server, t);
        });
        if (started !== epoch.current || server !== urlRef.current)
          throw new Error("Your session changed. Please sign in again.");
      }
      if (t) setStorageWarning(false);
      epoch.current++;
      setSessionKey((value) => value + 1);
      reads.current.clear();
      loadedPages.current = { matches: 1, stories: 1 };
      pageFlights.current.clear();
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
      if (!t) {
        try {
          await persistCredentials(async () => {
            await clearCredentials();
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
    if (!connectionSettingsEnabled) return;
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
    setDemoMode(null);
    setDemoConfig(null);
    setDemoConfigError("");
    urlRef.current = value;
    // A bearer token belongs to its server and must never follow an address change.
    void saveToken(null);
    setUrlValue(value);
    void persistCredentials(() => saveServer(value)).catch(() =>
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
          timer = setTimeout(
            () => controller.abort(),
            path === "/demo/reset" ? 120000 : 15000,
          );
        try {
          const response = await fetch(server + "/v1" + path, {
            method: verb,
            credentials: apiCredentials,
            headers: {
              "Content-Type": "application/json",
              ...apiHeaders(requestToken),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
          });
          if (!path.startsWith("/auth/")) checkSession(response, requestToken);
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
            e?.name === "BrowserSessionChangedError" &&
            started === epoch.current
          ) {
            await saveToken(null);
            setReady(false);
            setBootstrapAttempt((n) => n + 1);
          }
          if (
            e?.name === "AbortError" ||
            /fetch failed|failed to fetch|network request failed|ConnectException|ECONNREFUSED/i.test(
              String(e?.message || ""),
            )
          )
            throw new Error(
              "Cannot reach the beta server. Check your connection and try again.",
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
          // Refresh all pages the user explicitly opened. Re-projecting through
          // the server drops revoked people/stories rather than retaining stale
          // cached tail pages after a block, expiry or preference change.
          for (const kind of ["matches", "stories"] as const) {
            const cursorKey =
              kind === "matches" ? "matchesNextCursor" : "storiesNextCursor";
            for (
              let page = 1;
              page < loadedPages.current[kind] && next[cursorKey];
              page++
            ) {
              const params = new URLSearchParams(
                next[cursorKey] as Record<string, string>,
              );
              const more = await request<{ items: any[]; nextCursor: any }>(
                `/${kind}?limit=30&${params}`,
              );
              (next[kind] as any[]) = [
                ...new Map(
                  [...next[kind], ...more.items].map((item) => [item.id, item]),
                ).values(),
              ];
              next[cursorKey] = more.nextCursor;
            }
          }
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
  const loadMorePage = useCallback(
    (kind: "matches" | "stories"): Promise<void> => {
      const cursorKey =
        kind === "matches" ? "matchesNextCursor" : "storiesNextCursor";
      const cursor = dataRef.current?.[cursorKey];
      if (!cursor) return Promise.resolve();
      const existing = pageFlights.current.get(kind);
      if (existing) return existing;
      const started = epoch.current;
      const startedSequence = refreshSequence.current;
      const pending = (async () => {
        const params = new URLSearchParams(cursor as Record<string, string>);
        const page = await request<{ items: any[]; nextCursor: any }>(
          `/${kind}?limit=30&${params}`,
        );
        if (started !== epoch.current) return;
        loadedPages.current[kind]++;
        // An older page cannot append people/media that a newer bootstrap
        // already revoked. Preserve the requested depth and re-read it through
        // the current server projection instead of committing the stale page.
        if (startedSequence !== refreshSequence.current) {
          await refresh();
          return;
        }
        setData((current) => {
          if (
            !current ||
            started !== epoch.current ||
            startedSequence !== refreshSequence.current
          )
            return current;
          return {
            ...current,
            [kind]: [
              ...new Map(
                [...current[kind], ...page.items].map((item) => [
                  item.id,
                  item,
                ]),
              ).values(),
            ],
            [cursorKey]: page.nextCursor,
          };
        });
        if (refreshFlight.current) {
          refreshQueued.current = true;
        }
      })().finally(() => {
        if (pageFlights.current.get(kind) === pending)
          pageFlights.current.delete(kind);
      });
      pageFlights.current.set(kind, pending);
      return pending;
    },
    [request, refresh],
  );
  const loadDemoConfig = useCallback(async () => {
    const server = urlRef.current;
    try {
      const config = await request<DemoConfig>("/demo/config");
      if (server !== urlRef.current) return;
      setDemoMode(config.enabled === true);
      setDemoConfig(config);
      setDemoConfigError("");
    } catch (e: any) {
      if (server !== urlRef.current) return;
      // A session switch can invalidate a concurrent public read; retry it via
      // the same request guard instead of displaying a misleading offline state.
      if (e.name === "SessionChangedError") return;
      setDemoConfigError(e.message);
    }
  }, [request]);
  useEffect(() => {
    if (!ready) return;
    const initial = setTimeout(() => void loadDemoConfig(), 0);
    return () => clearTimeout(initial);
  }, [ready, url, loadDemoConfig]);
  useEffect(() => {
    if (!token) return;
    const first = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => {
      if (isForeground() && !refreshFlight.current) void refresh();
    }, 12000);
    const unsubscribe = listenForResume(() => void refresh());
    return () => {
      clearTimeout(first);
      clearInterval(t);
      unsubscribe();
    };
  }, [token, refresh]);
  const signIn = async (path: string, body: unknown) => {
    setLoading(true);
    try {
      const result = await request<{ token?: string; csrfToken?: string }>(
        path,
        body,
      );
      await saveToken(sessionFromSignIn(result));
      await refresh();
    } finally {
      setLoading(false);
    }
  };
  const signOut = async () => {
    if (browserAuth) {
      // A failed request cannot clear an HttpOnly cookie. Keep the account
      // visible and let the user retry instead of claiming persistent logout.
      try {
        if (tokenRef.current) await request("/logout", {});
      } catch (error) {
        toast("Could not sign out. Reconnect and try again.");
        throw error;
      }
      await saveToken(null);
      return;
    }
    try {
      if (tokenRef.current) await request("/logout", {});
    } finally {
      await saveToken(null);
      setData(null);
    }
  };
  const resetDemo = async () => {
    if (!demoMode || !data?.me.demo)
      throw new Error("Enter a demo profile first.");
    const account = data.me.id;
    await request("/demo/reset", { confirm: true });
    clearGameConversations(account);
    void clearGameDrafts(account).catch(() =>
      toast(
        "The demo world was restored, but saved game drafts could not be cleared on this device.",
      ),
    );
    // Retain the server identity while invalidating every old account projection
    // and remounting Chat/game screens after the shared world is restored.
    epoch.current++;
    setSessionKey((value) => value + 1);
    reads.current.clear();
    loadedPages.current = { matches: 1, stories: 1 };
    pageFlights.current.clear();
    dataRef.current = null;
    setData(null);
    await refresh();
    toast("Demo world restored. All 30 fictional profiles are ready.");
  };
  return (
    <Context.Provider
      value={{
        data,
        token,
        url,
        ready,
        bootstrapError,
        retryBootstrap,
        loading,
        notice,
        sessionError,
        sessionLoading,
        sessionKey,
        storageWarning,
        demoMode,
        demoConfig,
        demoConfigError,
        loadDemoConfig,
        resetDemo,
        loadMoreMatches: () => loadMorePage("matches"),
        loadMoreStories: () => loadMorePage("stories"),
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
