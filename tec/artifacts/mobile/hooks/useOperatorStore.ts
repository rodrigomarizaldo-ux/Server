import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getScopedKey } from "@/utils/userStorage";
import { markDirty } from "@/utils/syncManager";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Operator {
  id: string;
  name: string;
  birthDate: string;
  payment: number;
  weeklyHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOperatorInput {
  name: string;
  birthDate: string;
  payment: number;
  weeklyHours: number;
}

export interface UpdateOperatorInput {
  name?: string;
  birthDate?: string;
  payment?: number;
  weeklyHours?: number;
}

// ─── Query key helpers ────────────────────────────────────────────────────────

export const getListOperatorsQueryKey = () => ["local_operators"] as const;
export const getGetOperatorQueryKey = (id: string) => ["local_operators", id] as const;

// ─── Low-level helpers ────────────────────────────────────────────────────────

async function loadAll(): Promise<Operator[]> {
  try {
    const raw = await AsyncStorage.getItem(getScopedKey("operators_store_v1"));
    return raw ? (JSON.parse(raw) as Operator[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(operators: Operator[]): Promise<void> {
  await AsyncStorage.setItem(getScopedKey("operators_store_v1"), JSON.stringify(operators));
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useListOperators() {
  return useQuery({ queryKey: getListOperatorsQueryKey(), queryFn: loadAll });
}

export function useGetOperator(id: string) {
  return useQuery({
    queryKey: getGetOperatorQueryKey(id),
    queryFn: async () => {
      const all = await loadAll();
      return all.find((o) => o.id === id) ?? null;
    },
    enabled: !!id,
  });
}

export function useCreateOperator(options?: {
  mutation?: { onSuccess?: () => void; onError?: (e: unknown) => void };
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: CreateOperatorInput }) => {
      const all = await loadAll();
      const now = new Date().toISOString();
      const created: Operator = { id: uid(), ...data, createdAt: now, updatedAt: now };
      await saveAll([created, ...all]);
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListOperatorsQueryKey() });
      markDirty();
      options?.mutation?.onSuccess?.();
    },
    onError: options?.mutation?.onError,
  });
}

export function useUpdateOperator(options?: {
  mutation?: { onSuccess?: () => void; onError?: (e: unknown) => void };
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOperatorInput }) => {
      const all = await loadAll();
      const now = new Date().toISOString();
      const updated = all.map((o) => o.id === id ? { ...o, ...data, updatedAt: now } : o);
      await saveAll(updated);
      return updated.find((o) => o.id === id) ?? null;
    },
    onSuccess: (_result, { id }) => {
      qc.invalidateQueries({ queryKey: getListOperatorsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetOperatorQueryKey(id) });
      markDirty();
      options?.mutation?.onSuccess?.();
    },
    onError: options?.mutation?.onError,
  });
}

export function useDeleteOperator(options?: {
  mutation?: { onSuccess?: () => void; onError?: (e: unknown) => void };
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const all = await loadAll();
      await saveAll(all.filter((o) => o.id !== id));
      return { message: "Deleted" };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListOperatorsQueryKey() });
      markDirty();
      options?.mutation?.onSuccess?.();
    },
    onError: options?.mutation?.onError,
  });
}
