import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { ConfirmModal } from "@/components/ConfirmModal";
import { useGetMachine } from "@/hooks/useMachineStore";
import { getScopedKey } from "@/utils/userStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

type TireType = "pneu" | "esteira";
type HistoryType = "reforma" | "troca";

interface TireHistoryEntry {
  id: string;
  type: HistoryType;
  date: string;
  description: string;
  cost: string;
  createdAt: string;
}

interface TireRecord {
  id: string;
  type: TireType;
  position: string;
  brand: string;
  size: string;
  installDate: string;
  estimatedLifeHours: string;
  notes: string;
  history: TireHistoryEntry[];
  createdAt: string;
}

interface FuelRecord {
  id: string;
  date: string;
  liters: string;
  value: string;
  notes: string;
  createdAt: string;
}

type ScreenView = "pneus" | "combustivel";

// ─── Storage ──────────────────────────────────────────────────────────────────

const tiresKey = (mid: string) => getScopedKey(`tires_${mid}`);
const fuelKey = (mid: string) => getScopedKey(`fuel_${mid}`);

// ─── Constants ────────────────────────────────────────────────────────────────

const TIRE_POSITIONS = [
  "Dianteiro Esquerdo", "Dianteiro Direito",
  "Traseiro Esquerdo", "Traseiro Direito",
  "Pneu Diretor", "Rodeiro",
];
const TRACK_POSITIONS = ["Esteira Esquerda", "Esteira Direita"];

const TYPE_COLOR: Record<TireType, string> = {
  pneu: "#0EA5E9",
  esteira: "#D97706",
};
const TYPE_BG: Record<TireType, string> = {
  pneu: "#E0F2FE",
  esteira: "#FEF3C7",
};
const HIST_COLOR: Record<HistoryType, string> = {
  reforma: Colors.light.tint,
  troca: "#7C3AED",
};
const HIST_BG: Record<HistoryType, string> = {
  reforma: "#2A2200",
  troca: "#EDE9FE",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtCurrency(v: string) {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? v : `R$ ${n.toFixed(2).replace(".", ",")}`;
}

// ─── Small Chip Row ───────────────────────────────────────────────────────────

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  labelFn,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labelFn?: (v: T) => string;
}) {
  return (
    <View style={chipS.row}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          style={[chipS.chip, value === opt && chipS.chipActive]}
        >
          <Text style={[chipS.label, value === opt && chipS.labelActive]}>
            {labelFn ? labelFn(opt) : opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const chipS = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1.5, borderColor: "transparent",
  },
  chipActive: { backgroundColor: "#E0F2FE", borderColor: "#0EA5E9" },
  label: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  labelActive: { color: "#0369A1", fontFamily: "Inter_600SemiBold" },
});

// ─── History Entry item ───────────────────────────────────────────────────────

function HistoryEntryItem({
  entry,
  onDelete,
}: {
  entry: TireHistoryEntry;
  onDelete: () => void;
}) {
  return (
    <View style={histS.card}>
      <View style={histS.row}>
        <View style={[histS.badge, { backgroundColor: HIST_BG[entry.type] }]}>
          <Text style={[histS.badgeText, { color: HIST_COLOR[entry.type] }]}>
            {entry.type === "reforma" ? "Reforma" : "Troca"}
          </Text>
        </View>
        <Text style={histS.date}>{entry.date}</Text>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [histS.del, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="trash-2" size={13} color={Colors.light.danger} />
        </Pressable>
      </View>
      {!!entry.description && <Text style={histS.desc}>{entry.description}</Text>}
      {!!entry.cost && (
        <Text style={histS.cost}>{fmtCurrency(entry.cost)}</Text>
      )}
    </View>
  );
}
const histS = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginTop: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  date: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textMuted },
  del: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: Colors.light.dangerLight, alignItems: "center", justifyContent: "center",
  },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  cost: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },
});

// ─── Tire Card ────────────────────────────────────────────────────────────────

function TireCard({
  tire,
  onDelete,
  onDeleteHistoryEntry,
  onAddHistory,
}: {
  tire: TireRecord;
  onDelete: () => void;
  onDeleteHistoryEntry: (tireId: string, entryId: string) => void;
  onAddHistory: (tireId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={tireS.card}>
      {/* Header */}
      <View style={tireS.header}>
        <View style={[tireS.typeBadge, { backgroundColor: TYPE_BG[tire.type] }]}>
          <Feather
            name={tire.type === "pneu" ? "circle" : "minus"}
            size={12}
            color={TYPE_COLOR[tire.type]}
          />
          <Text style={[tireS.typeText, { color: TYPE_COLOR[tire.type] }]}>
            {tire.type === "pneu" ? "Pneu" : "Esteira"}
          </Text>
        </View>
        <Text style={tireS.position} numberOfLines={1}>{tire.position}</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExpanded((e) => !e);
          }}
          hitSlop={8}
          style={({ pressed }) => [tireS.expandBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.light.textSecondary} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [tireS.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="trash-2" size={14} color={Colors.light.danger} />
        </Pressable>
      </View>

      {/* Info grid */}
      <View style={tireS.grid}>
        <View style={tireS.cell}>
          <Text style={tireS.cellLabel}>Marca</Text>
          <Text style={tireS.cellValue}>{tire.brand || "—"}</Text>
        </View>
        <View style={tireS.cellDivider} />
        <View style={tireS.cell}>
          <Text style={tireS.cellLabel}>Tamanho</Text>
          <Text style={tireS.cellValue}>{tire.size || "—"}</Text>
        </View>
        <View style={tireS.cellDivider} />
        <View style={tireS.cell}>
          <Text style={tireS.cellLabel}>Instalado em</Text>
          <Text style={tireS.cellValue}>{tire.installDate || "—"}</Text>
        </View>
        <View style={tireS.cellDivider} />
        <View style={tireS.cell}>
          <Text style={tireS.cellLabel}>Vida estimada</Text>
          <Text style={tireS.cellValue}>{tire.estimatedLifeHours ? `${tire.estimatedLifeHours}h` : "—"}</Text>
        </View>
      </View>

      {!!tire.notes && !expanded && (
        <Text style={tireS.notes} numberOfLines={1}>{tire.notes}</Text>
      )}

      {/* Expanded: History */}
      {expanded && (
        <View style={tireS.historySection}>
          <View style={tireS.historyHeader}>
            <Feather name="clock" size={13} color={Colors.light.textSecondary} />
            <Text style={tireS.historyTitle}>
              Histórico de Reformas/Trocas ({tire.history.length})
            </Text>
            <Pressable
              onPress={() => onAddHistory(tire.id)}
              style={({ pressed }) => [tireS.addHistBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="plus" size={13} color={Colors.light.tint} />
              <Text style={tireS.addHistText}>Adicionar</Text>
            </Pressable>
          </View>

          {tire.history.length === 0 ? (
            <Text style={tireS.noHistory}>Nenhum registro de reforma ou troca</Text>
          ) : (
            tire.history.map((entry) => (
              <HistoryEntryItem
                key={entry.id}
                entry={entry}
                onDelete={() => onDeleteHistoryEntry(tire.id, entry.id)}
              />
            ))
          )}
          {!!tire.notes && (
            <Text style={[tireS.notes, { marginTop: 8 }]}>{tire.notes}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const tireS = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderLeftWidth: 4,
    borderLeftColor: "#0EA5E9",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  typeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  position: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  expandBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.light.dangerLight, alignItems: "center", justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  cell: { minWidth: 70, paddingHorizontal: 6, paddingVertical: 4 },
  cellDivider: { width: 1, backgroundColor: Colors.light.border, marginVertical: 2 },
  cellLabel: {
    fontSize: 9, fontFamily: "Inter_500Medium", color: Colors.light.textMuted,
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 1,
  },
  cellValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  notes: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  historySection: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 2,
  },
  historyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  historyTitle: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  addHistBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  addHistText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.tint },
  noHistory: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textMuted, paddingVertical: 4 },
});

// ─── Fuel Item ────────────────────────────────────────────────────────────────

function FuelItem({ record, onDelete, onEdit }: { record: FuelRecord; onDelete: () => void; onEdit: () => void }) {
  return (
    <View style={fuelS.card}>
      <View style={fuelS.header}>
        <View style={fuelS.iconBox}>
          <Feather name="droplet" size={18} color="#0EA5E9" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fuelS.date}>{record.date}</Text>
          {!!record.notes && <Text style={fuelS.notes} numberOfLines={1}>{record.notes}</Text>}
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [fuelS.editBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="edit-2" size={13} color="#0EA5E9" />
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [fuelS.delBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="trash-2" size={14} color={Colors.light.danger} />
        </Pressable>
      </View>
      <View style={fuelS.stats}>
        <View style={fuelS.statItem}>
          <Text style={fuelS.statValue}>{parseFloat(record.liters).toFixed(1)} L</Text>
          <Text style={fuelS.statLabel}>Quantidade</Text>
        </View>
        <View style={fuelS.statDivider} />
        <View style={fuelS.statItem}>
          <Text style={[fuelS.statValue, { color: "#7C3AED" }]}>{fmtCurrency(record.value)}</Text>
          <Text style={fuelS.statLabel}>Valor</Text>
        </View>
        {parseFloat(record.liters) > 0 && parseFloat(record.value.replace(",", ".")) > 0 && (
          <>
            <View style={fuelS.statDivider} />
            <View style={fuelS.statItem}>
              <Text style={fuelS.statValue}>
                {`${fmtCurrency(String(parseFloat(record.value.replace(",", ".")) / parseFloat(record.liters)))}/L`}
              </Text>
              <Text style={fuelS.statLabel}>Preço/L</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const fuelS = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderLeftWidth: 4,
    borderLeftColor: "#0EA5E9",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center",
  },
  date: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  notes: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 1 },
  editBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center",
  },
  delBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.light.dangerLight, alignItems: "center", justifyContent: "center",
  },
  stats: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.light.border },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.light.textMuted, textTransform: "uppercase" },
});

// ─── Add Tire Modal ───────────────────────────────────────────────────────────

function AddTireModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (t: Omit<TireRecord, "id" | "createdAt" | "history">) => void;
}) {
  const insets = useSafeAreaInsets();
  const today = new Date().toLocaleDateString("pt-BR");

  const [type, setType] = useState<TireType>("pneu");
  const [position, setPosition] = useState("");
  const [customPosition, setCustomPosition] = useState("");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [installDate, setInstallDate] = useState(today);
  const [estimatedLifeHours, setEstimatedLifeHours] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ position?: string }>({});

  const reset = () => {
    setType("pneu"); setPosition(""); setCustomPosition(""); setBrand("");
    setSize(""); setInstallDate(today); setEstimatedLifeHours(""); setNotes(""); setErrors({});
  };
  const handleClose = () => { reset(); onClose(); };

  const finalPosition = position === "Outro" ? customPosition : position;

  const handleSave = () => {
    const e: typeof errors = {};
    if (!finalPosition.trim()) e.position = "Posição é obrigatória";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ type, position: finalPosition.trim(), brand: brand.trim(), size: size.trim(), installDate: installDate.trim(), estimatedLifeHours: estimatedLifeHours.trim(), notes: notes.trim() });
    reset(); onClose();
  };

  const positions = type === "pneu" ? [...TIRE_POSITIONS, "Outro"] : [...TRACK_POSITIONS, "Outro"];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={modalS.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <View style={[modalS.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={modalS.header}>
              <Text style={modalS.title}>Cadastrar Pneu / Esteira</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => [modalS.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Feather name="x" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={modalS.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Tipo */}
              <View style={modalS.field}>
                <Text style={modalS.label}>Tipo</Text>
                <ChipRow
                  options={["pneu", "esteira"] as TireType[]}
                  value={type}
                  onChange={(v) => { setType(v); setPosition(""); }}
                  labelFn={(v) => v === "pneu" ? "Pneu" : "Esteira"}
                />
              </View>

              {/* Posição */}
              <View style={modalS.field}>
                <Text style={modalS.label}>Posição *</Text>
                <View style={chipS.row}>
                  {positions.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setPosition(p)}
                      style={[chipS.chip, position === p && chipS.chipActive]}
                    >
                      <Text style={[chipS.label, position === p && chipS.labelActive]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
                {position === "Outro" && (
                  <TextInput
                    style={[modalS.inputWrap, { marginTop: 6, height: 46 }]}
                    value={customPosition}
                    onChangeText={setCustomPosition}
                    placeholder="Descreva a posição..."
                    placeholderTextColor={Colors.light.textMuted}
                  />
                )}
                {!!errors.position && <Text style={modalS.errorText}>{errors.position}</Text>}
              </View>

              {/* Marca + Tamanho em linha */}
              <View style={modalS.row2}>
                <View style={[modalS.field, { flex: 1 }]}>
                  <Text style={modalS.label}>Marca</Text>
                  <View style={modalS.inputBox}>
                    <TextInput style={modalS.input} value={brand} onChangeText={setBrand} placeholder="Ex: Michelin" placeholderTextColor={Colors.light.textMuted} />
                  </View>
                </View>
                <View style={[modalS.field, { flex: 1 }]}>
                  <Text style={modalS.label}>Tamanho</Text>
                  <View style={modalS.inputBox}>
                    <TextInput style={modalS.input} value={size} onChangeText={setSize} placeholder="Ex: 23.5R25" placeholderTextColor={Colors.light.textMuted} />
                  </View>
                </View>
              </View>

              {/* Data instalação + Vida útil */}
              <View style={modalS.row2}>
                <View style={[modalS.field, { flex: 1 }]}>
                  <Text style={modalS.label}>Data de instalação</Text>
                  <View style={modalS.inputBox}>
                    <Feather name="calendar" size={13} color={Colors.light.textMuted} style={{ marginRight: 6 }} />
                    <TextInput style={modalS.input} value={installDate} onChangeText={setInstallDate} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.light.textMuted} />
                  </View>
                </View>
                <View style={[modalS.field, { flex: 1 }]}>
                  <Text style={modalS.label}>Vida útil estimada (h)</Text>
                  <View style={modalS.inputBox}>
                    <Feather name="clock" size={13} color={Colors.light.textMuted} style={{ marginRight: 6 }} />
                    <TextInput style={modalS.input} value={estimatedLifeHours} onChangeText={setEstimatedLifeHours} placeholder="Ex: 2000" placeholderTextColor={Colors.light.textMuted} keyboardType="numeric" />
                  </View>
                </View>
              </View>

              {/* Observações */}
              <View style={modalS.field}>
                <Text style={modalS.label}>Observações (opcional)</Text>
                <TextInput style={modalS.textArea} value={notes} onChangeText={setNotes} placeholder="Fabricante, número de série, condições..." placeholderTextColor={Colors.light.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
              </View>

              <Pressable onPress={handleSave} style={({ pressed }) => [modalS.saveBtn, { backgroundColor: "#0EA5E9", opacity: pressed ? 0.85 : 1 }]}>
                <Feather name="save" size={18} color="#fff" />
                <Text style={modalS.saveBtnText}>Cadastrar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Add History Modal ────────────────────────────────────────────────────────

function AddHistoryModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: Omit<TireHistoryEntry, "id" | "createdAt">) => void;
}) {
  const insets = useSafeAreaInsets();
  const today = new Date().toLocaleDateString("pt-BR");

  const [type, setType] = useState<HistoryType>("reforma");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [errors, setErrors] = useState<{ date?: string }>({});

  const reset = () => { setType("reforma"); setDate(today); setDescription(""); setCost(""); setErrors({}); };
  const handleClose = () => { reset(); onClose(); };
  const handleSave = () => {
    const e: typeof errors = {};
    if (!date.trim()) e.date = "Data é obrigatória";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ type, date: date.trim(), description: description.trim(), cost: cost.trim() });
    reset(); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={modalS.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <View style={[modalS.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={modalS.header}>
              <Text style={modalS.title}>Registrar Reforma / Troca</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => [modalS.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Feather name="x" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={modalS.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={modalS.field}>
                <Text style={modalS.label}>Tipo</Text>
                <ChipRow
                  options={["reforma", "troca"] as HistoryType[]}
                  value={type}
                  onChange={setType}
                  labelFn={(v) => v === "reforma" ? "Reforma" : "Troca"}
                />
              </View>
              <View style={modalS.field}>
                <Text style={modalS.label}>Data *</Text>
                <View style={[modalS.inputBox, !!errors.date && { borderColor: Colors.light.danger }]}>
                  <Feather name="calendar" size={13} color={Colors.light.textMuted} style={{ marginRight: 6 }} />
                  <TextInput style={modalS.input} value={date} onChangeText={(v) => { setDate(v); setErrors((e) => ({ ...e, date: undefined })); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.light.textMuted} />
                </View>
                {!!errors.date && <Text style={modalS.errorText}>{errors.date}</Text>}
              </View>
              <View style={modalS.field}>
                <Text style={modalS.label}>Descrição</Text>
                <TextInput style={modalS.textArea} value={description} onChangeText={setDescription} placeholder="Detalhes da reforma ou troca..." placeholderTextColor={Colors.light.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
              </View>
              <View style={modalS.field}>
                <Text style={modalS.label}>Custo (R$)</Text>
                <View style={modalS.inputBox}>
                  <Text style={{ fontSize: 13, color: Colors.light.textMuted, marginRight: 4 }}>R$</Text>
                  <TextInput style={modalS.input} value={cost} onChangeText={setCost} placeholder="0,00" placeholderTextColor={Colors.light.textMuted} keyboardType="decimal-pad" />
                </View>
              </View>
              <Pressable onPress={handleSave} style={({ pressed }) => [modalS.saveBtn, { opacity: pressed ? 0.85 : 1 }]}>
                <Feather name="save" size={18} color="#fff" />
                <Text style={modalS.saveBtnText}>Registrar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Add/Edit Fuel Modal ──────────────────────────────────────────────────────

function AddFuelModal({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (f: Omit<FuelRecord, "id" | "createdAt">) => void;
  initial?: FuelRecord | null;
}) {
  const insets = useSafeAreaInsets();
  const today = new Date().toLocaleDateString("pt-BR");
  const isEditing = !!initial;

  const [date, setDate] = useState(today);
  const [liters, setLiters] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ date?: string; liters?: string }>({});

  useEffect(() => {
    if (visible) {
      setDate(initial?.date ?? today);
      setLiters(initial?.liters ?? "");
      setValue(initial?.value ?? "");
      setNotes(initial?.notes ?? "");
      setErrors({});
    }
  }, [visible, initial]);

  const reset = () => { setDate(today); setLiters(""); setValue(""); setNotes(""); setErrors({}); };
  const handleClose = () => { reset(); onClose(); };
  const handleSave = () => {
    const e: typeof errors = {};
    if (!date.trim()) e.date = "Data é obrigatória";
    if (!liters.trim() || isNaN(parseFloat(liters))) e.liters = "Quantidade inválida";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ date: date.trim(), liters: liters.trim(), value: value.trim(), notes: notes.trim() });
    reset(); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={modalS.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <View style={[modalS.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={modalS.header}>
              <Text style={modalS.title}>{isEditing ? "Editar Abastecimento" : "Registrar Abastecimento"}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => [modalS.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Feather name="x" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={modalS.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Data */}
              <View style={modalS.field}>
                <Text style={modalS.label}>Data do Abastecimento *</Text>
                <View style={[modalS.inputBox, !!errors.date && { borderColor: Colors.light.danger }]}>
                  <Feather name="calendar" size={14} color={Colors.light.textMuted} style={{ marginRight: 8 }} />
                  <TextInput style={modalS.input} value={date} onChangeText={(v) => { setDate(v); setErrors((e) => ({ ...e, date: undefined })); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.light.textMuted} />
                </View>
                {!!errors.date && <Text style={modalS.errorText}>{errors.date}</Text>}
              </View>

              {/* Litros + Valor em linha */}
              <View style={modalS.row2}>
                <View style={[modalS.field, { flex: 1 }]}>
                  <Text style={modalS.label}>Quantidade (L) *</Text>
                  <View style={[modalS.inputBox, !!errors.liters && { borderColor: Colors.light.danger }]}>
                    <Feather name="droplet" size={13} color={Colors.light.textMuted} style={{ marginRight: 6 }} />
                    <TextInput style={modalS.input} value={liters} onChangeText={(v) => { setLiters(v); setErrors((e) => ({ ...e, liters: undefined })); }} placeholder="Ex: 250.0" placeholderTextColor={Colors.light.textMuted} keyboardType="decimal-pad" />
                  </View>
                  {!!errors.liters && <Text style={modalS.errorText}>{errors.liters}</Text>}
                </View>
                <View style={[modalS.field, { flex: 1 }]}>
                  <Text style={modalS.label}>Valor (R$)</Text>
                  <View style={modalS.inputBox}>
                    <Text style={{ fontSize: 13, color: Colors.light.textMuted, marginRight: 4 }}>R$</Text>
                    <TextInput style={modalS.input} value={value} onChangeText={setValue} placeholder="0,00" placeholderTextColor={Colors.light.textMuted} keyboardType="decimal-pad" />
                  </View>
                </View>
              </View>

              {/* Observações */}
              <View style={modalS.field}>
                <Text style={modalS.label}>Observações (opcional)</Text>
                <TextInput style={modalS.textArea} value={notes} onChangeText={setNotes} placeholder="Posto, tipo de combustível, horímetro..." placeholderTextColor={Colors.light.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
              </View>

              <Pressable onPress={handleSave} style={({ pressed }) => [modalS.saveBtn, { backgroundColor: "#0EA5E9", opacity: pressed ? 0.85 : 1 }]}>
                <Feather name="save" size={18} color="#fff" />
                <Text style={modalS.saveBtnText}>{isEditing ? "Salvar Alterações" : "Registrar Abastecimento"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const modalS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "93%",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  content: { padding: 20, gap: 14 },
  field: { gap: 6 },
  row2: { flexDirection: "row", gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  inputBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12, borderWidth: 1.5, borderColor: "transparent",
    paddingHorizontal: 14, height: 50,
  },
  inputWrap: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12, borderWidth: 1.5, borderColor: "transparent",
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.danger, marginLeft: 2 },
  textArea: {
    backgroundColor: Colors.light.surfaceSecondary, borderRadius: 12,
    padding: 14, minHeight: 80, fontSize: 14, fontFamily: "Inter_400Regular",
    color: Colors.light.text, borderWidth: 1.5, borderColor: "transparent",
  },
  saveBtn: {
    backgroundColor: Colors.light.tint, borderRadius: 14, height: 54,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TiresFuelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: machine, isLoading } = useGetMachine(id ?? "");

  const [view, setView] = useState<ScreenView>("pneus");
  const [tires, setTires] = useState<TireRecord[]>([]);
  const [fuel, setFuel] = useState<FuelRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [addTireVisible, setAddTireVisible] = useState(false);
  const [addHistoryForTireId, setAddHistoryForTireId] = useState<string | null>(null);
  const [addFuelVisible, setAddFuelVisible] = useState(false);
  const [editingFuel, setEditingFuel] = useState<FuelRecord | null>(null);
  const [deleteTireId, setDeleteTireId] = useState<string | null>(null);
  const [deleteFuelId, setDeleteFuelId] = useState<string | null>(null);
  const [deleteHistTarget, setDeleteHistTarget] = useState<{ tireId: string; entryId: string } | null>(null);

  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      const t = await AsyncStorage.getItem(tiresKey(id));
      if (t) setTires(JSON.parse(t));
    } catch (e) { console.error(e); }
    try {
      const f = await AsyncStorage.getItem(fuelKey(id));
      if (f) setFuel(JSON.parse(f));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveTires = async (updated: TireRecord[]) => {
    if (id) await AsyncStorage.setItem(tiresKey(id), JSON.stringify(updated));
  };
  const saveFuel = async (updated: FuelRecord[]) => {
    if (id) await AsyncStorage.setItem(fuelKey(id), JSON.stringify(updated));
  };

  // Tires CRUD
  const handleAddTire = async (data: Omit<TireRecord, "id" | "createdAt" | "history">) => {
    const updated = [{ ...data, id: uid(), history: [], createdAt: new Date().toISOString() }, ...tires];
    setTires(updated); await saveTires(updated);
  };
  const handleDeleteTire = async () => {
    if (!deleteTireId) return;
    const updated = tires.filter((t) => t.id !== deleteTireId);
    setTires(updated); setDeleteTireId(null); await saveTires(updated);
  };

  // Tire history CRUD
  const handleAddHistoryEntry = async (entry: Omit<TireHistoryEntry, "id" | "createdAt">) => {
    if (!addHistoryForTireId) return;
    const updated = tires.map((t) =>
      t.id === addHistoryForTireId
        ? { ...t, history: [{ ...entry, id: uid(), createdAt: new Date().toISOString() }, ...t.history] }
        : t
    );
    setTires(updated); await saveTires(updated);
  };
  const handleDeleteHistoryEntry = (tireId: string, entryId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteHistTarget({ tireId, entryId });
  };
  const confirmDeleteHistoryEntry = async () => {
    if (!deleteHistTarget) return;
    const updated = tires.map((t) =>
      t.id === deleteHistTarget.tireId
        ? { ...t, history: t.history.filter((e) => e.id !== deleteHistTarget.entryId) }
        : t
    );
    setTires(updated); setDeleteHistTarget(null); await saveTires(updated);
  };

  // Fuel CRUD
  const handleAddFuel = async (data: Omit<FuelRecord, "id" | "createdAt">) => {
    if (editingFuel) {
      const updated = fuel.map((f) => f.id === editingFuel.id ? { ...editingFuel, ...data } : f);
      setFuel(updated); setEditingFuel(null); await saveFuel(updated);
    } else {
      const updated = [{ ...data, id: uid(), createdAt: new Date().toISOString() }, ...fuel];
      setFuel(updated); await saveFuel(updated);
    }
  };
  const confirmDeleteFuel = async () => {
    if (!deleteFuelId) return;
    const updated = fuel.filter((f) => f.id !== deleteFuelId);
    setFuel(updated); setDeleteFuelId(null); await saveFuel(updated);
  };

  // Fuel summary
  const totalLiters = fuel.reduce((s, f) => s + (parseFloat(f.liters) || 0), 0);
  const totalValue = fuel.reduce((s, f) => s + (parseFloat(f.value.replace(",", ".")) || 0), 0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading || loading) {
    return (
      <View style={[s.loadingView, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }
  if (!machine) {
    return (
      <View style={[s.loadingView, { paddingTop: topPad }]}>
        <Text style={s.errorText}>Máquina não encontrada</Text>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={16} color="#0EA5E9" />
          <Text style={[s.backBtnText, { color: "#0EA5E9" }]}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [s.headerBack, { opacity: pressed ? 0.6 : 1 }]}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>Pneus & Combustível</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (view === "pneus") setAddTireVisible(true);
            else setAddFuelVisible(true);
          }}
          style={({ pressed }) => [s.addBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Machine card */}
      <View style={s.machineCard}>
        <View style={s.machineIconBox}>
          <Feather name="truck" size={22} color="#0EA5E9" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.machineModel}>{machine.model}</Text>
          <Text style={s.machineBrand}>{machine.brand} · {machine.year}</Text>
        </View>
      </View>

      {/* Segment control */}
      <View style={s.segmentRow}>
        <Pressable onPress={() => setView("pneus")} style={[s.segment, view === "pneus" && s.segmentActive]}>
          <Feather name="circle" size={14} color={view === "pneus" ? "#0EA5E9" : Colors.light.textSecondary} />
          <Text style={[s.segmentText, view === "pneus" && s.segmentTextActive]}>Pneus / Esteira</Text>
          {tires.length > 0 && (
            <View style={[s.badge, view === "pneus" && s.badgeActive]}>
              <Text style={[s.badgeText, view === "pneus" && s.badgeTextActive]}>{tires.length}</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => setView("combustivel")} style={[s.segment, view === "combustivel" && s.segmentActive]}>
          <Feather name="droplet" size={14} color={view === "combustivel" ? "#0EA5E9" : Colors.light.textSecondary} />
          <Text style={[s.segmentText, view === "combustivel" && s.segmentTextActive]}>Combustível</Text>
          {fuel.length > 0 && (
            <View style={[s.badge, view === "combustivel" && s.badgeActive]}>
              <Text style={[s.badgeText, view === "combustivel" && s.badgeTextActive]}>{fuel.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ─── Pneus / Esteira ─── */}
      {view === "pneus" && (
        <FlatList
          data={tires}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TireCard
              tire={item}
              onDelete={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setDeleteTireId(item.id); }}
              onDeleteHistoryEntry={handleDeleteHistoryEntry}
              onAddHistory={(tid) => setAddHistoryForTireId(tid)}
            />
          )}
          contentContainerStyle={[s.listContent, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIcon}><Feather name="circle" size={28} color={Colors.light.textMuted} /></View>
              <Text style={s.emptyTitle}>Nenhum pneu/esteira cadastrado</Text>
              <Text style={s.emptyText}>Toque em + para cadastrar o primeiro</Text>
            </View>
          }
        />
      )}

      {/* ─── Combustível ─── */}
      {view === "combustivel" && (
        <>
          {/* Resumo de combustível */}
          {fuel.length > 0 && (
            <View style={s.fuelSummary}>
              <View style={s.fuelSumItem}>
                <Feather name="droplet" size={16} color="#0EA5E9" />
                <View>
                  <Text style={s.fuelSumValue}>{totalLiters.toFixed(1)} L</Text>
                  <Text style={s.fuelSumLabel}>Total abastecido</Text>
                </View>
              </View>
              <View style={s.fuelSumDivider} />
              <View style={s.fuelSumItem}>
                <Feather name="dollar-sign" size={16} color="#7C3AED" />
                <View>
                  <Text style={[s.fuelSumValue, { color: "#7C3AED" }]}>{fmtCurrency(String(totalValue))}</Text>
                  <Text style={s.fuelSumLabel}>Total gasto</Text>
                </View>
              </View>
              <View style={s.fuelSumDivider} />
              <View style={s.fuelSumItem}>
                <Feather name="list" size={16} color={Colors.light.textSecondary} />
                <View>
                  <Text style={s.fuelSumValue}>{fuel.length}</Text>
                  <Text style={s.fuelSumLabel}>Abastecimentos</Text>
                </View>
              </View>
            </View>
          )}

          <FlatList
            data={fuel}
            keyExtractor={(f) => f.id}
            renderItem={({ item }) => (
              <FuelItem
                record={item}
                onDelete={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setDeleteFuelId(item.id); }}
                onEdit={() => { setEditingFuel(item); setAddFuelVisible(true); }}
              />
            )}
            contentContainerStyle={[s.listContent, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyState}>
                <View style={s.emptyIcon}><Feather name="droplet" size={28} color={Colors.light.textMuted} /></View>
                <Text style={s.emptyTitle}>Nenhum abastecimento registrado</Text>
                <Text style={s.emptyText}>Toque em + para registrar o primeiro abastecimento</Text>
              </View>
            }
          />
        </>
      )}

      {/* Modals */}
      <AddTireModal visible={addTireVisible} onClose={() => setAddTireVisible(false)} onSave={handleAddTire} />
      <AddHistoryModal
        visible={addHistoryForTireId !== null}
        onClose={() => setAddHistoryForTireId(null)}
        onSave={handleAddHistoryEntry}
      />
      <AddFuelModal
        visible={addFuelVisible}
        onClose={() => { setAddFuelVisible(false); setEditingFuel(null); }}
        onSave={handleAddFuel}
        initial={editingFuel}
      />
      <ConfirmModal
        visible={deleteTireId !== null}
        title="Excluir pneu/esteira"
        message="Deseja excluir este registro e todo seu histórico?"
        confirmLabel="Excluir"
        onConfirm={handleDeleteTire}
        onCancel={() => setDeleteTireId(null)}
      />
      <ConfirmModal
        visible={deleteFuelId !== null}
        title="Excluir abastecimento"
        message="Deseja excluir este registro de abastecimento?"
        confirmLabel="Excluir"
        onConfirm={confirmDeleteFuel}
        onCancel={() => setDeleteFuelId(null)}
      />
      <ConfirmModal
        visible={deleteHistTarget !== null}
        title="Excluir registro"
        message="Deseja excluir este registro do histórico?"
        confirmLabel="Excluir"
        onConfirm={confirmDeleteHistoryEntry}
        onCancel={() => setDeleteHistTarget(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  loadingView: { flex: 1, backgroundColor: Colors.light.background, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#0EA5E9",
  },
  backBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  headerBack: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text },
  addBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#0EA5E9",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0EA5E9", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  machineCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginBottom: 12, padding: 14,
    backgroundColor: Colors.light.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border,
  },
  machineIconBox: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: "#E0F2FE",
    alignItems: "center", justifyContent: "center",
  },
  machineModel: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },
  machineBrand: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  segmentRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.light.surfaceSecondary, borderRadius: 14, padding: 4,
  },
  segment: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: Colors.light.surface,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  segmentText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  segmentTextActive: { color: "#0EA5E9", fontFamily: "Inter_600SemiBold" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.light.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeActive: { backgroundColor: "#E0F2FE" },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.light.textSecondary },
  badgeTextActive: { color: "#0369A1" },
  fuelSummary: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.light.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  fuelSumItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  fuelSumDivider: { width: 1, height: 36, backgroundColor: Colors.light.border },
  fuelSumValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.light.text },
  fuelSumLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.light.textMuted },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.light.text, textAlign: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },
});
