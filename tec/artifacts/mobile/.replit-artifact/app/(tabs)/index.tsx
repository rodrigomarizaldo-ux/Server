import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Redirect, router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAvailableCredit } from "@/utils/machineCredits";

import Colors from "@/constants/colors";
import { MachineCard } from "@/components/MachineCard";
import { ActionChoiceModal } from "@/components/ActionChoiceModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListMachines,
  useDeleteMachine,
  getListMachinesQueryKey,
} from "@/hooks/useMachineStore";

// ─── Account Modal ─────────────────────────────────────────────────────────────

function AccountModal({
  visible,
  username,
  onLogout,
  onClose,
}: {
  visible: boolean;
  username: string;
  onLogout: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={am.overlay} onPress={onClose}>
        <View style={am.sheet}>
          <View style={am.avatarRow}>
            <View style={am.avatar}>
              <Feather name="user" size={26} color={Colors.light.tint} />
            </View>
            <View>
              <Text style={am.username}>{username}</Text>
              <Text style={am.accountLabel}>Conta ativa</Text>
            </View>
          </View>
          <View style={am.divider} />
          <Pressable
            onPress={onLogout}
            style={({ pressed }) => [am.logoutBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="log-out" size={18} color={Colors.light.danger} />
            <Text style={am.logoutText}>Sair da conta</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start", alignItems: "flex-end",
    paddingTop: 100, paddingRight: 16,
  },
  sheet: {
    backgroundColor: Colors.light.surface, borderRadius: 18,
    padding: 16, minWidth: 220,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
    gap: 12,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: "#2A2200", alignItems: "center", justifyContent: "center",
  },
  username: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },
  accountLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  divider: { height: 1, backgroundColor: Colors.light.border },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 6,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.danger },
});

// ─── Password Confirm Modal ────────────────────────────────────────────────────

function PasswordConfirmModal({
  visible,
  machineName,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  machineName: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const reset = () => { setPassword(""); setShowPw(false); };

  const handleCancel = () => { reset(); onCancel(); };
  const handleConfirm = () => {
    if (!password) return;
    onConfirm(password);
    reset();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={pw.overlay}>
        <View style={pw.sheet}>
          <View style={pw.iconRow}>
            <View style={pw.iconBox}>
              <Feather name="shield" size={22} color={Colors.light.danger} />
            </View>
          </View>
          <Text style={pw.title}>Confirmar exclusão</Text>
          <Text style={pw.subtitle}>
            Digite sua senha para excluir{"\n"}
            <Text style={pw.machineName}>"{machineName}"</Text>
          </Text>
          <View style={pw.inputRow}>
            <Feather name="lock" size={15} color={Colors.light.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={pw.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha"
              placeholderTextColor={Colors.light.textMuted}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
            <Pressable onPress={() => setShowPw(!showPw)} hitSlop={8}>
              <Feather name={showPw ? "eye-off" : "eye"} size={15} color={Colors.light.textMuted} />
            </Pressable>
          </View>
          <View style={pw.actions}>
            <Pressable onPress={handleCancel} style={({ pressed }) => [pw.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Text style={pw.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!password}
              style={({ pressed }) => [pw.confirmBtn, { opacity: pressed || !password ? 0.7 : 1 }]}
            >
              <Feather name="trash-2" size={15} color="#fff" />
              <Text style={pw.confirmText}>Excluir</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pw = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  sheet: {
    backgroundColor: Colors.light.surface, borderRadius: 22,
    padding: 24, width: "100%", gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },
  iconRow: { alignItems: "center" },
  iconBox: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: Colors.light.dangerLight,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20 },
  machineName: { fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 14, paddingHorizontal: 14, height: 52,
    borderWidth: 1.5, borderColor: Colors.light.border,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text },
  actions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.light.border,
    alignItems: "center", justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  confirmBtn: {
    flex: 1.5, height: 48, borderRadius: 12,
    backgroundColor: Colors.light.danger,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  confirmText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function MachinesScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, logout, verifyPassword } = useAuth();
  const [search, setSearch] = useState("");
  const [hasCredit, setHasCredit] = useState(false);

  // Verifica crédito disponível sempre que a tela ganha foco
  useFocusEffect(
    useCallback(() => {
      getAvailableCredit().then((c) => setHasCredit(!!c));
    }, [])
  );

  const [choiceModal, setChoiceModal] = useState<{ visible: boolean; id: string; name: string }>(
    { visible: false, id: "", name: "" }
  );
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [pwModal, setPwModal] = useState<{ visible: boolean; id: string; name: string }>(
    { visible: false, id: "", name: "" }
  );
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const { data: machines, isLoading, isError, refetch, isRefetching } = useListMachines();

  const { mutate: deleteMachine } = useDeleteMachine({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMachinesQueryKey() });
      },
    },
  });

  // Auth guard — redirect to auth if not logged in
  if (!authLoading && !user) return <Redirect href="/auth" />;

  const filtered = (machines ?? []).filter(
    (m) =>
      m.model.toLowerCase().includes(search.toLowerCase()) ||
      m.brand.toLowerCase().includes(search.toLowerCase()) ||
      m.serialNumber.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCardPress = (id: string) => {
    const machine = machines?.find((m) => m.id === id);
    if (!machine) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChoiceModal({ visible: true, id, name: `${machine.model} – ${machine.brand}` });
  };

  const handleEdit = (id: string) => {
    router.push({ pathname: "/machine/edit/[id]", params: { id } });
  };

  // Delete: show password modal instead of direct confirmation
  const handleDelete = (id: string) => {
    const machine = machines?.find((m) => m.id === id);
    if (!machine) return;
    setPwError(null);
    setPwModal({ visible: true, id, name: `${machine.model} – ${machine.brand}` });
  };

  const handlePasswordConfirm = async (password: string) => {
    setPwLoading(true);
    const valid = await verifyPassword(password);
    setPwLoading(false);
    if (!valid) {
      setPwError("Senha incorreta. Tente novamente.");
      setPwModal((s) => ({ ...s, visible: false }));
      // Re-open with error shown — simplest: just close (error shown below card area)
      // Actually re-open modal with error
      setTimeout(() => setPwModal((s) => ({ ...s, visible: true })), 100);
      return;
    }
    setPwError(null);
    deleteMachine({ id: pwModal.id });
    setPwModal({ visible: false, id: "", name: "" });
  };

  const handleLogout = async () => {
    setAccountModalVisible(false);
    await logout();
  };

  const handleChooseReports = () => {
    setChoiceModal((s) => ({ ...s, visible: false }));
    router.push({ pathname: "/machine/[id]", params: { id: choiceModal.id } });
  };

  const handleChooseMaintenance = () => {
    setChoiceModal((s) => ({ ...s, visible: false }));
    router.push({ pathname: "/machine/maintenance/[id]", params: { id: choiceModal.id } });
  };

  const handleChooseTiresFuel = () => {
    setChoiceModal((s) => ({ ...s, visible: false }));
    router.push({ pathname: "/machine/tires-fuel/[id]", params: { id: choiceModal.id } });
  };

  const handleChooseCost = () => {
    setChoiceModal((s) => ({ ...s, visible: false }));
    router.push({ pathname: "/machine/cost/[id]", params: { id: choiceModal.id } });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Máquinas</Text>
          <Text style={styles.headerSub}>
            {machines?.length ?? 0} cadastrada{machines?.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {/* Account button */}
          <Pressable
            onPress={() => setAccountModalVisible(true)}
            style={({ pressed }) => [styles.accountBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="user" size={20} color={Colors.light.tint} />
          </Pressable>

          {/* Add button — usa crédito se disponível, senão vai ao pagamento */}
          <View style={styles.fabWrapper}>
            <Pressable
              onPress={async () => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const credit = await getAvailableCredit();
                if (credit) {
                  router.push("/machine/new");
                } else {
                  router.push("/payment");
                }
              }}
              style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="plus" size={22} color={Colors.light.tintText} />
            </Pressable>
            {hasCredit && (
              <View style={styles.creditBadge} pointerEvents="none">
                <Feather name="check-circle" size={10} color={Colors.light.tintText} />
                <Text style={styles.creditBadgeText}>crédito</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Password error banner */}
      {!!pwError && (
        <View style={styles.pwErrorBanner}>
          <Feather name="alert-circle" size={14} color={Colors.light.danger} />
          <Text style={styles.pwErrorText}>{pwError}</Text>
          <Pressable onPress={() => setPwError(null)} hitSlop={8}>
            <Feather name="x" size={14} color={Colors.light.danger} />
          </Pressable>
        </View>
      )}

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Feather name="search" size={16} color={Colors.light.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por modelo, marca ou série..."
            placeholderTextColor={Colors.light.textMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && Platform.OS !== "ios" && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x-circle" size={16} color={Colors.light.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.loadingText}>Carregando máquinas...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Feather name="wifi-off" size={32} color={Colors.light.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Erro de conexão</Text>
          <Text style={styles.emptyText}>Verifique a conexão com o servidor</Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [styles.retryBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="refresh-cw" size={14} color={Colors.light.tint} />
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MachineCard
              {...item}
              onPress={handleCardPress}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.light.tint} />
          }
          scrollEnabled={!!filtered.length}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Feather name="tool" size={32} color={Colors.light.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {search ? "Nenhum resultado" : "Nenhuma máquina"}
              </Text>
              <Text style={styles.emptyText}>
                {search
                  ? "Tente um termo de busca diferente"
                  : "Toque em + para cadastrar a primeira máquina"}
              </Text>
            </View>
          }
        />
      )}

      {/* Modals */}
      <ActionChoiceModal
        visible={choiceModal.visible}
        machineName={choiceModal.name}
        onReports={handleChooseReports}
        onMaintenance={handleChooseMaintenance}
        onTiresFuel={handleChooseTiresFuel}
        onCostPerHour={handleChooseCost}
        onClose={() => setChoiceModal((s) => ({ ...s, visible: false }))}
      />
      <AccountModal
        visible={accountModalVisible}
        username={user?.username ?? ""}
        onLogout={handleLogout}
        onClose={() => setAccountModalVisible(false)}
      />
      <PasswordConfirmModal
        visible={pwModal.visible}
        machineName={pwModal.name}
        onConfirm={handlePasswordConfirm}
        onCancel={() => { setPwModal({ visible: false, id: "", name: "" }); setPwError(null); }}
      />
      {pwLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.light.text, lineHeight: 34 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  accountBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: "#2A2200",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#FDDCCA",
  },
  fabWrapper: {
    alignItems: "center", gap: 4,
  },
  addBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: Colors.light.tint,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  creditBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.light.tint,
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  creditBadgeText: {
    fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.light.tintText,
    textTransform: "uppercase", letterSpacing: 0.4,
  },
  pwErrorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 6,
    backgroundColor: Colors.light.dangerLight, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  pwErrorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.danger },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10 },
  searchWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.surface, borderRadius: 12,
    paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: Colors.light.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.text },
  listContent: { paddingTop: 4 },
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, paddingVertical: 60, gap: 8,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.light.text, textAlign: "center" },
  emptyText: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, textAlign: "center", lineHeight: 20,
  },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.light.tint,
  },
  retryText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.tint },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center", justifyContent: "center",
  },
});
