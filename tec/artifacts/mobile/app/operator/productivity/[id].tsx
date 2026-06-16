import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useGetOperator } from "@/hooks/useOperatorStore";
import { getScopedKey } from "@/utils/userStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trip {
  id: string;
  date: string;
  cubicMeters: number;
  hours: number;
  notes: string;
  createdAt: string;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function tripsKey(operatorId: string) {
  return getScopedKey(`operator_trips_${operatorId}`);
}

async function loadTrips(operatorId: string): Promise<Trip[]> {
  try {
    const raw = await AsyncStorage.getItem(tripsKey(operatorId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveTrips(operatorId: string, trips: Trip[]): Promise<void> {
  await AsyncStorage.setItem(tripsKey(operatorId), JSON.stringify(trips));
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Add Trip Modal ───────────────────────────────────────────────────────────

interface AddTripModalProps {
  visible: boolean;
  onSave: (trip: Omit<Trip, "id" | "createdAt">) => void;
  onClose: () => void;
}

function AddTripModal({ visible, onSave, onClose }: AddTripModalProps) {
  const insets = useSafeAreaInsets();
  const [cubicMeters, setCubicMeters] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [dateDisplay, setDateDisplay] = useState(
    todayIso().split("-").reverse().join("/"),
  );
  const [errors, setErrors] = useState<{
    cubicMeters?: string;
    hours?: string;
    date?: string;
  }>({});

  const handleSave = () => {
    const errs: typeof errors = {};
    const m3 = parseFloat(cubicMeters.replace(",", "."));
    if (!cubicMeters.trim()) {
      errs.cubicMeters = "Informe os metros cúbicos";
    } else if (isNaN(m3) || m3 <= 0) {
      errs.cubicMeters = "Valor inválido";
    }
    const h = parseFloat(hours.replace(",", "."));
    if (!hours.trim()) {
      errs.hours = "Informe as horas da viagem";
    } else if (isNaN(h) || h <= 0 || h > 24) {
      errs.hours = "Valor inválido (0–24)";
    }
    const digits = dateDisplay.replace(/\D/g, "");
    if (digits.length < 8) errs.date = "Data incompleta (DD/MM/AAAA)";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const [d, mo, y] = dateDisplay.split("/");
    const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    onSave({ date: iso, cubicMeters: m3, hours: h, notes: notes.trim() });
    setCubicMeters("");
    setHours("");
    setNotes("");
    setDateDisplay(todayIso().split("-").reverse().join("/"));
    setErrors({});
  };

  const applyDateMask = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={addStyles.overlay}>
        <Pressable style={addStyles.backdrop} onPress={onClose} />
        <View style={[addStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={addStyles.handle} />
          <Text style={addStyles.title}>Registrar Viagem</Text>

          {/* Date */}
          <View style={addStyles.fieldGroup}>
            <Text style={addStyles.label}>Data da viagem</Text>
            <TextInput
              style={[addStyles.input, errors.date && addStyles.inputError]}
              value={dateDisplay}
              onChangeText={(v) => {
                setDateDisplay(applyDateMask(v));
                setErrors((e) => ({ ...e, date: undefined }));
              }}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={Colors.light.textMuted}
              keyboardType="numeric"
              maxLength={10}
            />
            {errors.date ? <Text style={addStyles.errorText}>{errors.date}</Text> : null}
          </View>

          {/* Cubic meters */}
          <View style={addStyles.fieldGroup}>
            <Text style={addStyles.label}>Metros cúbicos (m³) *</Text>
            <View style={addStyles.suffixRow}>
              <TextInput
                style={[
                  addStyles.input,
                  addStyles.inputFlex,
                  errors.cubicMeters && addStyles.inputError,
                ]}
                value={cubicMeters}
                onChangeText={(v) => {
                  setCubicMeters(v);
                  setErrors((e) => ({ ...e, cubicMeters: undefined }));
                }}
                placeholder="0,00"
                placeholderTextColor={Colors.light.textMuted}
                keyboardType="decimal-pad"
              />
              <View style={addStyles.unit}>
                <Text style={addStyles.unitText}>m³</Text>
              </View>
            </View>
            {errors.cubicMeters ? (
              <Text style={addStyles.errorText}>{errors.cubicMeters}</Text>
            ) : null}
          </View>

          {/* Hours */}
          <View style={addStyles.fieldGroup}>
            <Text style={addStyles.label}>Horas trabalhadas *</Text>
            <View style={addStyles.suffixRow}>
              <TextInput
                style={[
                  addStyles.input,
                  addStyles.inputFlex,
                  errors.hours && addStyles.inputError,
                ]}
                value={hours}
                onChangeText={(v) => {
                  setHours(v);
                  setErrors((e) => ({ ...e, hours: undefined }));
                }}
                placeholder="0,0"
                placeholderTextColor={Colors.light.textMuted}
                keyboardType="decimal-pad"
              />
              <View style={addStyles.unit}>
                <Text style={addStyles.unitText}>h</Text>
              </View>
            </View>
            {errors.hours ? (
              <Text style={addStyles.errorText}>{errors.hours}</Text>
            ) : null}
          </View>

          {/* Notes */}
          <View style={addStyles.fieldGroup}>
            <Text style={addStyles.label}>Observações (opcional)</Text>
            <TextInput
              style={[addStyles.input, addStyles.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex: Carregamento de areia, trecho BR-060..."
              placeholderTextColor={Colors.light.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Actions */}
          <View style={addStyles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [addStyles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={addStyles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [addStyles.saveBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="check" size={16} color="#fff" />
              <Text style={addStyles.saveText}>Registrar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const addStyles = StyleSheet.create({
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
    width: 40,
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    textAlign: "center",
  },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  inputFlex: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  inputError: { borderColor: Colors.light.danger, backgroundColor: Colors.light.dangerLight },
  suffixRow: { flexDirection: "row", alignItems: "stretch" },
  unit: {
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderLeftWidth: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  unitText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  textarea: { height: 80, paddingTop: 12, textAlignVertical: "top" },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.danger },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  saveBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.light.success,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: Colors.light.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProductivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data: operator, isLoading: loadingOp } = useGetOperator(id ?? "");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);

  useEffect(() => {
    if (!id) return;
    loadTrips(id).then((t) => {
      setTrips(t);
      setLoadingTrips(false);
    });
  }, [id]);

  const handleAdd = useCallback(
    async (partial: Omit<Trip, "id" | "createdAt">) => {
      if (!id) return;
      const newTrip: Trip = {
        id: uid(),
        ...partial,
        createdAt: new Date().toISOString(),
      };
      const updated = [newTrip, ...trips];
      setTrips(updated);
      await saveTrips(id, updated);
      setAddVisible(false);
    },
    [id, trips],
  );

  const handleDelete = useCallback(
    async (trip: Trip) => {
      if (!id) return;
      const updated = trips.filter((t) => t.id !== trip.id);
      setTrips(updated);
      await saveTrips(id, updated);
      setDeleteTarget(null);
    },
    [id, trips],
  );

  const totalM3 = trips.reduce((acc, t) => acc + t.cubicMeters, 0);
  const totalHours = trips.reduce((acc, t) => acc + (t.hours ?? 0), 0);

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
          <Text style={styles.headerTitle}>Controle de Produtividade</Text>
          {operator ? (
            <Text style={styles.headerSub} numberOfLines={1}>{operator.name}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setAddVisible(true)}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityLabel="Nova viagem"
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Summary banner */}
      {trips.length > 0 && (
        <View style={styles.summaryBanner}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{trips.length}</Text>
            <Text style={styles.summaryLabel}>Viagens</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalM3.toFixed(1)} m³</Text>
            <Text style={styles.summaryLabel}>Total produzido</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalHours.toFixed(1)} h</Text>
            <Text style={styles.summaryLabel}>Total horas</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {totalHours > 0 ? (totalM3 / totalHours).toFixed(1) : "—"} m³/h
            </Text>
            <Text style={styles.summaryLabel}>Produtividade</Text>
          </View>
        </View>
      )}

      {/* Content */}
      {loadingOp || loadingTrips ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Feather name="bar-chart-2" size={32} color={Colors.light.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma viagem registrada</Text>
              <Text style={styles.emptyText}>
                Toque em + para registrar a primeira viagem
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.tripCard}>
              {/* Trip number badge */}
              <View style={styles.tripBadge}>
                <Text style={styles.tripBadgeText}>
                  {trips.length - index}
                </Text>
              </View>
              <View style={styles.tripInfo}>
                <View style={styles.tripMetaRow}>
                  <View style={styles.tripRow}>
                    <Feather name="calendar" size={13} color={Colors.light.textMuted} />
                    <Text style={styles.tripDate}>{formatDate(item.date)}</Text>
                  </View>
                  {(item.hours ?? 0) > 0 && (
                    <View style={styles.tripRow}>
                      <Feather name="clock" size={13} color={Colors.light.textMuted} />
                      <Text style={styles.tripDate}>
                        {(item.hours ?? 0) % 1 === 0
                          ? `${item.hours}h`
                          : `${(item.hours ?? 0).toFixed(1)}h`}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.tripM3}>
                  {item.cubicMeters.toFixed(2)} m³
                </Text>
                {item.notes ? (
                  <Text style={styles.tripNotes} numberOfLines={2}>{item.notes}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setDeleteTarget(item)}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                hitSlop={8}
                accessibilityLabel="Excluir viagem"
              >
                <Feather name="trash-2" size={16} color={Colors.light.danger} />
              </Pressable>
            </View>
          )}
        />
      )}

      {/* Add trip modal */}
      <AddTripModal
        visible={addVisible}
        onSave={handleAdd}
        onClose={() => setAddVisible(false)}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Excluir viagem"
        message={`Excluir a viagem de ${deleteTarget ? deleteTarget.cubicMeters.toFixed(2) : ""} m³ em ${deleteTarget ? formatDate(deleteTarget.date) : ""}?`}
        confirmLabel="Excluir"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  summaryBanner: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryDivider: { width: 1, backgroundColor: Colors.light.border },
  summaryValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    textAlign: "center",
  },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  tripCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  tripBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  tripBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#059669",
  },
  tripInfo: { flex: 1, gap: 3 },
  tripMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  tripRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  tripDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  tripM3: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  tripNotes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    lineHeight: 16,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
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
