import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import {
  checkConnectivity,
  clearDirty,
  getLastSync,
  isDirty,
  pushToCloud,
  registerSyncTrigger,
  unregisterSyncTrigger,
} from "@/utils/syncManager";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingSync: boolean;
  lastSyncAt: Date | null;
  syncNow: () => Promise<void>;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const SyncContext = createContext<SyncContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [isOnline, setIsOnline]       = useState(true);
  const [isSyncing, setIsSyncing]     = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const [lastSyncAt, setLastSyncAt]   = useState<Date | null>(null);
  const syncingRef = useRef(false);

  // Load initial state
  useEffect(() => {
    (async () => {
      const dirty = await isDirty();
      setPendingSync(dirty);
      const last = await getLastSync();
      setLastSyncAt(last);
    })();
  }, []);

  const syncNow = useCallback(async () => {
    if (!token || syncingRef.current) return;

    const online = await checkConnectivity();
    setIsOnline(online);
    if (!online) return;

    syncingRef.current = true;
    setIsSyncing(true);

    const result = await pushToCloud(token);

    setIsSyncing(false);
    syncingRef.current = false;

    if (result.ok) {
      setPendingSync(false);
      setLastSyncAt(new Date());
    }
  }, [token]);

  // Register a trigger so hooks can kick off a sync after mutations
  useEffect(() => {
    registerSyncTrigger(() => {
      setPendingSync(true);
      setTimeout(() => syncNow(), 400);
    });
    return () => unregisterSyncTrigger();
  }, [syncNow]);

  // Sync on mount (once authenticated)
  useEffect(() => {
    if (token) syncNow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Sync when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active" && token) syncNow();
    });
    return () => sub.remove();
  }, [token, syncNow]);

  // Periodic sync every 5 minutes
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(syncNow, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, syncNow]);

  return (
    <SyncContext.Provider value={{ isOnline, isSyncing, pendingSync, lastSyncAt, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
