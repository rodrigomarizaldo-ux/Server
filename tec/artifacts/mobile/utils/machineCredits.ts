import AsyncStorage from "@react-native-async-storage/async-storage";
import { getScopedKey } from "./userStorage";

export interface MachineCredit {
  id: string;
  paymentId: string;
  purchasedAt: string;
}

const KEY = "machine_credits_v1";

async function _load(): Promise<MachineCredit[]> {
  try {
    const raw = await AsyncStorage.getItem(getScopedKey(KEY));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function _save(credits: MachineCredit[]): Promise<void> {
  await AsyncStorage.setItem(getScopedKey(KEY), JSON.stringify(credits));
}

/** Returns the first available credit, or null if none. */
export async function getAvailableCredit(): Promise<MachineCredit | null> {
  const list = await _load();
  return list[0] ?? null;
}

/** Returns how many unused credits exist. */
export async function countCredits(): Promise<number> {
  const list = await _load();
  return list.length;
}

/**
 * Saves a new credit after a successful payment.
 * Call this BEFORE navigating away from the payment screen.
 */
export async function addCredit(paymentId: string): Promise<MachineCredit> {
  const list = await _load();
  const credit: MachineCredit = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    paymentId,
    purchasedAt: new Date().toISOString(),
  };
  list.push(credit);
  await _save(list);
  return credit;
}

/**
 * Consumes (removes) the first available credit.
 * Returns true if a credit was consumed, false if there was none.
 * Call this when the machine is successfully created.
 */
export async function consumeCredit(): Promise<boolean> {
  const list = await _load();
  if (list.length === 0) return false;
  await _save(list.slice(1));
  return true;
}
