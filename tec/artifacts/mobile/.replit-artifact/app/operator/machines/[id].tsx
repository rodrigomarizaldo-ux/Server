import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useGetOperator } from "@/hooks/useOperatorStore";
import { useListMachines } from "@/hooks/useMachineStore";
import { getScopedKey } from "@/utils/userStorage";

function assignedKey(operatorId: string) {
  return getScopedKey(`operator_machines_${operatorId}`);
}

async function loadAssigned(operatorId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(assignedKey(operatorId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveAssigned(operatorId: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(assignedKey(operatorId), JSON.stringify(ids));
}

export default function OperatorMachinesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data: operator, isLoading: loadingOp } = useGetOperator(id ?? "");
  const { data: allMachines, isLoading: loadingMachines } = useListMachines();

  const [assigned, setAssigned] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadAssigned(id).then(setAssigned);
  }, [id]);

  const toggle = useCallback(
    async (machineId: string) => {
      if (!id) return;
      setSaving(machineId);
      const next = assigned.includes(machineId)
        ? assigned.filter((m) => m !== machineId)
        : [...assigned, machineId];
      setAssigned(next);
      await saveAssigned(id, next);
      setSaving(null);
    },
    [id, assigned],
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const isLoading = loadingOp || loadingMachines;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityLabel="Voltar"
        >
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Máquinas Operadas</Text>
          {operator ? (
            <Text style={styles.headerSub} numberOfLines={1}>{operator.name}</Text>
          ) : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : !allMachines || allMachines.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Feather name="tool" size={32} color={Colors.light.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma máquina cadastrada</Text>
          <Text style={styles.emptyText}>
            Cadastre máquinas na aba Máquinas primeiro
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.infoBar}>
            <Feather name="info" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.infoText}>
              Toque para vincular ou desvincular uma máquina ao operador
            </Text>
          </View>
          <FlatList
            data={allMachines}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isAssigned = assigned.includes(item.id);
              const isSaving = saving === item.id;
              return (
                <Pressable
                  onPress={() => toggle(item.id)}
                  style={({ pressed }) => [
                    styles.row,
                    isAssigned && styles.rowActive,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  {/* Left: machine info */}
                  <View style={[styles.machineIcon, isAssigned && styles.machineIconActive]}>
                    <Feather
                      name="tool"
                      size={18}
                      color={isAssigned ? "#fff" : Colors.light.textMuted}
                    />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowTitle, isAssigned && styles.rowTitleActive]}>
                      {item.model}
                    </Text>
                    <Text style={styles.rowSub}>
                      {item.brand} · {item.year} · {item.serialNumber}
                    </Text>
                  </View>
                  {/* Right: toggle indicator */}
                  {isSaving ? (
                    <ActivityIndicator size="small" color={Colors.light.tint} />
                  ) : (
                    <View
                      style={[
                        styles.checkbox,
                        isAssigned && styles.checkboxActive,
                      ]}
                    >
                      {isAssigned && (
                        <Feather name="check" size={14} color="#fff" />
                      )}
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  rowActive: {
    borderColor: Colors.light.tint,
    backgroundColor: "#FFF7F4",
  },
  machineIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  machineIconActive: {
    backgroundColor: Colors.light.tint,
  },
  rowInfo: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  rowTitleActive: { color: Colors.light.tint },
  rowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
