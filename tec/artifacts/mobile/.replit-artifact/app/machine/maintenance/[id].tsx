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

// ─── Types ───────────────────────────────────────────────────────────────────

type MaintenanceType = "preventiva" | "corretiva";
type MaintenanceStatus = "pendente" | "em_andamento" | "resolvida";
type Priority = "baixa" | "media" | "alta";

interface MaintenanceRecord {
  id: string;
  osNumber: string;
  type: MaintenanceType;
  title: string;
  description: string;
  date: string;
  status: MaintenanceStatus;
  priority: Priority;
  createdAt: string;
}

interface PartRecord {
  id: string;
  partName: string;
  category: string;
  quantity: string;
  date: string;
  cost: string;
  notes: string;
  createdAt: string;
}

type ScreenView = "manutencoes" | "pecas";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const maintKey      = (mid: string) => getScopedKey(`maintenance_${mid}`);
const partsKey      = (mid: string) => getScopedKey(`parts_${mid}`);
const osCounterKey  = (mid: string) => getScopedKey(`maintenance_os_counter_${mid}`);
const reminderKey   = (mid: string) => getScopedKey(`maintenance_reminder_${mid}`);

const TYPE_LABELS: Record<MaintenanceType, string> = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
};
const TYPE_COLORS: Record<MaintenanceType, string> = {
  preventiva: "#0EA5E9",
  corretiva: Colors.light.danger,
};
const TYPE_BG: Record<MaintenanceType, string> = {
  preventiva: "#E0F2FE",
  corretiva: Colors.light.dangerLight,
};
const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
};
const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  pendente: Colors.light.warning,
  em_andamento: Colors.light.tint,
  resolvida: Colors.light.success,
};
const STATUS_BG: Record<MaintenanceStatus, string> = {
  pendente: "#FEF3C7",
  em_andamento: "#2A2200",
  resolvida: Colors.light.successLight,
};
const PRIORITY_LABELS: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};
const PRIORITY_COLORS: Record<Priority, string> = {
  baixa: Colors.light.success,
  media: Colors.light.warning,
  alta: Colors.light.danger,
};

const PART_CATEGORIES = ["Motor", "Hidráulico", "Elétrico", "Freios", "Transmissão", "Estrutura", "Outro"];

// ─── Chip Selector ────────────────────────────────────────────────────────────

function ChipSelector<T extends string>({
  options,
  value,
  onChange,
  labelMap,
  colorMap,
  bgMap,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labelMap: Record<T, string>;
  colorMap: Record<T, string>;
  bgMap?: Record<T, string>;
}) {
  return (
    <View style={chipStyles.row}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          style={[
            chipStyles.chip,
            value === opt && {
              backgroundColor: bgMap?.[opt] ?? "#f0f0f0",
              borderColor: colorMap[opt],
            },
          ]}
        >
          <View style={[chipStyles.dot, { backgroundColor: value === opt ? colorMap[opt] : Colors.light.textMuted }]} />
          <Text style={[chipStyles.label, value === opt && { color: colorMap[opt], fontFamily: "Inter_600SemiBold" }]}>
            {labelMap[opt]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
});

// ─── Maintenance Item ─────────────────────────────────────────────────────────

function MaintenanceItem({
  record,
  onDelete,
  onEdit,
  onToggleStatus,
}: {
  record: MaintenanceRecord;
  onDelete: () => void;
  onEdit: () => void;
  onToggleStatus: (next: MaintenanceStatus) => void;
}) {
  const statusCycle: MaintenanceStatus[] = ["pendente", "em_andamento", "resolvida"];
  const nextStatus = statusCycle[(statusCycle.indexOf(record.status) + 1) % statusCycle.length];

  return (
    <View style={recStyles.card}>
      <View style={recStyles.row}>
        {!!record.osNumber && (
          <View style={recStyles.osBadge}>
            <Text style={recStyles.osText}>{record.osNumber}</Text>
          </View>
        )}
        <View style={[recStyles.typeBadge, { backgroundColor: TYPE_BG[record.type] }]}>
          <Text style={[recStyles.typeText, { color: TYPE_COLORS[record.type] }]}>
            {TYPE_LABELS[record.type]}
          </Text>
        </View>
        <View style={[recStyles.priorityDot, { backgroundColor: PRIORITY_COLORS[record.priority] }]} />
        <Text style={recStyles.priorityText}>{PRIORITY_LABELS[record.priority]}</Text>
        <Text style={recStyles.date}>{record.date}</Text>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [recStyles.editBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="edit-2" size={13} color="#7C3AED" />
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [recStyles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="trash-2" size={14} color={Colors.light.danger} />
        </Pressable>
      </View>
      <Text style={recStyles.title}>{record.title}</Text>
      {!!record.description && <Text style={recStyles.description}>{record.description}</Text>}
      <Pressable
        onPress={() => onToggleStatus(nextStatus)}
        style={({ pressed }) => [recStyles.statusBtn, { backgroundColor: STATUS_BG[record.status], opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[recStyles.statusDot, { backgroundColor: STATUS_COLORS[record.status] }]} />
        <Text style={[recStyles.statusText, { color: STATUS_COLORS[record.status] }]}>
          {STATUS_LABELS[record.status]}
        </Text>
        <Feather name="refresh-cw" size={12} color={STATUS_COLORS[record.status]} style={{ marginLeft: 4 }} />
      </Pressable>
    </View>
  );
}

const recStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  osBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: "#EDE9FE", borderWidth: 1.5, borderColor: "#C4B5FD",
  },
  osText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#6D28D9", letterSpacing: 0.4 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  typeText: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  priorityDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 4 },
  priorityText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  date: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textMuted, textAlign: "right" },
  editBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.light.dangerLight, alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  description: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, lineHeight: 19 },
  statusBtn: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

// ─── Part Item ────────────────────────────────────────────────────────────────

function PartItem({
  part,
  onDelete,
  onEdit,
}: {
  part: PartRecord;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <View style={partStyles.card}>
      <View style={partStyles.header}>
        <View style={partStyles.iconBox}>
          <Feather name="package" size={18} color="#7C3AED" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={partStyles.name}>{part.partName}</Text>
          <Text style={partStyles.category}>{part.category}</Text>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [partStyles.editBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="edit-2" size={13} color="#7C3AED" />
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [partStyles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="trash-2" size={14} color={Colors.light.danger} />
        </Pressable>
      </View>

      <View style={partStyles.divider} />

      <View style={partStyles.infoRow}>
        <View style={partStyles.infoCell}>
          <Text style={partStyles.infoLabel}>Quantidade</Text>
          <Text style={partStyles.infoValue}>{part.quantity} un.</Text>
        </View>
        {!!part.cost && (
          <>
            <View style={partStyles.infoDivider} />
            <View style={partStyles.infoCell}>
              <Text style={partStyles.infoLabel}>Custo</Text>
              <Text style={partStyles.infoValue}>R$ {part.cost}</Text>
            </View>
          </>
        )}
        <View style={partStyles.infoDivider} />
        <View style={partStyles.infoCell}>
          <Text style={partStyles.infoLabel}>Data</Text>
          <Text style={partStyles.infoValue}>{part.date}</Text>
        </View>
      </View>

      {!!part.notes && (
        <Text style={partStyles.notes}>{part.notes}</Text>
      )}
    </View>
  );
}

const partStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderLeftWidth: 4,
    borderLeftColor: "#7C3AED",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  category: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 1 },
  editBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center",
    marginRight: 4,
  },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.light.dangerLight, alignItems: "center", justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: Colors.light.border },
  infoRow: { flexDirection: "row", alignItems: "center" },
  infoCell: { flex: 1, alignItems: "center", gap: 2 },
  infoDivider: { width: 1, height: 28, backgroundColor: Colors.light.border },
  infoLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.light.textMuted, textTransform: "uppercase" },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  notes: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, lineHeight: 19,
    paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
});

// ─── Add/Edit Maintenance Modal ────────────────────────────────────────────────

function AddMaintenanceModal({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (record: Omit<MaintenanceRecord, "id" | "createdAt" | "osNumber">) => void;
  initial?: MaintenanceRecord | null;
}) {
  const insets = useSafeAreaInsets();
  const today = new Date().toLocaleDateString("pt-BR");
  const isEditing = !!initial;

  const [type, setType] = useState<MaintenanceType>("preventiva");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<MaintenanceStatus>("pendente");
  const [priority, setPriority] = useState<Priority>("media");
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});

  useEffect(() => {
    if (visible) {
      if (initial) {
        setType(initial.type); setTitle(initial.title); setDescription(initial.description);
        setDate(initial.date); setStatus(initial.status); setPriority(initial.priority);
      } else {
        setType("preventiva"); setTitle(""); setDescription("");
        setDate(today); setStatus("pendente"); setPriority("media");
      }
      setErrors({});
    }
  }, [visible, initial]);

  const handleClose = () => { onClose(); };
  const handleSave = () => {
    const e: typeof errors = {};
    if (!title.trim()) e.title = "Título é obrigatório";
    if (!date.trim()) e.date = "Data é obrigatória";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ type, title: title.trim(), description: description.trim(), date: date.trim(), status, priority });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={addStyles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <View style={[addStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={addStyles.sheetHeader}>
              <Text style={addStyles.sheetTitle}>{isEditing ? "Editar Manutenção" : "Nova Manutenção"}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => [addStyles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Feather name="x" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={addStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Tipo</Text>
                <ChipSelector
                  options={["preventiva", "corretiva"] as MaintenanceType[]}
                  value={type} onChange={setType}
                  labelMap={TYPE_LABELS} colorMap={TYPE_COLORS} bgMap={TYPE_BG}
                />
              </View>
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Título *</Text>
                <View style={[addStyles.inputWrap, !!errors.title && addStyles.inputError]}>
                  <TextInput
                    style={addStyles.input} value={title}
                    onChangeText={(v) => { setTitle(v); setErrors((e) => ({ ...e, title: undefined })); }}
                    placeholder="Ex: Troca de óleo, Correia do motor..."
                    placeholderTextColor={Colors.light.textMuted}
                  />
                </View>
                {!!errors.title && <Text style={addStyles.errorText}>{errors.title}</Text>}
              </View>
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Descrição (opcional)</Text>
                <TextInput
                  style={addStyles.textArea} value={description} onChangeText={setDescription}
                  placeholder="Detalhes, peças, observações..." placeholderTextColor={Colors.light.textMuted}
                  multiline numberOfLines={3} textAlignVertical="top"
                />
              </View>
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Data *</Text>
                <View style={[addStyles.inputWrap, !!errors.date && addStyles.inputError]}>
                  <Feather name="calendar" size={15} color={Colors.light.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={addStyles.input} value={date}
                    onChangeText={(v) => { setDate(v); setErrors((e) => ({ ...e, date: undefined })); }}
                    placeholder="DD/MM/AAAA" placeholderTextColor={Colors.light.textMuted}
                  />
                </View>
                {!!errors.date && <Text style={addStyles.errorText}>{errors.date}</Text>}
              </View>
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Prioridade</Text>
                <ChipSelector
                  options={["baixa", "media", "alta"] as Priority[]}
                  value={priority} onChange={setPriority}
                  labelMap={PRIORITY_LABELS} colorMap={PRIORITY_COLORS}
                />
              </View>
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Status inicial</Text>
                <ChipSelector
                  options={["pendente", "em_andamento", "resolvida"] as MaintenanceStatus[]}
                  value={status} onChange={setStatus}
                  labelMap={STATUS_LABELS} colorMap={STATUS_COLORS} bgMap={STATUS_BG}
                />
              </View>
              <Pressable onPress={handleSave} style={({ pressed }) => [addStyles.saveBtn, { opacity: pressed ? 0.85 : 1 }]}>
                <Feather name="save" size={18} color="#fff" />
                <Text style={addStyles.saveBtnText}>{isEditing ? "Salvar Alterações" : "Registrar Manutenção"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Add/Edit Part Modal ───────────────────────────────────────────────────────

function AddPartModal({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (part: Omit<PartRecord, "id" | "createdAt">) => void;
  initial?: PartRecord | null;
}) {
  const insets = useSafeAreaInsets();
  const today = new Date().toLocaleDateString("pt-BR");
  const isEditing = !!initial;

  const [partName, setPartName] = useState("");
  const [category, setCategory] = useState("Motor");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(today);
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ partName?: string; quantity?: string; date?: string }>({});

  useEffect(() => {
    if (visible) {
      if (initial) {
        setPartName(initial.partName); setCategory(initial.category); setQuantity(initial.quantity);
        setDate(initial.date); setCost(initial.cost); setNotes(initial.notes);
      } else {
        setPartName(""); setCategory("Motor"); setQuantity("1");
        setDate(today); setCost(""); setNotes("");
      }
      setErrors({});
    }
  }, [visible, initial]);

  const handleClose = () => { onClose(); };
  const handleSave = () => {
    const e: typeof errors = {};
    if (!partName.trim()) e.partName = "Nome da peça é obrigatório";
    if (!quantity.trim() || isNaN(Number(quantity))) e.quantity = "Quantidade inválida";
    if (!date.trim()) e.date = "Data é obrigatória";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ partName: partName.trim(), category, quantity: quantity.trim(), date: date.trim(), cost: cost.trim(), notes: notes.trim() });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={addStyles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <View style={[addStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={addStyles.sheetHeader}>
              <Text style={addStyles.sheetTitle}>{isEditing ? "Editar Peça" : "Registrar Peça Trocada"}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => [addStyles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Feather name="x" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={addStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Nome */}
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Nome da Peça *</Text>
                <View style={[addStyles.inputWrap, !!errors.partName && addStyles.inputError]}>
                  <Feather name="package" size={15} color={Colors.light.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={addStyles.input} value={partName}
                    onChangeText={(v) => { setPartName(v); setErrors((e) => ({ ...e, partName: undefined })); }}
                    placeholder="Ex: Filtro de óleo, Correia dentada..."
                    placeholderTextColor={Colors.light.textMuted}
                  />
                </View>
                {!!errors.partName && <Text style={addStyles.errorText}>{errors.partName}</Text>}
              </View>

              {/* Categoria */}
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Categoria</Text>
                <View style={addStyles.catRow}>
                  {PART_CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[addStyles.catChip, category === cat && addStyles.catChipActive]}
                    >
                      <Text style={[addStyles.catChipText, category === cat && addStyles.catChipTextActive]}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Quantidade + Custo em linha */}
              <View style={addStyles.row2}>
                <View style={[addStyles.field, { flex: 1 }]}>
                  <Text style={addStyles.label}>Quantidade *</Text>
                  <View style={[addStyles.inputWrap, !!errors.quantity && addStyles.inputError]}>
                    <Feather name="hash" size={15} color={Colors.light.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={addStyles.input} value={quantity}
                      onChangeText={(v) => { setQuantity(v); setErrors((e) => ({ ...e, quantity: undefined })); }}
                      placeholder="1" placeholderTextColor={Colors.light.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  {!!errors.quantity && <Text style={addStyles.errorText}>{errors.quantity}</Text>}
                </View>
                <View style={[addStyles.field, { flex: 1 }]}>
                  <Text style={addStyles.label}>Custo (R$)</Text>
                  <View style={addStyles.inputWrap}>
                    <Text style={{ fontSize: 13, color: Colors.light.textMuted, marginRight: 4 }}>R$</Text>
                    <TextInput
                      style={addStyles.input} value={cost} onChangeText={setCost}
                      placeholder="0,00" placeholderTextColor={Colors.light.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Data */}
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Data da Troca *</Text>
                <View style={[addStyles.inputWrap, !!errors.date && addStyles.inputError]}>
                  <Feather name="calendar" size={15} color={Colors.light.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={addStyles.input} value={date}
                    onChangeText={(v) => { setDate(v); setErrors((e) => ({ ...e, date: undefined })); }}
                    placeholder="DD/MM/AAAA" placeholderTextColor={Colors.light.textMuted}
                  />
                </View>
                {!!errors.date && <Text style={addStyles.errorText}>{errors.date}</Text>}
              </View>

              {/* Observações */}
              <View style={addStyles.field}>
                <Text style={addStyles.label}>Observações (opcional)</Text>
                <TextInput
                  style={addStyles.textArea} value={notes} onChangeText={setNotes}
                  placeholder="Motivo da troca, fornecedor, número de série da peça..."
                  placeholderTextColor={Colors.light.textMuted} multiline numberOfLines={3} textAlignVertical="top"
                />
              </View>

              <Pressable onPress={handleSave} style={({ pressed }) => [addStyles.saveBtnPurple, { opacity: pressed ? 0.85 : 1 }]}>
                <Feather name="save" size={18} color="#fff" />
                <Text style={addStyles.saveBtnText}>{isEditing ? "Salvar Alterações" : "Registrar Peça"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const addStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "93%",
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  content: { padding: 20, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12, borderWidth: 1.5, borderColor: "transparent",
    paddingHorizontal: 14, height: 50,
  },
  inputError: { borderColor: Colors.light.danger, backgroundColor: Colors.light.dangerLight },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.danger, marginLeft: 2 },
  textArea: {
    backgroundColor: Colors.light.surfaceSecondary, borderRadius: 12, padding: 14,
    minHeight: 80, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text,
    borderWidth: 1.5, borderColor: "transparent",
  },
  row2: { flexDirection: "row", gap: 10 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary, borderWidth: 1.5, borderColor: "transparent",
  },
  catChipActive: { backgroundColor: "#EDE9FE", borderColor: "#7C3AED" },
  catChipText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  catChipTextActive: { color: "#7C3AED", fontFamily: "Inter_600SemiBold" },
  saveBtn: {
    backgroundColor: Colors.light.tint, borderRadius: 14, height: 54,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, marginTop: 4,
  },
  saveBtnPurple: {
    backgroundColor: "#7C3AED", borderRadius: 14, height: 54,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

// ─── Reminder Types ───────────────────────────────────────────────────────────

interface ReminderItem {
  id: string;
  text: string;
  createdAt: string;
}

// ─── Reminder Modal ───────────────────────────────────────────────────────────

function ReminderModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");

  useEffect(() => {
    if (visible) setText("");
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={remS.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <View style={[remS.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={remS.header}>
              <Feather name="bell" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={remS.title}>Lembrete de Manutenção</Text>
              <Pressable onPress={onClose} style={({ pressed }) => [remS.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Feather name="x" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <Text style={remS.subtitle}>
              O lembrete aparecerá no topo da aba de manutenção. Você pode adicionar quantos quiser.
            </Text>
            <TextInput
              style={remS.textArea}
              value={text}
              onChangeText={setText}
              placeholder="Ex: Verificar óleo a cada 250h, trocar filtro em agosto..."
              placeholderTextColor={Colors.light.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoFocus
            />
            <View style={remS.actions}>
              <Pressable onPress={onClose} style={({ pressed }) => [remS.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}>
                <Text style={remS.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (text.trim()) onSave(text.trim()); }}
                style={({ pressed }) => [remS.saveBtn, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={remS.saveText}>Salvar lembrete</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const remS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, gap: 14,
  },
  header: { flexDirection: "row", alignItems: "center" },
  title: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  subtitle: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, lineHeight: 18,
  },
  textArea: {
    backgroundColor: Colors.light.surfaceSecondary, borderRadius: 14, padding: 14,
    minHeight: 110, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text,
    borderWidth: 1.5, borderColor: "#FDE68A",
  },
  actions: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.light.border,
    alignItems: "center", justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  saveBtn: {
    flex: 2, height: 48, borderRadius: 12,
    backgroundColor: "#F59E0B", flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  saveText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MaintenanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data: machine, isLoading } = useGetMachine(id ?? "");

  // Manutenções
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [addMaintVisible, setAddMaintVisible] = useState(false);
  const [deleteMaintId, setDeleteMaintId] = useState<string | null>(null);
  const [editingMaint, setEditingMaint] = useState<MaintenanceRecord | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "preventiva" | "corretiva">("all");

  // Peças
  const [parts, setParts] = useState<PartRecord[]>([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [addPartVisible, setAddPartVisible] = useState(false);
  const [deletePartId, setDeletePartId] = useState<string | null>(null);
  const [editingPart, setEditingPart] = useState<PartRecord | null>(null);

  // Lembretes (lista)
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [deleteReminderConfirmId, setDeleteReminderConfirmId] = useState<string | null>(null);

  // Visão ativa
  const [view, setView] = useState<ScreenView>("manutencoes");

  // ── Carregar dados ──
  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      const rawMaint = await AsyncStorage.getItem(maintKey(id));
      if (rawMaint) setRecords(JSON.parse(rawMaint));
    } catch (e) { console.error(e); }
    try {
      const rawParts = await AsyncStorage.getItem(partsKey(id));
      if (rawParts) setParts(JSON.parse(rawParts));
    } catch (e) { console.error(e); }
    try {
      const rawReminders = await AsyncStorage.getItem(reminderKey(id));
      if (rawReminders) setReminders(JSON.parse(rawReminders));
    } catch (e) { console.error(e); }
    setLoadingRecords(false);
    setLoadingParts(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveMaint = async (updated: MaintenanceRecord[]) => {
    if (!id) return;
    await AsyncStorage.setItem(maintKey(id), JSON.stringify(updated));
  };
  const saveParts = async (updated: PartRecord[]) => {
    if (!id) return;
    await AsyncStorage.setItem(partsKey(id), JSON.stringify(updated));
  };

  // ── Manutenções ──
  const handleAddMaint = async (data: Omit<MaintenanceRecord, "id" | "createdAt" | "osNumber">) => {
    if (editingMaint) {
      const updated = records.map((r) => r.id === editingMaint.id ? { ...editingMaint, ...data } : r);
      setRecords(updated); setEditingMaint(null); await saveMaint(updated);
    } else {
      const rawCounter = await AsyncStorage.getItem(osCounterKey(id!));
      const counter = rawCounter ? parseInt(rawCounter, 10) + 1 : 1;
      await AsyncStorage.setItem(osCounterKey(id!), String(counter));
      const osNumber = `OS${counter.toString().padStart(3, "0")}`;
      const r: MaintenanceRecord = {
        ...data,
        osNumber,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        createdAt: new Date().toISOString(),
      };
      const updated = [r, ...records];
      setRecords(updated); await saveMaint(updated);
    }
  };

  // ── Lembretes ──
  const handleSaveReminder = async (text: string) => {
    if (!id) return;
    const newItem: ReminderItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text,
      createdAt: new Date().toISOString(),
    };
    const updated = [...reminders, newItem];
    await AsyncStorage.setItem(reminderKey(id), JSON.stringify(updated));
    setReminders(updated);
    setReminderVisible(false);
  };
  const handleDeleteReminder = async (remId: string) => {
    if (!id) return;
    const updated = reminders.filter((r) => r.id !== remId);
    if (updated.length === 0) {
      await AsyncStorage.removeItem(reminderKey(id));
    } else {
      await AsyncStorage.setItem(reminderKey(id), JSON.stringify(updated));
    }
    setReminders(updated);
    setDeleteReminderConfirmId(null);
  };
  const handleDeleteMaint = (rid: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteMaintId(rid);
  };
  const confirmDeleteMaint = async () => {
    if (!deleteMaintId) return;
    const updated = records.filter((r) => r.id !== deleteMaintId);
    setRecords(updated); setDeleteMaintId(null); await saveMaint(updated);
  };
  const handleToggleStatus = async (rid: string, next: MaintenanceStatus) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = records.map((r) => r.id === rid ? { ...r, status: next } : r);
    setRecords(updated); await saveMaint(updated);
  };

  // ── Peças ──
  const handleAddPart = async (data: Omit<PartRecord, "id" | "createdAt">) => {
    if (editingPart) {
      const updated = parts.map((p) => p.id === editingPart.id ? { ...editingPart, ...data } : p);
      setParts(updated); setEditingPart(null); await saveParts(updated);
    } else {
      const p: PartRecord = {
        ...data,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        createdAt: new Date().toISOString(),
      };
      const updated = [p, ...parts];
      setParts(updated); await saveParts(updated);
    }
  };
  const handleDeletePart = (pid: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeletePartId(pid);
  };
  const confirmDeletePart = async () => {
    if (!deletePartId) return;
    const updated = parts.filter((p) => p.id !== deletePartId);
    setParts(updated); setDeletePartId(null); await saveParts(updated);
  };

  const filteredRecords = activeFilter === "all" ? records : records.filter((r) => r.type === activeFilter);

  const pending = records.filter((r) => r.status !== "resolvida");
  const resolved = records.filter((r) => r.status === "resolvida");
  const totalCost = parts.reduce((sum, p) => {
    const v = parseFloat(p.cost.replace(",", "."));
    return isNaN(v) ? sum : sum + v;
  }, 0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[screen.loadingView, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (!machine) {
    return (
      <View style={[screen.loadingView, { paddingTop: topPad }]}>
        <Text style={screen.errorText}>Máquina não encontrada</Text>
        <Pressable onPress={() => router.back()} style={screen.backBtn}>
          <Feather name="arrow-left" size={16} color="#7C3AED" />
          <Text style={[screen.backBtnText, { color: "#7C3AED" }]}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[screen.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={screen.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [screen.headerBack, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={screen.headerTitle} numberOfLines={1}>Manutenção</Text>
        <Pressable
          onPress={() => setReminderVisible(true)}
          style={({ pressed }) => [screen.reminderBtn, reminders.length > 0 ? screen.reminderBtnActive : {}, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="bell" size={18} color={reminders.length > 0 ? "#F59E0B" : Colors.light.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (view === "manutencoes") setAddMaintVisible(true);
            else setAddPartVisible(true);
          }}
          style={({ pressed }) => [screen.addBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Machine card */}
      <View style={screen.machineCard}>
        <View style={screen.machineIconBox}>
          <Feather name="tool" size={22} color="#7C3AED" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={screen.machineModel}>{machine.model}</Text>
          <Text style={screen.machineBrand}>{machine.brand} · {machine.year}</Text>
        </View>
      </View>

      {/* Segment control: Manutenções / Peças Trocadas */}
      <View style={screen.segmentRow}>
        <Pressable
          onPress={() => setView("manutencoes")}
          style={[screen.segment, view === "manutencoes" && screen.segmentActive]}
        >
          <Feather name="tool" size={15} color={view === "manutencoes" ? "#7C3AED" : Colors.light.textSecondary} />
          <Text style={[screen.segmentText, view === "manutencoes" && screen.segmentTextActive]}>
            Manutenções
          </Text>
          {records.length > 0 && (
            <View style={[screen.badge, view === "manutencoes" && screen.badgeActive]}>
              <Text style={[screen.badgeText, view === "manutencoes" && screen.badgeTextActive]}>
                {records.length}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => setView("pecas")}
          style={[screen.segment, view === "pecas" && screen.segmentActive]}
        >
          <Feather name="package" size={15} color={view === "pecas" ? "#7C3AED" : Colors.light.textSecondary} />
          <Text style={[screen.segmentText, view === "pecas" && screen.segmentTextActive]}>
            Peças Trocadas
          </Text>
          {parts.length > 0 && (
            <View style={[screen.badge, view === "pecas" && screen.badgeActive]}>
              <Text style={[screen.badgeText, view === "pecas" && screen.badgeTextActive]}>
                {parts.length}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ─── Reminder Banners ─── */}
      {reminders.length > 0 && (
        <View style={screen.reminderContainer}>
          <View style={screen.reminderHeaderRow}>
            <Feather name="bell" size={13} color="#92400E" />
            <Text style={screen.reminderHeaderText}>
              {reminders.length} lembrete{reminders.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {reminders.map((rem) => (
            <View key={rem.id} style={screen.reminderBanner}>
              <Text style={screen.reminderText}>{rem.text}</Text>
              <Pressable
                onPress={() => setDeleteReminderConfirmId(rem.id)}
                hitSlop={8}
                style={({ pressed }) => [screen.reminderDelBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="x" size={14} color="#92400E" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* ─── Visão: Manutenções ─── */}
      {view === "manutencoes" && (
        <>
          {/* Stats */}
          <View style={screen.statsRow}>
            <View style={[screen.statBox, { backgroundColor: "#FEF3C7" }]}>
              <Text style={[screen.statNumber, { color: Colors.light.warning }]}>{pending.length}</Text>
              <Text style={screen.statLabel}>Pendentes</Text>
            </View>
            <View style={[screen.statBox, { backgroundColor: "#E0F2FE" }]}>
              <Text style={[screen.statNumber, { color: "#0EA5E9" }]}>{records.filter((r) => r.type === "preventiva").length}</Text>
              <Text style={screen.statLabel}>Preventivas</Text>
            </View>
            <View style={[screen.statBox, { backgroundColor: Colors.light.dangerLight }]}>
              <Text style={[screen.statNumber, { color: Colors.light.danger }]}>{records.filter((r) => r.type === "corretiva").length}</Text>
              <Text style={screen.statLabel}>Corretivas</Text>
            </View>
            <View style={[screen.statBox, { backgroundColor: Colors.light.successLight }]}>
              <Text style={[screen.statNumber, { color: Colors.light.success }]}>{resolved.length}</Text>
              <Text style={screen.statLabel}>Resolvidas</Text>
            </View>
          </View>

          {/* Filter tabs */}
          <View style={screen.tabs}>
            {(["all", "preventiva", "corretiva"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveFilter(tab)}
                style={[screen.tab, activeFilter === tab && screen.tabActive]}
              >
                <Text style={[screen.tabText, activeFilter === tab && screen.tabTextActive]}>
                  {tab === "all" ? "Todas" : TYPE_LABELS[tab as MaintenanceType]}
                </Text>
              </Pressable>
            ))}
          </View>

          {loadingRecords ? (
            <View style={screen.centered}><ActivityIndicator color="#7C3AED" /></View>
          ) : (
            <FlatList
              data={filteredRecords}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => (
                <MaintenanceItem
                  record={item}
                  onDelete={() => handleDeleteMaint(item.id)}
                  onEdit={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditingMaint(item);
                    setAddMaintVisible(true);
                  }}
                  onToggleStatus={(next) => handleToggleStatus(item.id, next)}
                />
              )}
              contentContainerStyle={[screen.listContent, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={screen.emptyState}>
                  <View style={screen.emptyIcon}>
                    <Feather name="tool" size={28} color={Colors.light.textMuted} />
                  </View>
                  <Text style={screen.emptyTitle}>
                    {activeFilter === "all" ? "Nenhuma manutenção" : activeFilter === "preventiva" ? "Nenhuma manutenção preventiva" : "Nenhuma manutenção corretiva"}
                  </Text>
                  <Text style={screen.emptyText}>Toque em + para registrar</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* ─── Visão: Peças Trocadas ─── */}
      {view === "pecas" && (
        <>
          {/* Resumo de peças */}
          <View style={screen.partsHeader}>
            <View style={screen.partsStat}>
              <Feather name="package" size={16} color="#7C3AED" />
              <Text style={screen.partsStatText}>{parts.length} peça{parts.length !== 1 ? "s" : ""} registrada{parts.length !== 1 ? "s" : ""}</Text>
            </View>
            {totalCost > 0 && (
              <View style={screen.partsCost}>
                <Text style={screen.partsCostLabel}>Total gasto:</Text>
                <Text style={screen.partsCostValue}>R$ {totalCost.toFixed(2).replace(".", ",")}</Text>
              </View>
            )}
          </View>

          {loadingParts ? (
            <View style={screen.centered}><ActivityIndicator color="#7C3AED" /></View>
          ) : (
            <FlatList
              data={parts}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <PartItem
                  part={item}
                  onDelete={() => handleDeletePart(item.id)}
                  onEdit={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditingPart(item);
                    setAddPartVisible(true);
                  }}
                />
              )}
              contentContainerStyle={[screen.listContent, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={screen.emptyState}>
                  <View style={screen.emptyIcon}>
                    <Feather name="package" size={28} color={Colors.light.textMuted} />
                  </View>
                  <Text style={screen.emptyTitle}>Nenhuma peça registrada</Text>
                  <Text style={screen.emptyText}>Toque em + para registrar uma peça trocada</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Modals */}
      <AddMaintenanceModal
        visible={addMaintVisible}
        onClose={() => { setAddMaintVisible(false); setEditingMaint(null); }}
        onSave={handleAddMaint}
        initial={editingMaint}
      />
      <AddPartModal
        visible={addPartVisible}
        onClose={() => { setAddPartVisible(false); setEditingPart(null); }}
        onSave={handleAddPart}
        initial={editingPart}
      />
      <ReminderModal
        visible={reminderVisible}
        onClose={() => setReminderVisible(false)}
        onSave={handleSaveReminder}
      />
      <ConfirmModal
        visible={deleteMaintId !== null}
        title="Excluir manutenção"
        message="Deseja excluir este registro? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={confirmDeleteMaint}
        onCancel={() => setDeleteMaintId(null)}
      />
      <ConfirmModal
        visible={deletePartId !== null}
        title="Excluir peça"
        message="Deseja excluir este registro de peça? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={confirmDeletePart}
        onCancel={() => setDeletePartId(null)}
      />
      <ConfirmModal
        visible={deleteReminderConfirmId !== null}
        title="Excluir lembrete"
        message="Deseja excluir este lembrete? Ele não aparecerá mais nesta aba."
        confirmLabel="Excluir"
        onConfirm={() => deleteReminderConfirmId && handleDeleteReminder(deleteReminderConfirmId)}
        onCancel={() => setDeleteReminderConfirmId(null)}
      />
    </View>
  );
}

const screen = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  loadingView: {
    flex: 1, backgroundColor: Colors.light.background,
    alignItems: "center", justifyContent: "center", gap: 12,
  },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#7C3AED",
  },
  backBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text },
  reminderBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  reminderBtnActive: { backgroundColor: "#FEF3C7", borderWidth: 1.5, borderColor: "#FDE68A" },
  addBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#7C3AED",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  reminderContainer: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#FEF3C7", borderRadius: 14,
    borderWidth: 1, borderColor: "#FDE68A",
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 6,
  },
  reminderHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2,
  },
  reminderHeaderText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "#92400E", textTransform: "uppercase", letterSpacing: 0.4,
  },
  reminderBanner: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#FFFBEB", borderRadius: 10,
    borderWidth: 1, borderColor: "#FDE68A",
    paddingHorizontal: 10, paddingVertical: 8, gap: 8,
    marginBottom: 4,
  },
  reminderText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#92400E", lineHeight: 18 },
  reminderDelBtn: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: "#FDE68A", alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  machineCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginBottom: 12, padding: 14,
    backgroundColor: Colors.light.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border,
  },
  machineIconBox: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: "#EDE9FE",
    alignItems: "center", justifyContent: "center",
  },
  machineModel: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },
  machineBrand: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },

  // Segment
  segmentRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 14,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: Colors.light.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  segmentTextActive: { color: "#7C3AED", fontFamily: "Inter_600SemiBold" },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.light.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  badgeActive: { backgroundColor: "#EDE9FE" },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.light.textSecondary },
  badgeTextActive: { color: "#7C3AED" },

  // Stats
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 10 },
  statBox: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 2 },
  statNumber: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },

  // Tabs
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: "center", backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1.5, borderColor: "transparent",
  },
  tabActive: { backgroundColor: "#EDE9FE", borderColor: "#7C3AED" },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  tabTextActive: { color: "#7C3AED", fontFamily: "Inter_600SemiBold" },

  // Parts header
  partsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  partsStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  partsStatText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  partsCost: { flexDirection: "row", alignItems: "center", gap: 4 },
  partsCostLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  partsCostValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#7C3AED" },

  // Common
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  emptyState: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.light.text, textAlign: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },
});
