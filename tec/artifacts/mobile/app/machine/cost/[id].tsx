import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useGetMachine } from "@/hooks/useMachineStore";
import { ConfirmModal } from "@/components/ConfirmModal";
import { getScopedKey } from "@/utils/userStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TireHistoryEntry {
  id: string;
  date: string;
  cost: string;
}
interface TireRecord { id: string; history: TireHistoryEntry[] }
interface FuelRecord { id: string; date: string; value: string }
interface PartRecord { id: string; date: string; cost: string }
interface Operator { id: string; name: string; payment: number; weeklyHours: number }
interface Trip { id: string; date: string; hours: number }

// ─── Storage helpers ──────────────────────────────────────────────────────────

const tiresKey         = (mid: string) => getScopedKey(`tires_${mid}`);
const fuelKey          = (mid: string) => getScopedKey(`fuel_${mid}`);
const partsKey         = (mid: string) => getScopedKey(`parts_${mid}`);
const opMachinesKey    = (opId: string) => getScopedKey(`operator_machines_${opId}`);
const opTripsKey       = (opId: string) => getScopedKey(`operator_trips_${opId}`);
const notasKey = (mid: string, prefix: string) => getScopedKey(`machine_notas_${mid}_${prefix}`);

interface NotaItem {
  id: string;
  description: string;
  value: number;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthPrefix(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function dateMatchesPrefix(dateStr: string, prefix: string): boolean {
  if (!dateStr) return false;
  if (/^\d{4}-\d{2}/.test(dateStr)) return dateStr.startsWith(prefix);
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}` === prefix;
  }
  return false;
}

function parseCost(v: string | number): number {
  if (v === "" || v == null) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtHours(h: number) {
  if (h === 0) return "0 h";
  return h % 1 === 0 ? `${h} h` : `${h.toFixed(1)} h`;
}

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

// ─── Cost aggregation ─────────────────────────────────────────────────────────

interface CostBreakdown {
  tiresCost: number;
  fuelCost: number;
  partsCost: number;
  operatorCost: number;
  totalHours: number;
  operatorNames: string[];
}

async function aggregateCosts(machineId: string, prefix: string): Promise<CostBreakdown> {
  let tiresCost = 0;
  try {
    const raw = await AsyncStorage.getItem(tiresKey(machineId));
    const records: TireRecord[] = raw ? JSON.parse(raw) : [];
    for (const rec of records)
      for (const h of rec.history ?? [])
        if (dateMatchesPrefix(h.date, prefix)) tiresCost += parseCost(h.cost);
  } catch {}

  let fuelCost = 0;
  try {
    const raw = await AsyncStorage.getItem(fuelKey(machineId));
    const records: FuelRecord[] = raw ? JSON.parse(raw) : [];
    for (const rec of records)
      if (dateMatchesPrefix(rec.date, prefix)) fuelCost += parseCost(rec.value);
  } catch {}

  let partsCost = 0;
  try {
    const raw = await AsyncStorage.getItem(partsKey(machineId));
    const records: PartRecord[] = raw ? JSON.parse(raw) : [];
    for (const rec of records)
      if (dateMatchesPrefix(rec.date, prefix)) partsCost += parseCost(rec.cost);
  } catch {}

  let operatorCost = 0, totalHours = 0;
  const operatorNames: string[] = [];
  try {
    const opsRaw = await AsyncStorage.getItem(getScopedKey("operators_store_v1"));
    const operators: Operator[] = opsRaw ? JSON.parse(opsRaw) : [];
    for (const op of operators) {
      const mRaw = await AsyncStorage.getItem(opMachinesKey(op.id));
      const assigned: string[] = mRaw ? JSON.parse(mRaw) : [];
      if (!assigned.includes(machineId)) continue;
      const tRaw = await AsyncStorage.getItem(opTripsKey(op.id));
      const trips: Trip[] = tRaw ? JSON.parse(tRaw) : [];
      const opHours = trips
        .filter((t) => t.date?.startsWith(prefix))
        .reduce((a, t) => a + (t.hours ?? 0), 0);
      operatorCost += op.payment ?? 0;
      totalHours += opHours;
      operatorNames.push(op.name);
    }
  } catch {}

  return { tiresCost, fuelCost, partsCost, operatorCost, totalHours, operatorNames };
}

// ─── Add/Edit Nota Modal ───────────────────────────────────────────────────────

function AddEditNotaModal({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (description: string, value: number) => void;
  initial?: NotaItem | null;
}) {
  const insets = useSafeAreaInsets();
  const isEditing = !!initial;
  const [description, setDescription] = useState("");
  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<{ value?: string }>({});

  useEffect(() => {
    if (visible) {
      setDescription(initial?.description ?? "");
      setRaw(initial ? String(initial.value).replace(".", ",") : "");
      setErrors({});
    }
  }, [visible, initial]);

  const handleSave = () => {
    const v = parseCost(raw);
    if (!raw.trim() || v <= 0) { setErrors({ value: "Informe um valor válido" }); return; }
    onSave(description.trim(), v);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={notaS.overlay}>
          <Pressable style={notaS.backdrop} onPress={onClose} />
          <View style={[notaS.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={notaS.handle} />
            <Text style={notaS.title}>{isEditing ? "Editar Nota" : "Nova Nota"}</Text>
            <Text style={notaS.subtitle}>Pagamento recebido do contratante pelo serviço da máquina</Text>

            <View style={notaS.fieldGroup}>
              <Text style={notaS.label}>Descrição (opcional)</Text>
              <TextInput
                style={notaS.descInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex: Contrato mensal, faturamento parcial..."
                placeholderTextColor={Colors.light.textMuted}
              />
            </View>

            <View style={notaS.fieldGroup}>
              <Text style={notaS.label}>Valor (R$) *</Text>
              <View style={notaS.suffixRow}>
                <View style={notaS.prefix}>
                  <Text style={notaS.prefixText}>R$</Text>
                </View>
                <TextInput
                  style={[notaS.input, !!errors.value && notaS.inputError]}
                  value={raw}
                  onChangeText={(v) => { setRaw(v); setErrors({}); }}
                  placeholder="0,00"
                  placeholderTextColor={Colors.light.textMuted}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              {errors.value ? <Text style={notaS.errorText}>{errors.value}</Text> : null}
            </View>

            <View style={notaS.actions}>
              <Pressable onPress={onClose} style={({ pressed }) => [notaS.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}>
                <Text style={notaS.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={({ pressed }) => [notaS.saveBtn, { opacity: pressed ? 0.85 : 1 }]}>
                <Feather name="check" size={16} color="#fff" />
                <Text style={notaS.saveText}>{isEditing ? "Salvar" : "Adicionar"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const notaS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.light.border,
    borderRadius: 2, alignSelf: "center", marginBottom: 4,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center" },
  subtitle: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary,
    textAlign: "center", lineHeight: 18,
  },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  descInput: {
    height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.light.border,
    paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_400Regular",
    color: Colors.light.text, backgroundColor: Colors.light.background,
  },
  suffixRow: { flexDirection: "row", alignItems: "stretch" },
  prefix: {
    height: 48, paddingHorizontal: 14,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderRightWidth: 0, borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  prefixText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  input: {
    flex: 1, height: 48,
    borderWidth: 1.5, borderColor: Colors.light.border,
    borderTopRightRadius: 12, borderBottomRightRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  inputError: { borderColor: Colors.light.danger, backgroundColor: Colors.light.dangerLight },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.danger },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.light.border,
    alignItems: "center", justifyContent: "center",
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  saveBtn: {
    flex: 2, height: 50, borderRadius: 14,
    backgroundColor: Colors.light.tint,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

// ─── CostRow ──────────────────────────────────────────────────────────────────

interface CostRowProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel?: string;
  value: number;
  highlighted?: boolean;
}

function CostRow({ icon, iconColor, iconBg, label, sublabel, value, highlighted }: CostRowProps) {
  return (
    <View style={[rowS.row, highlighted && rowS.highlighted]}>
      <View style={[rowS.iconBox, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <View style={rowS.texts}>
        <Text style={rowS.label}>{label}</Text>
        {sublabel ? <Text style={rowS.sublabel}>{sublabel}</Text> : null}
      </View>
      <Text style={[rowS.value, highlighted && rowS.valueHighlighted]}>{fmtBRL(value)}</Text>
    </View>
  );
}

const rowS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.light.border,
  },
  highlighted: { borderColor: "#3D3200", backgroundColor: "#FFF7F4" },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  texts: { flex: 1, gap: 2 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  sublabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textMuted },
  value: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text },
  valueHighlighted: { color: Colors.light.tint, fontSize: 16 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CostPerHourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: machine, isLoading: loadingMachine } = useGetMachine(id ?? "");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [breakdown, setBreakdown] = useState<CostBreakdown | null>(null);
  const [notas, setNotas] = useState<NotaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notaModalVisible, setNotaModalVisible] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaItem | null>(null);
  const [deleteNotaId, setDeleteNotaId] = useState<string | null>(null);

  const prefix = monthPrefix(year, month);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [result, notasRaw] = await Promise.all([
      aggregateCosts(id, prefix),
      AsyncStorage.getItem(notasKey(id, prefix)),
    ]);
    setBreakdown(result);
    if (notasRaw) {
      try {
        const parsed = JSON.parse(notasRaw);
        if (Array.isArray(parsed)) {
          setNotas(parsed as NotaItem[]);
        } else {
          const v = parseCost(notasRaw);
          if (v > 0) {
            setNotas([{ id: "legacy", description: "Nota do mês", value: v, createdAt: new Date().toISOString() }]);
          } else setNotas([]);
        }
      } catch { setNotas([]); }
    } else setNotas([]);
    setLoading(false);
  }, [id, prefix]);

  useEffect(() => { load(); }, [load]);

  const saveNotas = async (updated: NotaItem[]) => {
    if (!id) return;
    await AsyncStorage.setItem(notasKey(id, prefix), JSON.stringify(updated));
  };

  const handleSaveNota = async (description: string, value: number) => {
    if (!id) return;
    if (editingNota) {
      const updated = notas.map((n) => n.id === editingNota.id ? { ...editingNota, description, value } : n);
      setNotas(updated);
      await saveNotas(updated);
    } else {
      const newNota: NotaItem = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        description,
        value,
        createdAt: new Date().toISOString(),
      };
      const updated = [...notas, newNota];
      setNotas(updated);
      await saveNotas(updated);
    }
    setEditingNota(null);
    setNotaModalVisible(false);
  };

  const handleDeleteNota = async () => {
    if (!deleteNotaId || !id) return;
    const updated = notas.filter((n) => n.id !== deleteNotaId);
    setNotas(updated);
    setDeleteNotaId(null);
    await saveNotas(updated);
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const totalNota = notas.reduce((sum, n) => sum + n.value, 0);

  const totalCost = breakdown
    ? breakdown.tiresCost + breakdown.fuelCost + breakdown.partsCost + breakdown.operatorCost
    : 0;

  const totalHours = breakdown?.totalHours ?? 0;
  const costPerHour = totalHours > 0 ? totalCost / totalHours : null;
  const revenuePerHour = totalNota > 0 && totalHours > 0 ? totalNota / totalHours : null;

  // Rentabilidade
  const profit = totalNota - totalCost;
  const margin = totalNota > 0 ? (profit / totalNota) * 100 : null;
  const isProfit = profit >= 0;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

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
          <Text style={styles.headerTitle}>Custo por Hora</Text>
          {machine ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {machine.model} – {machine.brand}
            </Text>
          ) : null}
        </View>
        {/* Add nota button */}
        <Pressable
          onPress={() => { setEditingNota(null); setNotaModalVisible(true); }}
          style={({ pressed }) => [styles.notaBtn, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityLabel="Adicionar nota"
        >
          <Feather name="file-plus" size={18} color={Colors.light.tint} />
          <Text style={styles.notaBtnText}>+ Nota</Text>
        </Pressable>
      </View>

      {/* Month selector */}
      <View style={styles.monthRow}>
        <Pressable
          onPress={prevMonth}
          style={({ pressed }) => [styles.monthArrow, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityLabel="Mês anterior"
        >
          <Feather name="chevron-left" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <Pressable
          onPress={nextMonth}
          style={({ pressed }) => [
            styles.monthArrow,
            { opacity: isCurrentMonth ? 0.3 : pressed ? 0.6 : 1 },
          ]}
          disabled={isCurrentMonth}
          accessibilityLabel="Próximo mês"
        >
          <Feather name="chevron-right" size={22} color={Colors.light.text} />
        </Pressable>
      </View>

      {loadingMachine || loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card — Custo por hora */}
          <View style={styles.heroCard}>
            <View style={styles.heroIconBox}>
              <Feather name="trending-up" size={28} color={Colors.light.tint} />
            </View>
            <View style={styles.heroTexts}>
              {costPerHour !== null ? (
                <>
                  <Text style={styles.heroCost}>{fmtBRL(costPerHour)}</Text>
                  <Text style={styles.heroSub}>custo por hora trabalhada</Text>
                  <Text style={styles.heroHours}>
                    Baseado em {fmtHours(totalHours)} registradas
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.heroNoData}>—</Text>
                  <Text style={styles.heroSub}>
                    {totalHours === 0 ? "Sem horas registradas neste mês" : "Sem dados neste mês"}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* NOTAS section */}
          <View style={styles.notasSection}>
            <View style={styles.notasSectionHeader}>
              <View style={styles.notaIconBox}>
                <Feather name="file-text" size={18} color="#0EA5E9" />
              </View>
              <Text style={styles.notasSectionTitle}>Notas do Mês</Text>
              {totalNota > 0 && (
                <Text style={styles.notasTotalBadge}>{fmtBRL(totalNota)}</Text>
              )}
              <Pressable
                onPress={() => { setEditingNota(null); setNotaModalVisible(true); }}
                style={({ pressed }) => [styles.notasAddBtn, { opacity: pressed ? 0.75 : 1 }]}
              >
                <Feather name="plus" size={16} color={Colors.light.tint} />
                <Text style={styles.notasAddText}>Nova nota</Text>
              </Pressable>
            </View>
            {notas.length === 0 ? (
              <View style={styles.notasEmpty}>
                <Text style={styles.notasEmptyText}>Nenhuma nota registrada — toque em "+ Nova nota" para adicionar</Text>
              </View>
            ) : (
              notas.map((n) => (
                <View key={n.id} style={styles.notaItemCard}>
                  <View style={{ flex: 1 }}>
                    {!!n.description && (
                      <Text style={styles.notaItemDesc} numberOfLines={1}>{n.description}</Text>
                    )}
                    <Text style={styles.notaItemValue}>{fmtBRL(n.value)}</Text>
                  </View>
                  <Pressable
                    onPress={() => { setEditingNota(n); setNotaModalVisible(true); }}
                    hitSlop={8}
                    style={({ pressed }) => [styles.notaItemEditBtn, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Feather name="edit-2" size={13} color="#0EA5E9" />
                  </Pressable>
                  <Pressable
                    onPress={() => setDeleteNotaId(n.id)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.notaItemDelBtn, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Feather name="trash-2" size={13} color={Colors.light.danger} />
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {/* Rentabilidade — only shown when notas are registered */}
          {totalNota > 0 && (
            <>
              <Text style={styles.sectionTitle}>Rentabilidade</Text>
              <View style={[
                styles.rentCard,
                { borderColor: isProfit ? "#A7F3D0" : "#FECACA", backgroundColor: isProfit ? "#F0FDF4" : "#FFF1F2" },
              ]}>
                {/* Indicator badge */}
                <View style={[
                  styles.rentBadge,
                  { backgroundColor: isProfit ? "#059669" : Colors.light.danger },
                ]}>
                  <Feather name={isProfit ? "trending-up" : "trending-down"} size={16} color="#fff" />
                  <Text style={styles.rentBadgeText}>{isProfit ? "Lucrativo" : "Deficitário"}</Text>
                </View>

                {/* Profit / Loss amount */}
                <View style={styles.rentMainRow}>
                  <Text style={styles.rentMainLabel}>{isProfit ? "Lucro bruto" : "Prejuízo"}</Text>
                  <Text style={[styles.rentMainValue, { color: isProfit ? "#059669" : Colors.light.danger }]}>
                    {fmtBRL(Math.abs(profit))}
                  </Text>
                </View>

                {/* Divider */}
                <View style={styles.rentDivider} />

                {/* Detail rows */}
                <View style={styles.rentDetailRow}>
                  <Text style={styles.rentDetailLabel}>Receita (Notas)</Text>
                  <Text style={[styles.rentDetailValue, { color: "#059669" }]}>{fmtBRL(totalNota)}</Text>
                </View>
                <View style={styles.rentDetailRow}>
                  <Text style={styles.rentDetailLabel}>(−) Custo total</Text>
                  <Text style={[styles.rentDetailValue, { color: Colors.light.danger }]}>{fmtBRL(totalCost)}</Text>
                </View>

                {margin !== null && (
                  <View style={styles.rentDetailRow}>
                    <Text style={styles.rentDetailLabel}>Margem</Text>
                    <Text style={[styles.rentDetailValue, { color: isProfit ? "#059669" : Colors.light.danger }]}>
                      {margin.toFixed(1)}%
                    </Text>
                  </View>
                )}

                {revenuePerHour !== null && costPerHour !== null && (
                  <>
                    <View style={styles.rentDivider} />
                    <View style={styles.rentDetailRow}>
                      <Text style={styles.rentDetailLabel}>Receita / hora</Text>
                      <Text style={[styles.rentDetailValue, { color: "#059669" }]}>{fmtBRL(revenuePerHour)}/h</Text>
                    </View>
                    <View style={styles.rentDetailRow}>
                      <Text style={styles.rentDetailLabel}>Custo / hora</Text>
                      <Text style={[styles.rentDetailValue, { color: Colors.light.danger }]}>{fmtBRL(costPerHour)}/h</Text>
                    </View>
                    <View style={styles.rentDetailRow}>
                      <Text style={styles.rentDetailLabel}>Ganho / hora</Text>
                      <Text style={[styles.rentDetailValue, {
                        color: revenuePerHour >= costPerHour ? "#059669" : Colors.light.danger,
                      }]}>
                        {fmtBRL(revenuePerHour - costPerHour)}/h
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </>
          )}

          {/* Total costs */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Custo total do mês</Text>
            <Text style={styles.totalValue}>{fmtBRL(totalCost)}</Text>
          </View>

          {/* Cost breakdown */}
          <Text style={styles.sectionTitle}>Detalhamento de custos</Text>
          <View style={styles.rows}>
            <CostRow
              icon="droplet" iconColor="#0EA5E9" iconBg="#E0F2FE"
              label="Combustível" sublabel="Abastecimentos do mês"
              value={breakdown?.fuelCost ?? 0}
            />
            <CostRow
              icon="circle" iconColor="#D97706" iconBg="#FEF3C7"
              label="Pneus & Esteiras" sublabel="Reformas e trocas do mês"
              value={breakdown?.tiresCost ?? 0}
            />
            <CostRow
              icon="settings" iconColor="#7C3AED" iconBg="#EDE9FE"
              label="Peças de manutenção" sublabel="Peças trocadas no mês"
              value={breakdown?.partsCost ?? 0}
            />
            <CostRow
              icon="user" iconColor={Colors.light.success} iconBg={Colors.light.successLight}
              label="Operador(es)"
              sublabel={
                breakdown?.operatorNames.length
                  ? breakdown.operatorNames.join(", ")
                  : "Nenhum operador vinculado"
              }
              value={breakdown?.operatorCost ?? 0}
            />
          </View>

          {/* Hours */}
          <Text style={styles.sectionTitle}>Horas trabalhadas</Text>
          <View style={styles.hoursCard}>
            <View style={styles.hoursIconBox}>
              <Feather name="clock" size={22} color={Colors.light.tint} />
            </View>
            <View style={styles.hoursTexts}>
              <Text style={styles.hoursValue}>{fmtHours(totalHours)}</Text>
              <Text style={styles.hoursSub}>
                Soma das horas dos operadores vinculados neste mês
              </Text>
            </View>
          </View>

          {/* Formula note */}
          {costPerHour !== null && (
            <View style={styles.formulaCard}>
              <Feather name="info" size={14} color={Colors.light.textMuted} />
              <Text style={styles.formulaText}>
                {fmtBRL(totalCost)} ÷ {fmtHours(totalHours)} ={" "}
                <Text style={{ fontFamily: "Inter_700Bold", color: Colors.light.tint }}>
                  {fmtBRL(costPerHour)}/h
                </Text>
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add/Edit Nota modal */}
      <AddEditNotaModal
        visible={notaModalVisible}
        initial={editingNota}
        onSave={handleSaveNota}
        onClose={() => { setNotaModalVisible(false); setEditingNota(null); }}
      />

      {/* Confirm delete nota */}
      <ConfirmModal
        visible={deleteNotaId !== null}
        title="Excluir nota"
        message="Deseja excluir esta nota? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={handleDeleteNota}
        onCancel={() => setDeleteNotaId(null)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.light.surface, alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 1 },

  notaBtn: {
    height: 40, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: "#2A2200",
    borderWidth: 1.5, borderColor: "#3D3200",
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  notaBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.tint },

  monthRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 8, gap: 16,
  },
  monthArrow: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.light.border,
    alignItems: "center", justifyContent: "center",
  },
  monthLabel: {
    fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.text,
    minWidth: 170, textAlign: "center",
  },

  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  heroCard: {
    backgroundColor: Colors.light.surface, borderRadius: 20,
    padding: 20, flexDirection: "row", alignItems: "center", gap: 16,
    borderWidth: 1.5, borderColor: "#3D3200",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  heroIconBox: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: "#2A2200", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  heroTexts: { flex: 1, gap: 2 },
  heroCost: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.light.tint, lineHeight: 34 },
  heroNoData: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.light.textMuted },
  heroSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  heroHours: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textMuted, marginTop: 2 },

  notaIconBox: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  notasSection: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    borderWidth: 1, borderColor: "#BAE6FD", overflow: "hidden",
  },
  notasSectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  notasSectionTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  notasTotalBadge: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#0EA5E9",
  },
  notasAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "#2A2200", borderWidth: 1, borderColor: "#3D3200",
  },
  notasAddText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.tint },
  notasEmpty: { padding: 16 },
  notasEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textMuted, textAlign: "center" },
  notaItemCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  notaItemDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  notaItemValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0EA5E9" },
  notaItemEditBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center",
  },
  notaItemDelBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.light.dangerLight, alignItems: "center", justifyContent: "center",
  },

  sectionTitle: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.textMuted,
    textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4,
  },

  rentCard: {
    borderRadius: 16, padding: 16, borderWidth: 1.5, gap: 10,
  },
  rentBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  rentBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  rentMainRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  rentMainLabel: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.text },
  rentMainValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  rentDivider: { height: 1, backgroundColor: Colors.light.border },
  rentDetailRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  rentDetailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  rentDetailValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  totalRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.light.surface, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  totalLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  totalValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },

  rows: { gap: 8 },

  hoursCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#F0FDF4", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#A7F3D0",
  },
  hoursIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  hoursTexts: { flex: 1, gap: 3 },
  hoursValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#059669" },
  hoursSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#065F46", lineHeight: 15 },

  formulaCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.surfaceSecondary, borderRadius: 12, padding: 12,
  },
  formulaText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, lineHeight: 18,
  },
});
