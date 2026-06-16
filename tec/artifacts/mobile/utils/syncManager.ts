import AsyncStorage from "@react-native-async-storage/async-storage";
import { getScopedKey } from "./userStorage";
import { apiUrl } from "@/contexts/AuthContext";

// ─── Keys ─────────────────────────────────────────────────────────────────────

const dirtyKey   = () => getScopedKey("sync_dirty_v1");
const lastSyncKey = () => getScopedKey("sync_last_v1");

// ─── Global sync trigger (set by SyncContext on mount) ────────────────────────

let _onDirty: (() => void) | null = null;

export function registerSyncTrigger(fn: () => void) {
  _onDirty = fn;
}

export function unregisterSyncTrigger() {
  _onDirty = null;
}

// ─── Dirty flag ───────────────────────────────────────────────────────────────

export async function markDirty(): Promise<void> {
  await AsyncStorage.setItem(dirtyKey(), "1");
  _onDirty?.();
}

export async function clearDirty(): Promise<void> {
  await AsyncStorage.removeItem(dirtyKey());
}

export async function isDirty(): Promise<boolean> {
  return (await AsyncStorage.getItem(dirtyKey())) === "1";
}

// ─── Last sync timestamp ──────────────────────────────────────────────────────

export async function setLastSync(): Promise<void> {
  await AsyncStorage.setItem(lastSyncKey(), Date.now().toString());
}

export async function getLastSync(): Promise<Date | null> {
  const val = await AsyncStorage.getItem(lastSyncKey());
  return val ? new Date(parseInt(val, 10)) : null;
}

// ─── Load local data ──────────────────────────────────────────────────────────

async function loadMachines(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(getScopedKey("machines_store_v1"));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function loadOperators(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(getScopedKey("operators_store_v1"));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function loadRentals(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(getScopedKey("rentals_store_v1"));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ─── Network check ────────────────────────────────────────────────────────────

export async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(apiUrl("/healthz"), { signal: controller.signal });
    clearTimeout(tid);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Push to cloud ────────────────────────────────────────────────────────────

export async function pushToCloud(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [machines, operators, rentals] = await Promise.all([
      loadMachines(),
      loadOperators(),
      loadRentals(),
    ]);

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(apiUrl("/sync/push"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ machines, operators, rentals }),
      signal: controller.signal,
    });

    clearTimeout(tid);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { ok: false, error: (d as any).error ?? "Erro ao sincronizar" };
    }

    await setLastSync();
    await clearDirty();
    return { ok: true };
  } catch (err: any) {
    if (err?.name === "AbortError") return { ok: false, error: "Tempo esgotado" };
    return { ok: false, error: err?.message ?? "Sem conexão" };
  }
}
