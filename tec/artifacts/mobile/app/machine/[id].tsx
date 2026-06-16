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

// ─── Types ──────────────────────────────────────────────────────────────────

type MachineStatus = "operando" | "manutencao" | "parada";

interface DailyReport {
  id: string;
  date: string;
  status: MachineStatus;
  horimetroInicial?: string;
  horimetroFinal?: string;
  horimeter: string;
  notes: string;
  createdAt: string;
}

// ─── Contador Mensal ─────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

/** Extrai mês (0-indexed) e ano de uma string "DD/MM/AAAA" */
function parseReportDate(dateStr: string): { month: number; year: number } | null {
  const parts = dateStr.replace(/\s/g, "").split("/");
  if (parts.length < 3) return null;
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(year) || year < 2000) return null;
  return { month, year };
}

function MonthlyHoursCounter({ reports }: { reports: DailyReport[] }) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthReports = reports.filter((r) => {
    const parsed = parseReportDate(r.date);
    if (!parsed) return false;
    return parsed.month === currentMonth && parsed.year === currentYear;
  });

  const hoursUsed = monthReports
    .filter((r) => r.status === "operando")
    .reduce((sum, r) => sum + (parseFloat(r.horimeter) || 0), 0);

  const operandoCount = monthReports.filter((r) => r.status === "operando").length;
  const manutencaoCount = monthReports.filter((r) => r.status === "manutencao").length;
  const paradaCount = monthReports.filter((r) => r.status === "parada").length;

  return (
    <View style={counterStyles.card}>
      <View style={counterStyles.titleRow}>
        <View style={counterStyles.titleIcon}>
          <Feather name="clock" size={16} color={Colors.light.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={counterStyles.title}>Contador Mensal de Horas</Text>
          <Text style={counterStyles.subtitle}>{MONTH_NAMES[currentMonth]} {currentYear}</Text>
        </View>
        <View style={counterStyles.limitBadge}>
          <Text style={counterStyles.limitText}>{monthReports.length} rel.</Text>
        </View>
      </View>

      {/* Contador principal */}
      <View style={counterStyles.mainCounterBox}>
        <Text style={counterStyles.mainCounterValue}>{hoursUsed.toFixed(1)}h</Text>
        <Text style={counterStyles.mainCounterLabel}>registradas em operação neste mês</Text>
      </View>

      {/* Breakdown por status */}
      <View style={counterStyles.numbersRow}>
        <View style={counterStyles.numberBox}>
          <Text style={[counterStyles.numberValue, { color: Colors.light.success }]}>
            {operandoCount}
          </Text>
          <Text style={counterStyles.numberLabel}>Operando</Text>
        </View>
        <View style={counterStyles.numberDivider} />
        <View style={counterStyles.numberBox}>
          <Text style={[counterStyles.numberValue, { color: Colors.light.warning }]}>
            {manutencaoCount}
          </Text>
          <Text style={counterStyles.numberLabel}>Manutenção</Text>
        </View>
        <View style={counterStyles.numberDivider} />
        <View style={counterStyles.numberBox}>
          <Text style={[counterStyles.numberValue, { color: Colors.light.danger }]}>
            {paradaCount}
          </Text>
          <Text style={counterStyles.numberLabel}>Parada</Text>
        </View>
      </View>
    </View>
  );
}

const counterStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#2A2200",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  limitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  limitText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary },
  mainCounterBox: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
    marginVertical: 4,
    gap: 4,
  },
  mainCounterValue: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: Colors.light.tint,
    letterSpacing: -1,
  },
  mainCounterLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  numbersRow: { flexDirection: "row", alignItems: "center" },
  numberBox: { flex: 1, alignItems: "center", gap: 2 },
  numberDivider: { width: 1, height: 32, backgroundColor: Colors.light.border },
  numberValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  numberLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.light.textMuted, textTransform: "uppercase" },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Chave de armazenamento isolada por máquina */
const storageKey = (machineId: string) => getScopedKey(`reports_${machineId}`);

const STATUS_LABELS: Record<MachineStatus, string> = {
  operando: "Operando",
  manutencao: "Em manutenção",
  parada: "Parada",
};

const STATUS_COLORS: Record<MachineStatus, string> = {
  operando: Colors.light.success,
  manutencao: Colors.light.warning,
  parada: Colors.light.danger,
};

const STATUS_BG: Record<MachineStatus, string> = {
  operando: Colors.light.successLight,
  manutencao: "#FEF3C7",
  parada: Colors.light.dangerLight,
};

// ─── Status Selector ────────────────────────────────────────────────────────

function StatusSelector({
  value,
  onChange,
}: {
  value: MachineStatus;
  onChange: (v: MachineStatus) => void;
}) {
  const statuses: MachineStatus[] = ["operando", "manutencao", "parada"];
  return (
    <View style={statusStyles.row}>
      {statuses.map((s) => (
        <Pressable
          key={s}
          onPress={() => onChange(s)}
          style={[
            statusStyles.chip,
            value === s && {
              backgroundColor: STATUS_BG[s],
              borderColor: STATUS_COLORS[s],
            },
          ]}
        >
          <View
            style={[
              statusStyles.dot,
              { backgroundColor: value === s ? STATUS_COLORS[s] : Colors.light.textMuted },
            ]}
          />
          <Text
            style={[
              statusStyles.chipLabel,
              value === s && { color: STATUS_COLORS[s], fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {STATUS_LABELS[s]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const statusStyles = StyleSheet.create({
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
  chipLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
});

// ─── Report Item ─────────────────────────────────────────────────────────────

function ReportItem({
  report,
  onDelete,
  onEdit,
}: {
  report: DailyReport;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const hasInicialFinal = !!report.horimetroInicial && !!report.horimetroFinal;

  return (
    <View style={reportStyles.card}>
      <View style={reportStyles.header}>
        <View style={reportStyles.dateBox}>
          <Feather name="calendar" size={13} color={Colors.light.textSecondary} />
          <Text style={reportStyles.date}>{report.date}</Text>
        </View>
        <View style={[reportStyles.badge, { backgroundColor: STATUS_BG[report.status] }]}>
          <View style={[reportStyles.dot, { backgroundColor: STATUS_COLORS[report.status] }]} />
          <Text style={[reportStyles.badgeText, { color: STATUS_COLORS[report.status] }]}>
            {STATUS_LABELS[report.status]}
          </Text>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [reportStyles.editBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="edit-2" size={13} color={Colors.light.tint} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [reportStyles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="trash-2" size={14} color={Colors.light.danger} />
        </Pressable>
      </View>

      {hasInicialFinal ? (
        <View style={reportStyles.horInicialFinalRow}>
          <View style={reportStyles.horCell}>
            <Text style={reportStyles.horCellLabel}>Inicial</Text>
            <Text style={reportStyles.horCellValue}>{report.horimetroInicial} h</Text>
          </View>
          <View style={reportStyles.horCellDivider} />
          <View style={reportStyles.horCell}>
            <Text style={reportStyles.horCellLabel}>Final</Text>
            <Text style={reportStyles.horCellValue}>{report.horimetroFinal} h</Text>
          </View>
          <View style={reportStyles.horCellDivider} />
          <View style={reportStyles.horCell}>
            <Text style={reportStyles.horCellLabel}>Diferença</Text>
            <Text style={[reportStyles.horCellValue, { color: Colors.light.tint }]}>{parseFloat(report.horimeter) >= 0 ? `+${parseFloat(report.horimeter).toFixed(1)}` : report.horimeter} h</Text>
          </View>
        </View>
      ) : (
        <View style={reportStyles.horRow}>
          <Feather name="clock" size={13} color={Colors.light.tint} />
          <Text style={reportStyles.horLabel}>Horímetro:</Text>
          <Text style={reportStyles.horValue}>{report.horimeter} h</Text>
        </View>
      )}

      {!!report.notes && (
        <Text style={reportStyles.notes}>{report.notes}</Text>
      )}
    </View>
  );
}

const reportStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  date: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#2A2200",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.light.dangerLight,
    alignItems: "center",
    justifyContent: "center",
  },
  horRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  horLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  horValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.light.tint,
  },
  horInicialFinalRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 8,
  },
  horCell: { flex: 1, alignItems: "center", gap: 2 },
  horCellLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.light.textMuted, textTransform: "uppercase" },
  horCellValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.light.text },
  horCellDivider: { width: 1, height: 28, backgroundColor: Colors.light.border },
  notes: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    lineHeight: 20,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginTop: 4,
  },
});

// ─── Add/Edit Report Modal ─────────────────────────────────────────────────────

function AddReportModal({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (report: Omit<DailyReport, "id" | "createdAt">) => void;
  initial?: DailyReport | null;
}) {
  const insets = useSafeAreaInsets();
  const today = new Date().toLocaleDateString("pt-BR");
  const isEditing = !!initial;

  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<MachineStatus>("operando");
  const [horimetroInicial, setHorimetroInicial] = useState("");
  const [horimetroFinal, setHorimetroFinal] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ date?: string; horimetroInicial?: string; horimetroFinal?: string }>({});

  useEffect(() => {
    if (visible) {
      if (initial) {
        setDate(initial.date);
        setStatus(initial.status);
        setHorimetroInicial(initial.horimetroInicial ?? "");
        setHorimetroFinal(initial.horimetroFinal ?? initial.horimeter ?? "");
        setNotes(initial.notes);
      } else {
        setDate(today);
        setStatus("operando");
        setHorimetroInicial("");
        setHorimetroFinal("");
        setNotes("");
      }
      setErrors({});
    }
  }, [visible, initial]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    const newErrors: typeof errors = {};
    if (!date.trim()) newErrors.date = "Data é obrigatória";
    if (!horimetroInicial.trim()) newErrors.horimetroInicial = "Obrigatório";
    else if (isNaN(parseFloat(horimetroInicial))) newErrors.horimetroInicial = "Inválido";
    if (!horimetroFinal.trim()) newErrors.horimetroFinal = "Obrigatório";
    else if (isNaN(parseFloat(horimetroFinal))) newErrors.horimetroFinal = "Inválido";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const ini = parseFloat(horimetroInicial);
    const fin = parseFloat(horimetroFinal);
    const diff = Math.max(0, fin - ini);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSave({
      date: date.trim(),
      status,
      horimetroInicial: horimetroInicial.trim(),
      horimetroFinal: horimetroFinal.trim(),
      horimeter: diff.toFixed(1),
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={modalStyles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={modalStyles.container}
        >
          <View style={[modalStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>{isEditing ? "Editar Relatório" : "Novo Relatório"}</Text>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [modalStyles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Feather name="x" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={modalStyles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Data */}
              <View style={modalStyles.field}>
                <Text style={modalStyles.label}>Data do Relatório</Text>
                <View style={[modalStyles.inputWrap, !!errors.date && modalStyles.inputError]}>
                  <Feather name="calendar" size={15} color={Colors.light.textMuted} style={modalStyles.inputIcon} />
                  <TextInput
                    style={modalStyles.input}
                    value={date}
                    onChangeText={(v) => { setDate(v); setErrors((e) => ({ ...e, date: undefined })); }}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={Colors.light.textMuted}
                  />
                </View>
                {!!errors.date && <Text style={modalStyles.errorText}>{errors.date}</Text>}
              </View>

              {/* Status */}
              <View style={modalStyles.field}>
                <Text style={modalStyles.label}>Status da Máquina</Text>
                <StatusSelector value={status} onChange={setStatus} />
              </View>

              {/* Horímetro Inicial + Final */}
              <View style={modalStyles.field}>
                <Text style={modalStyles.label}>Horímetro (h)</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={modalStyles.sublabel}>Inicial *</Text>
                    <View style={[modalStyles.inputWrap, !!errors.horimetroInicial && modalStyles.inputError]}>
                      <Feather name="clock" size={14} color={Colors.light.textMuted} style={modalStyles.inputIcon} />
                      <TextInput
                        style={modalStyles.input}
                        value={horimetroInicial}
                        onChangeText={(v) => { setHorimetroInicial(v); setErrors((e) => ({ ...e, horimetroInicial: undefined })); }}
                        placeholder="Ex: 1240"
                        placeholderTextColor={Colors.light.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    {!!errors.horimetroInicial && <Text style={modalStyles.errorText}>{errors.horimetroInicial}</Text>}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={modalStyles.sublabel}>Final *</Text>
                    <View style={[modalStyles.inputWrap, !!errors.horimetroFinal && modalStyles.inputError]}>
                      <Feather name="clock" size={14} color={Colors.light.textMuted} style={modalStyles.inputIcon} />
                      <TextInput
                        style={modalStyles.input}
                        value={horimetroFinal}
                        onChangeText={(v) => { setHorimetroFinal(v); setErrors((e) => ({ ...e, horimetroFinal: undefined })); }}
                        placeholder="Ex: 1250"
                        placeholderTextColor={Colors.light.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    {!!errors.horimetroFinal && <Text style={modalStyles.errorText}>{errors.horimetroFinal}</Text>}
                  </View>
                </View>
                {!!horimetroInicial && !!horimetroFinal && !isNaN(parseFloat(horimetroInicial)) && !isNaN(parseFloat(horimetroFinal)) && (
                  <View style={modalStyles.horDiffBadge}>
                    <Feather name="trending-up" size={12} color={Colors.light.tint} />
                    <Text style={modalStyles.horDiffText}>
                      Diferença: {Math.max(0, parseFloat(horimetroFinal) - parseFloat(horimetroInicial)).toFixed(1)}h trabalhadas
                    </Text>
                  </View>
                )}
              </View>

              {/* Observações */}
              <View style={modalStyles.field}>
                <Text style={modalStyles.label}>Observações (opcional)</Text>
                <TextInput
                  style={modalStyles.textArea}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Descreva o funcionamento, ocorrências ou manutenções..."
                  placeholderTextColor={Colors.light.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [modalStyles.saveBtn, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name="save" size={18} color="#fff" />
                <Text style={modalStyles.saveBtnText}>{isEditing ? "Salvar Alterações" : "Salvar Relatório"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  container: { width: "100%" },
  sheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20, gap: 16 },
  field: { gap: 6 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    height: 50,
  },
  inputError: {
    borderColor: Colors.light.danger,
    backgroundColor: Colors.light.dangerLight,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.danger,
    marginLeft: 2,
  },
  textArea: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  saveBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  sublabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  horDiffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2A2200",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  horDiffText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.tint,
  },
});

// ─── Main Detail Screen ───────────────────────────────────────────────────────

export default function MachineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data: machine, isLoading } = useGetMachine(id ?? "");
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);

  // ── Carregar relatórios do AsyncStorage para esta máquina ──
  const loadReports = useCallback(async () => {
    if (!id) return;
    try {
      const raw = await AsyncStorage.getItem(storageKey(id));
      if (raw) setReports(JSON.parse(raw) as DailyReport[]);
    } catch (e) {
      console.error("Erro ao carregar relatórios:", e);
    } finally {
      setLoadingReports(false);
    }
  }, [id]);

  useEffect(() => { loadReports(); }, [loadReports]);

  // ── Salvar relatórios no AsyncStorage ──
  const saveReports = async (updated: DailyReport[]) => {
    if (!id) return;
    try {
      await AsyncStorage.setItem(storageKey(id), JSON.stringify(updated));
    } catch (e) {
      console.error("Erro ao salvar relatórios:", e);
    }
  };

  const handleAddReport = async (data: Omit<DailyReport, "id" | "createdAt">) => {
    if (editingReport) {
      const updated = reports.map((r) =>
        r.id === editingReport.id ? { ...editingReport, ...data } : r
      );
      setReports(updated);
      setEditingReport(null);
      await saveReports(updated);
    } else {
      const newReport: DailyReport = {
        ...data,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        createdAt: new Date().toISOString(),
      };
      const updated = [newReport, ...reports];
      setReports(updated);
      await saveReports(updated);
    }
  };

  const handleDeleteReport = (reportId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setDeleteReportId(reportId);
  };

  const confirmDeleteReport = async () => {
    if (!deleteReportId) return;
    const updated = reports.filter((r) => r.id !== deleteReportId);
    setReports(updated);
    setDeleteReportId(null);
    await saveReports(updated);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.loadingView, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  if (!machine) {
    return (
      <View style={[styles.loadingView, { paddingTop: topPad }]}>
        <Text style={styles.errorText}>Máquina não encontrada</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={16} color={Colors.light.tint} />
          <Text style={styles.backBtnText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBack, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Relatórios</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModalVisible(true);
          }}
          style={({ pressed }) => [styles.addReportBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Machine info card */}
      <View style={styles.machineCard}>
        <View style={styles.machineIconBox}>
          <Feather name="tool" size={22} color={Colors.light.tint} />
        </View>
        <View style={styles.machineInfo}>
          <Text style={styles.machineModel}>{machine.model}</Text>
          <Text style={styles.machineBrand}>{machine.brand} · {machine.year}</Text>
          <Text style={styles.machineSerial}>Série: {machine.serialNumber}</Text>
          {!!machine.fleetNumber && (
            <Text style={styles.machineSerial}>Frota: {machine.fleetNumber}</Text>
          )}
        </View>
      </View>

      {/* Reports list (contador mensal + lista combinados no scroll) */}
      {loadingReports ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.light.tint} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={
            <>
              {/* Contador mensal de 250 horas */}
              <MonthlyHoursCounter reports={reports} />

              {/* Título da seção */}
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={15} color={Colors.light.textSecondary} />
                <Text style={styles.sectionTitle}>
                  Relatórios Diários ({reports.length})
                </Text>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <ReportItem
              report={item}
              onDelete={() => handleDeleteReport(item.id)}
              onEdit={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditingReport(item);
                setModalVisible(true);
              }}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="file-text" size={28} color={Colors.light.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Nenhum relatório</Text>
              <Text style={styles.emptyText}>
                Toque em + para registrar o primeiro relatório diário desta máquina
              </Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Report Modal */}
      <AddReportModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setEditingReport(null); }}
        onSave={handleAddReport}
        initial={editingReport}
      />

      {/* Confirm delete report */}
      <ConfirmModal
        visible={deleteReportId !== null}
        title="Excluir relatório"
        message="Deseja excluir este relatório? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={confirmDeleteReport}
        onCancel={() => setDeleteReportId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingView: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.tint,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  addReportBtn: {
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
  machineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  machineIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2A2200",
    alignItems: "center",
    justifyContent: "center",
  },
  machineInfo: { flex: 1 },
  machineModel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  machineBrand: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  machineSerial: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
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
