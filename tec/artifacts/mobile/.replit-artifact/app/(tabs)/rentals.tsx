import AsyncStorage from "@react-native-async-storage/async-storage";
import { markDirty } from "@/utils/syncManager";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Redirect, router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { getScopedKey } from "@/utils/userStorage";

export interface Contract {
  id: string;
  clientName: string;
  description?: string;
  startDate: string;
  endDate: string;
  machineRevenues: { machineId: string; machineName: string; monthlyRevenue: number }[];
  createdAt: string;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function today() {
  return new Date().toLocaleDateString("pt-BR");
}

function parseDate(d: string): Date | null {
  const parts = d.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

function getStatus(contract: Contract): "active" | "upcoming" | "finished" {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = parseDate(contract.startDate);
  const end = parseDate(contract.endDate);
  if (!start || !end) return "active";
  if (now < start) return "upcoming";
  if (now > end) return "finished";
  return "active";
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function totalRevenue(c: Contract) {
  return c.machineRevenues.reduce((s, m) => s + (m.monthlyRevenue ?? 0), 0);
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: "active" | "upcoming" | "finished" }) {
  const labels = { active: "Em andamento", upcoming: "A iniciar", finished: "Encerrado" };
  const colors = {
    active: { bg: Colors.light.successLight, text: Colors.light.success },
    upcoming: { bg: "#FEF3C7", text: "#D97706" },
    finished: { bg: Colors.light.surfaceSecondary, text: Colors.light.textSecondary },
  };
  return (
    <View style={[badge.pill, { backgroundColor: colors[status].bg }]}>
      <Text style={[badge.text, { color: colors[status].text }]}>{labels[status]}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

function ContractCard({
  item,
  onPress,
  onDelete,
}: {
  item: Contract;
  onPress: () => void;
  onDelete: () => void;
}) {
  const status = getStatus(item);
  const start = parseDate(item.startDate);
  const end = parseDate(item.endDate);
  const days = start && end ? diffDays(start, end) : null;
  const revenue = totalRevenue(item);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [card.wrap, { opacity: pressed ? 0.92 : 1 }]}>
      <View style={card.top}>
        <View style={card.iconBox}>
          <Feather name="file-text" size={20} color={Colors.light.tint} />
        </View>
        <View style={card.info}>
          <Text style={card.client} numberOfLines={1}>{item.clientName}</Text>
          {item.description ? (
            <Text style={card.desc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [card.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="trash-2" size={16} color={Colors.light.danger} />
        </Pressable>
      </View>

      <View style={card.divider} />

      <View style={card.meta}>
        <StatusBadge status={status} />
        <View style={card.metaRight}>
          <Feather name="calendar" size={12} color={Colors.light.textMuted} />
          <Text style={card.metaText}>
            {item.startDate} → {item.endDate}
            {days !== null ? ` (${days}d)` : ""}
          </Text>
        </View>
      </View>

      {revenue > 0 && (
        <View style={card.revenueRow}>
          <Feather name="dollar-sign" size={12} color={Colors.light.success} />
          <Text style={card.revenueText}>{fmtBRL(revenue)}/mês · {item.machineRevenues.length} máq.</Text>
        </View>
      )}
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
    padding: 16,
    shadowColor: Colors.light.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#FFF7F4",
    alignItems: "center", justifyContent: "center",
  },
  info: { flex: 1 },
  client: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.text },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.light.dangerLight,
    alignItems: "center", justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: Colors.light.border, marginBottom: 12 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  metaRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  revenueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  revenueText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.success },
});

interface AddContractModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (c: Omit<Contract, "id" | "createdAt">) => void;
}

function AddContractModal({ visible, onClose, onSave }: AddContractModalProps) {
  const insets = useSafeAreaInsets();
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<{ clientName?: string; startDate?: string; endDate?: string }>({});

  const reset = () => {
    setClientName(""); setDescription("");
    setStartDate(today()); setEndDate(""); setErrors({});
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = () => {
    const e: typeof errors = {};
    if (!clientName.trim()) e.clientName = "Nome do cliente é obrigatório";
    if (!startDate.trim()) e.startDate = "Data inicial é obrigatória";
    if (!endDate.trim()) e.endDate = "Data final é obrigatória";
    if (Object.keys(e).length) { setErrors(e); return; }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ clientName: clientName.trim(), description: description.trim(), startDate: startDate.trim(), endDate: endDate.trim(), machineRevenues: [] });
    reset(); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={ms.overlay}>
        <View style={[ms.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={ms.header}>
            <Text style={ms.title}>Novo Contrato</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => [ms.closeBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Feather name="x" size={20} color={Colors.light.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={ms.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={ms.field}>
              <Text style={ms.label}>Cliente / Contratante *</Text>
              <View style={[ms.inputBox, !!errors.clientName && { borderColor: Colors.light.danger }]}>
                <Feather name="user" size={14} color={Colors.light.textMuted} style={{ marginRight: 8 }} />
                <TextInput style={ms.input} value={clientName} onChangeText={(v) => { setClientName(v); setErrors(e => ({ ...e, clientName: undefined })); }} placeholder="Ex: Construtora Alfa" placeholderTextColor={Colors.light.textMuted} />
              </View>
              {!!errors.clientName && <Text style={ms.err}>{errors.clientName}</Text>}
            </View>

            <View style={ms.field}>
              <Text style={ms.label}>Descrição (opcional)</Text>
              <TextInput style={ms.textArea} value={description} onChangeText={setDescription} placeholder="Obra, local, observações..." placeholderTextColor={Colors.light.textMuted} multiline numberOfLines={2} textAlignVertical="top" />
            </View>

            <View style={ms.row2}>
              <View style={[ms.field, { flex: 1 }]}>
                <Text style={ms.label}>Data Início *</Text>
                <View style={[ms.inputBox, !!errors.startDate && { borderColor: Colors.light.danger }]}>
                  <TextInput style={ms.input} value={startDate} onChangeText={(v) => { setStartDate(v); setErrors(e => ({ ...e, startDate: undefined })); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.light.textMuted} keyboardType="numeric" />
                </View>
                {!!errors.startDate && <Text style={ms.err}>{errors.startDate}</Text>}
              </View>
              <View style={[ms.field, { flex: 1 }]}>
                <Text style={ms.label}>Data Fim *</Text>
                <View style={[ms.inputBox, !!errors.endDate && { borderColor: Colors.light.danger }]}>
                  <TextInput style={ms.input} value={endDate} onChangeText={(v) => { setEndDate(v); setErrors(e => ({ ...e, endDate: undefined })); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.light.textMuted} keyboardType="numeric" />
                </View>
                {!!errors.endDate && <Text style={ms.err}>{errors.endDate}</Text>}
              </View>
            </View>

            <Pressable onPress={handleSave} style={({ pressed }) => [ms.saveBtn, { opacity: pressed ? 0.85 : 1 }]}>
              <Feather name="save" size={18} color={Colors.light.tintText} />
              <Text style={ms.saveBtnText}>Criar Contrato</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.light.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  inputBox: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: Colors.light.border, borderRadius: 10, paddingHorizontal: 12, height: 44, backgroundColor: Colors.light.surface },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text },
  textArea: { borderWidth: 1.5, borderColor: Colors.light.border, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text, minHeight: 72 },
  row2: { flexDirection: "row", gap: 10 },
  err: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.danger },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.tint, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.tintText },
});

async function loadContracts(): Promise<Contract[]> {
  try {
    const raw = await AsyncStorage.getItem(getScopedKey("rentals_store_v1"));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveContracts(list: Contract[]) {
  await AsyncStorage.setItem(getScopedKey("rentals_store_v1"), JSON.stringify(list));
}

export default function RentalsScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [addVisible, setAddVisible] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await loadContracts();
    setContracts(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auth guard — after all hooks
  if (!authLoading && !user) return <Redirect href="/auth" />;

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAdd = async (data: Omit<Contract, "id" | "createdAt">) => {
    const newC: Contract = { ...data, id: uid(), createdAt: new Date().toISOString() };
    const updated = [newC, ...contracts];
    setContracts(updated);
    await saveContracts(updated);
    markDirty();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const updated = contracts.filter(c => c.id !== deleteId);
    setContracts(updated);
    setDeleteId(null);
    await saveContracts(updated);
    markDirty();
  };

  const filtered = contracts.filter(c =>
    c.clientName.toLowerCase().includes(search.toLowerCase()) ||
    (c.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Locação</Text>
          <Text style={s.headerSub}>{contracts.length} contrato{contracts.length !== 1 ? "s" : ""}</Text>
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAddVisible(true);
          }}
          style={({ pressed }) => [s.fab, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="plus" size={22} color={Colors.light.tintText} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Feather name="search" size={16} color={Colors.light.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por cliente ou descrição..."
          placeholderTextColor={Colors.light.textMuted}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={Colors.light.textMuted} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <Feather name="file-text" size={32} color={Colors.light.textMuted} />
          </View>
          <Text style={s.emptyTitle}>{search ? "Nenhum resultado" : "Nenhum contrato"}</Text>
          <Text style={s.emptyText}>
            {search ? "Tente outro termo de busca" : "Toque em + para cadastrar o primeiro contrato de locação"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.tint} />}
          renderItem={({ item }) => (
            <ContractCard
              item={item}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/rental/[id]", params: { id: item.id } });
              }}
              onDelete={() => setDeleteId(item.id)}
            />
          )}
        />
      )}

      <AddContractModal visible={addVisible} onClose={() => setAddVisible(false)} onSave={handleAdd} />

      <ConfirmModal
        visible={!!deleteId}
        title="Excluir Contrato"
        message="Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.light.text },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  fab: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.light.tint, alignItems: "center", justifyContent: "center", shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.light.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border, marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 12, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.light.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.light.text, textAlign: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },
});
