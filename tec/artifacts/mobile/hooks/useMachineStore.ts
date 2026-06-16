import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getScopedKey } from "@/utils/userStorage";
import { markDirty } from "@/utils/syncManager";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Machine {
  id: string;
  model: string;
  brand: string;
  year: number;
  serialNumber: string;
  fleetNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMachineInput {
  model: string;
  brand: string;
  year: number;
  serialNumber: string;
  fleetNumber: string;
}

export interface UpdateMachineInput {
  model?: string;
  brand?: string;
  year?: number;
  serialNumber?: string;
  fleetNumber?: string;
}

// ─── Query key helpers ────────────────────────────────────────────────────────

export const getListMachinesQueryKey = () => ["local_machines"] as const;
export const getGetMachineQueryKey = (id: string) => ["local_machines", id] as const;

// ─── Low-level helpers ────────────────────────────────────────────────────────

async function loadAll(): Promise<Machine[]> {
  try {
    const raw = await AsyncStorage.getItem(getScopedKey("machines_store_v1"));
    return raw ? (JSON.parse(raw) as Machine[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(machines: Machine[]): Promise<void> {
  await AsyncStorage.setItem(getScopedKey("machines_store_v1"), JSON.stringify(machines));
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useListMachines() {
  return useQuery({ queryKey: getListMachinesQueryKey(), queryFn: loadAll });
}

export function useGetMachine(id: string) {
  return useQuery({
    queryKey: getGetMachineQueryKey(id),
    queryFn: async () => {
      const all = await loadAll();
      return all.find((m) => m.id === id) ?? null;
    },
    enabled: !!id,
  });
}

export function useCreateMachine(options?: {
  mutation?: { onSuccess?: () => void; onError?: (e: unknown) => void };
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: CreateMachineInput }) => {
      const all = await loadAll();
      const now = new Date().toISOString();
      const created: Machine = {
        id: uid(), model: data.model, brand: data.brand,
        year: data.year, serialNumber: data.serialNumber,
        fleetNumber: data.fleetNumber ?? "", createdAt: now, updatedAt: now,
      };
      await saveAll([created, ...all]);
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListMachinesQueryKey() });
      markDirty();
      options?.mutation?.onSuccess?.();
    },
    onError: options?.mutation?.onError,
  });
}

export function useUpdateMachine(options?: {
  mutation?: { onSuccess?: () => void; onError?: (e: unknown) => void };
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMachineInput }) => {
      const all = await loadAll();
      const now = new Date().toISOString();
      const updated = all.map((m) => m.id === id ? { ...m, ...data, updatedAt: now } : m);
      await saveAll(updated);
      return updated.find((m) => m.id === id) ?? null;
    },
    onSuccess: (_result, { id }) => {
      qc.invalidateQueries({ queryKey: getListMachinesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetMachineQueryKey(id) });
      markDirty();
      options?.mutation?.onSuccess?.();
    },
    onError: options?.mutation?.onError,
  });
}

export function useDeleteMachine(options?: {
  mutation?: { onSuccess?: () => void; onError?: (e: unknown) => void };
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const all = await loadAll();
      await saveAll(all.filter((m) => m.id !== id));
      return { message: "Deleted" };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListMachinesQueryKey() });
      markDirty();
      options?.mutation?.onSuccess?.();
    },
    onError: options?.mutation?.onError,
  });
}
