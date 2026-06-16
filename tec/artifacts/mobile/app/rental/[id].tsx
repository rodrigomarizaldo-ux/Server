import AsyncStorage from "@react-native-async-storage/async-storage";
import { markDirty } from "@/utils/syncManager";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import type { Contract } from "../(tabs)/rentals";
import { getScopedKey } from "@/utils/userStorage";

interface Machine { id: string; model: string; brand: string; serialNumber: string; year: string; }

function parseDate(d: string): Date | null {
  const p = d.split("/");
  if (p.length !== 3) return null;
  return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
}

function getStatus(c: Contract): "active" | "upcoming" | "finished" {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const s = parseDate(c.startDate); const e = parseDate(c.endDate);
  if (!s || !e) return "active";
  if (now < s) return "upcoming";
  if (now > e) return "finished";
  return "active";
}

function diffDays(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }

function fmtBRL(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

async function loadContracts(): Promise<Contract[]> {
  try { const r = await AsyncStorage.getItem(getScopedKey("rentals_store_v1")); return r ? JSON.parse(r) : []; } catch { return []; }
}

async function saveContracts(list: Contract[]) {
  await AsyncStorage.setItem(getScopedKey("rentals_store_v1"), JSON.stringify(list));
}

async function loadMachines(): Promise<Machine[]> {
  try { const r = await AsyncStorage.getItem(getScopedKey("machines_store_v1")); return r ? JSON.parse(r) : []; } catch { return []; }
}

type Tab = "periodo" | "receita" | "disponibilidade";

function StatusBadge({ status }: { status: "active" | "upcoming" | "finished" }) {
  const labels = { active: "Em andamento", upcoming: "A iniciar", finished: "Encerrado" };
  const cfg = {
    active: { bg: Colors.light.successLight, fg: Colors.light.success, icon: "check-circle" as const },
    upcoming: { bg: "#FEF3C7", fg: "#D97706", icon: "clock" as const },
    finished: { bg: Colors.light.surfaceSecondary, fg: Colors.light.textSecondary, icon: "archive" as const },
  };
  const { bg, fg, icon } = cfg[status];
  return (
    <View style={[sbS.pill, { backgroundColor: bg }]}>
      <Feather name={icon} size={12} color={fg} />
      <Text style={[sbS.text, { color: fg }]}>{labels[status]}</Text>
    </View>
  );
}
const sbS = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start" },
  text: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

function InfoRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={ir.row}>
      <View style={ir.iconBox}><Feather name={icon} size={15} color={Colors.light.tint} /></View>
      <View style={ir.right}>
        <Text style={ir.label}>{label}</Text>
        <Text style={ir.value}>{value}</Text>
      </View>
    </View>
  );
}
const ir = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFF7F4", alignItems: "center", justifyContent: "center" },
  right: { flex: 1 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text, marginTop: 2 },
});

function PeriodoTab({ contract }: { contract: Contract }) {
  const status = getStatus(contract);
  const start = parseDate(contract.startDate);
  const end = parseDate(contract.endDate);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const totalDays = start && end ? diffDays(start, end) : null;
  const daysLeft = end ? diffDays(now, end) : null;
  const daysElapsed = start ? diffDays(start, now) : null;
  const progress = totalDays && daysElapsed !== null && daysElapsed >= 0
    ? Math.min(1, daysElapsed / totalDays) : null;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={p.content} showsVerticalScrollIndicator={false}>
      <View style={p.card}>
        <View style={p.statusRow}>
          <StatusBadge status={status} />
          {totalDays !== null && <Text style={p.totalDays}>{totalDays} dias no total</Text>}
        </View>

        {progress !== null && (
          <View style={p.progressWrap}>
            <View style={p.progressBg}>
              <View style={[p.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={p.progressText}>{Math.round(progress * 100)}% concluído</Text>
          </View>
        )}

        <InfoRow icon="calendar" label="Início do Contrato" value={contract.startDate} />
        <InfoRow icon="calendar" label="Encerramento" value={contract.endDate} />
        {totalDays !== null && <InfoRow icon="clock" label="Duração Total" value={`${totalDays} dias`} />}
        {status === "active" && daysLeft !== null && daysLeft >= 0 && (
          <InfoRow icon="alert-circle" label="Dias Restantes" value={`${daysLeft} dias`} />
        )}
        {status === "active" && daysElapsed !== null && daysElapsed >= 0 && (
          <InfoRow icon="trending-up" label="Dias Decorridos" value={`${daysElapsed} dias`} />
        )}
        {contract.description ? (
          <View style={[ir.row, { borderBottomWidth: 0 }]}>
            <View style={ir.iconBox}><Feather name="file-text" size={15} color={Colors.light.tint} /></View>
            <View style={ir.right}>
              <Text style={ir.label}>Observações</Text>
              <Text style={[ir.value, { fontSize: 14, fontFamily: "Inter_400Regular" }]}>{contract.description}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
const p = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: Colors.light.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.border, padding: 16 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  totalDays: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  progressWrap: { marginBottom: 16 },
  progressBg: { height: 6, borderRadius: 3, backgroundColor: Colors.light.surfaceSecondary, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: Colors.light.tint },
  progressText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "right" },
});

interface AddMachineRevenueModalProps {
  visible: boolean;
  availableMachines: Machine[];
  onClose: () => void;
  onSave: (machineId: string, machineName: string, monthlyRevenue: number) => void;
}
function AddMachineRevenueModal({ visible, availableMachines, onClose, onSave }: AddMachineRevenueModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState("");
  const [revenue, setRevenue] = useState("");
  const [errors, setErrors] = useState<{ machine?: string; revenue?: string }>({});

  const reset = () => { setSelectedId(""); setRevenue(""); setErrors({}); };
  const handleClose = () => { reset(); onClose(); };
  const handleSave = () => {
    const e: typeof errors = {};
    if (!selectedId) e.machine = "Selecione uma máquina";
    const rev = parseFloat(revenue.replace(",", "."));
    if (!revenue.trim() || isNaN(rev) || rev < 0) e.revenue = "Informe um valor válido";
    if (Object.keys(e).length) { setErrors(e); return; }
    const m = availableMachines.find(m => m.id === selectedId)!;
    onSave(selectedId, `${m.model} – ${m.brand}`, rev);
    reset(); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={arm.overlay}>
        <View style={[arm.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={arm.header}>
            <Text style={arm.title}>Adicionar Máquina</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => [arm.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Feather name="x" size={20} color={Colors.light.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={arm.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={arm.sectionLabel}>Selecione a máquina</Text>
            {availableMachines.length === 0 ? (
              <Text style={arm.noMachines}>Nenhuma máquina disponível para adicionar</Text>
            ) : (
              availableMachines.map(m => (
                <Pressable
                  key={m.id}
                  onPress={() => { setSelectedId(m.id); setErrors(e => ({ ...e, machine: undefined })); }}
                  style={({ pressed }) => [arm.machineRow, selectedId === m.id && arm.machineRowActive, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <View style={[arm.machineIcon, selectedId === m.id && arm.machineIconActive]}>
                    <Feather name="tool" size={16} color={selectedId === m.id ? "#fff" : Colors.light.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[arm.machineName, selectedId === m.id && { color: Colors.light.tint }]}>{m.model}</Text>
                    <Text style={arm.machineSub}>{m.brand} · {m.year} · {m.serialNumber}</Text>
                  </View>
                  {selectedId === m.id && <Feather name="check-circle" size={18} color={Colors.light.tint} />}
                </Pressable>
              ))
            )}
            {!!errors.machine && <Text style={arm.err}>{errors.machine}</Text>}

            <View style={arm.field}>
              <Text style={arm.label}>Receita Mensal (R$) *</Text>
              <View style={[arm.inputBox, !!errors.revenue && { borderColor: Colors.light.danger }]}>
                <Text style={arm.prefix}>R$</Text>
                <TextInput
                  style={arm.input}
                  value={revenue}
                  onChangeText={v => { setRevenue(v); setErrors(e => ({ ...e, revenue: undefined })); }}
                  placeholder="0,00"
                  placeholderTextColor={Colors.light.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              {!!errors.revenue && <Text style={arm.err}>{errors.revenue}</Text>}
            </View>

            <Pressable onPress={handleSave} style={({ pressed }) => [arm.saveBtn, { opacity: pressed ? 0.85 : 1 }]}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={arm.saveBtnText}>Adicionar Máquina</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const arm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.light.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  noMachines: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", paddingVertical: 16 },
  machineRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.light.border, backgroundColor: Colors.light.surface },
  machineRowActive: { borderColor: Colors.light.tint, backgroundColor: "#FFF7F4" },
  machineIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  machineIconActive: { backgroundColor: Colors.light.tint },
  machineName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  machineSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 1 },
  field: { gap: 6 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  inputBox: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: Colors.light.border, borderRadius: 10, paddingHorizontal: 12, height: 44 },
  prefix: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.textMuted, marginRight: 6 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text },
  err: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.danger },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.tint, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

function ReceitaTab({
  contract,
  allMachines,
  onUpdateMachineRevenues,
}: {
  contract: Contract;
  allMachines: Machine[];
  onUpdateMachineRevenues: (revs: Contract["machineRevenues"]) => void;
}) {
  const [addVisible, setAddVisible] = useState(false);
  const linkedIds = contract.machineRevenues.map(m => m.machineId);
  const availableToAdd = allMachines.filter(m => !linkedIds.includes(m.id));
  const total = contract.machineRevenues.reduce((s, m) => s + (m.monthlyRevenue ?? 0), 0);

  const handleAdd = (machineId: string, machineName: string, monthlyRevenue: number) => {
    onUpdateMachineRevenues([...contract.machineRevenues, { machineId, machineName, monthlyRevenue }]);
  };

  const handleRemove = (machineId: string) => {
    onUpdateMachineRevenues(contract.machineRevenues.filter(m => m.machineId !== machineId));
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Summary banner */}
      {contract.machineRevenues.length > 0 && (
        <View style={rt.banner}>
          <View style={rt.bannerItem}>
            <Text style={rt.bannerLabel}>Máquinas</Text>
            <Text style={rt.bannerValue}>{contract.machineRevenues.length}</Text>
          </View>
          <View style={rt.bannerDivider} />
          <View style={rt.bannerItem}>
            <Text style={rt.bannerLabel}>Receita Total/mês</Text>
            <Text style={[rt.bannerValue, { color: Colors.light.success }]}>{fmtBRL(total)}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={contract.machineRevenues}
        keyExtractor={i => i.machineId}
        contentContainerStyle={[rt.list, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={rt.empty}>
            <Feather name="tool" size={28} color={Colors.light.textMuted} />
            <Text style={rt.emptyTitle}>Nenhuma máquina adicionada</Text>
            <Text style={rt.emptyText}>Toque em + para adicionar máquinas e definir a receita mensal de cada uma</Text>
          </View>
        }
        renderItem={({ item }) => {
          const machine = allMachines.find(m => m.id === item.machineId);
          return (
            <View style={rt.row}>
              <View style={rt.rowIcon}>
                <Feather name="tool" size={18} color={Colors.light.tint} />
              </View>
              <View style={rt.rowInfo}>
                <Text style={rt.rowTitle}>{machine ? `${machine.model}` : item.machineName}</Text>
                <Text style={rt.rowSub}>{machine ? `${machine.brand} · ${machine.year}` : "—"}</Text>
              </View>
              <View style={rt.rowRight}>
                <Text style={rt.rowRevenue}>{fmtBRL(item.monthlyRevenue)}</Text>
                <Text style={rt.rowRevenueLabel}>/mês</Text>
              </View>
              <Pressable
                onPress={() => handleRemove(item.machineId)}
                hitSlop={8}
                style={({ pressed }) => [rt.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Feather name="x" size={15} color={Colors.light.danger} />
              </Pressable>
            </View>
          );
        }}
      />

      <Pressable
        onPress={() => setAddVisible(true)}
        style={({ pressed }) => [rt.addBtn, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={rt.addBtnText}>Adicionar Máquina ao Contrato</Text>
      </Pressable>

      <AddMachineRevenueModal
        visible={addVisible}
        availableMachines={availableToAdd}
        onClose={() => setAddVisible(false)}
        onSave={handleAdd}
      />
    </View>
  );
}
const rt = StyleSheet.create({
  banner: { flexDirection: "row", backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border, paddingVertical: 12, paddingHorizontal: 20 },
  bannerItem: { flex: 1, alignItems: "center" },
  bannerLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginBottom: 2 },
  bannerValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  bannerDivider: { width: 1, backgroundColor: Colors.light.border, marginHorizontal: 16 },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 18, maxWidth: 280 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.light.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border, padding: 14 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFF7F4", alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  rowSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowRevenue: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.success },
  rowRevenueLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.light.dangerLight, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  addBtn: { position: "absolute", bottom: 24, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.tint, borderRadius: 14, paddingVertical: 14, shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  addBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

function DisponibilidadeTab({
  allMachines,
  allContracts,
  currentContractId,
}: {
  allMachines: Machine[];
  allContracts: Contract[];
  currentContractId: string;
}) {
  const activeContracts = allContracts.filter(c => getStatus(c) === "active");

  const occupiedMap = new Map<string, string>();
  for (const c of activeContracts) {
    for (const m of c.machineRevenues) {
      const label = c.id === currentContractId ? "Este contrato" : c.clientName;
      occupiedMap.set(m.machineId, label);
    }
  }

  const available = allMachines.filter(m => !occupiedMap.has(m.id));
  const occupied = allMachines.filter(m => occupiedMap.has(m.id));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={dt.content} showsVerticalScrollIndicator={false}>
      {/* Summary */}
      <View style={dt.summaryRow}>
        <View style={[dt.summaryCard, { borderColor: Colors.light.success }]}>
          <Feather name="check-circle" size={20} color={Colors.light.success} />
          <Text style={[dt.summaryCount, { color: Colors.light.success }]}>{available.length}</Text>
          <Text style={dt.summaryLabel}>Disponíveis</Text>
        </View>
        <View style={[dt.summaryCard, { borderColor: Colors.light.warning }]}>
          <Feather name="alert-circle" size={20} color={Colors.light.warning} />
          <Text style={[dt.summaryCount, { color: Colors.light.warning }]}>{occupied.length}</Text>
          <Text style={dt.summaryLabel}>Em Contrato</Text>
        </View>
        <View style={[dt.summaryCard, { borderColor: Colors.light.border }]}>
          <Feather name="tool" size={20} color={Colors.light.textSecondary} />
          <Text style={[dt.summaryCount, { color: Colors.light.text }]}>{allMachines.length}</Text>
          <Text style={dt.summaryLabel}>Total</Text>
        </View>
      </View>

      {available.length > 0 && (
        <>
          <Text style={dt.sectionTitle}>
            <Feather name="check-circle" size={13} color={Colors.light.success} /> Disponíveis
          </Text>
          {available.map(m => (
            <View key={m.id} style={[dt.machineRow, { borderColor: Colors.light.successLight }]}>
              <View style={[dt.machineIcon, { backgroundColor: Colors.light.successLight }]}>
                <Feather name="tool" size={16} color={Colors.light.success} />
              </View>
              <View style={dt.machineInfo}>
                <Text style={dt.machineName}>{m.model}</Text>
                <Text style={dt.machineSub}>{m.brand} · {m.year} · {m.serialNumber}</Text>
              </View>
              <View style={[dt.statusDot, { backgroundColor: Colors.light.success }]} />
            </View>
          ))}
        </>
      )}

      {occupied.length > 0 && (
        <>
          <Text style={[dt.sectionTitle, { marginTop: available.length > 0 ? 16 : 0 }]}>
            <Feather name="alert-circle" size={13} color={Colors.light.warning} /> Em Contrato Ativo
          </Text>
          {occupied.map(m => (
            <View key={m.id} style={[dt.machineRow, { borderColor: "#FDE68A" }]}>
              <View style={[dt.machineIcon, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="tool" size={16} color="#D97706" />
              </View>
              <View style={dt.machineInfo}>
                <Text style={dt.machineName}>{m.model}</Text>
                <Text style={dt.machineSub}>{m.brand} · {m.year}</Text>
                <Text style={[dt.machineSub, { color: "#D97706", marginTop: 2 }]}>
                  Contrato: {occupiedMap.get(m.id)}
                </Text>
              </View>
              <View style={[dt.statusDot, { backgroundColor: Colors.light.warning }]} />
            </View>
          ))}
        </>
      )}

      {allMachines.length === 0 && (
        <View style={dt.emptyWrap}>
          <Feather name="tool" size={28} color={Colors.light.textMuted} />
          <Text style={dt.emptyTitle}>Nenhuma máquina cadastrada</Text>
          <Text style={dt.emptyText}>Cadastre máquinas na aba Máquinas para ver a disponibilidade</Text>
        </View>
      )}
    </ScrollView>
  );
}
const dt = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: Colors.light.surface, borderRadius: 14, borderWidth: 1.5, padding: 14, alignItems: "center", gap: 4 },
  summaryCount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.light.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  machineRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.light.surface, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  machineIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  machineInfo: { flex: 1 },
  machineName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  machineSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 18 },
});

export default function RentalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [contract, setContract] = useState<Contract | null>(null);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("periodo");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    const [contracts, machines] = await Promise.all([loadContracts(), loadMachines()]);
    setAllContracts(contracts);
    setAllMachines(machines);
    const found = contracts.find(c => c.id === id);
    setContract(found ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateMachineRevenues = async (revs: Contract["machineRevenues"]) => {
    if (!contract) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated: Contract = { ...contract, machineRevenues: revs };
    setContract(updated);
    const updatedAll = allContracts.map(c => c.id === id ? updated : c);
    setAllContracts(updatedAll);
    await saveContracts(updatedAll);
    markDirty();
  };

  const TABS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "periodo", label: "Período", icon: "calendar" },
    { key: "receita", label: "Receita", icon: "dollar-sign" },
    { key: "disponibilidade", label: "Disponibilidade", icon: "check-circle" },
  ];

  return (
    <View style={[d.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={d.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [d.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <View style={d.headerCenter}>
          {loading ? <ActivityIndicator size="small" color={Colors.light.tint} /> : (
            <>
              <Text style={d.headerTitle} numberOfLines={1}>{contract?.clientName ?? "Contrato"}</Text>
              {contract ? <StatusBadge status={getStatus(contract)} /> : null}
            </>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={d.tabBar}>
        {TABS.map(t => (
          <Pressable
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={({ pressed }) => [d.tabBtn, activeTab === t.key && d.tabBtnActive, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name={t.icon} size={14} color={activeTab === t.key ? Colors.light.tint : Colors.light.textMuted} />
            <Text style={[d.tabLabel, activeTab === t.key && d.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={d.centered}><ActivityIndicator size="large" color={Colors.light.tint} /></View>
      ) : !contract ? (
        <View style={d.centered}>
          <Text style={d.notFound}>Contrato não encontrado</Text>
        </View>
      ) : (
        <>
          {activeTab === "periodo" && <PeriodoTab contract={contract} />}
          {activeTab === "receita" && (
            <ReceitaTab
              contract={contract}
              allMachines={allMachines}
              onUpdateMachineRevenues={updateMachineRevenues}
            />
          )}
          {activeTab === "disponibilidade" && (
            <DisponibilidadeTab
              allMachines={allMachines}
              allContracts={allContracts}
              currentContractId={id ?? ""}
            />
          )}
        </>
      )}
    </View>
  );
}

const d = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.light.surface, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", gap: 4 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },
  tabBar: { flexDirection: "row", backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border, paddingHorizontal: 8 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: Colors.light.tint },
  tabLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.textMuted },
  tabLabelActive: { color: Colors.light.tint },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFound: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
});
