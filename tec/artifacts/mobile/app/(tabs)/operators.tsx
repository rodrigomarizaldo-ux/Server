import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Redirect, router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { OperatorCard } from "@/components/OperatorCard";
import { OperatorActionChoiceModal } from "@/components/OperatorActionChoiceModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListOperators,
  useDeleteOperator,
  getListOperatorsQueryKey,
} from "@/hooks/useOperatorStore";

export default function OperatorsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [search, setSearch] = useState("");

  const [choiceModal, setChoiceModal] = useState<{
    visible: boolean;
    id: string;
    name: string;
  }>({ visible: false, id: "", name: "" });

  const { data: operators, isLoading, refetch, isRefetching } = useListOperators();

  const { mutate: deleteOperator } = useDeleteOperator({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOperatorsQueryKey() });
      },
    },
  });

  // Auth guard
  if (!authLoading && !user) return <Redirect href="/auth" />;

  const filtered = (operators ?? []).filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCardPress = (id: string) => {
    const operator = operators?.find((o) => o.id === id);
    if (!operator) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChoiceModal({ visible: true, id, name: operator.name });
  };

  const handleEdit = (id: string) => {
    router.push({ pathname: "/operator/edit/[id]", params: { id } });
  };

  const handleDelete = (id: string) => {
    deleteOperator({ id });
  };

  const handleChooseMachines = () => {
    setChoiceModal((s) => ({ ...s, visible: false }));
    router.push({ pathname: "/operator/machines/[id]", params: { id: choiceModal.id } });
  };

  const handleChooseProductivity = () => {
    setChoiceModal((s) => ({ ...s, visible: false }));
    router.push({ pathname: "/operator/productivity/[id]", params: { id: choiceModal.id } });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Operadores</Text>
          <Text style={styles.headerSub}>
            {operators?.length ?? 0} cadastrado{operators?.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/operator/new");
          }}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="plus" size={22} color={Colors.light.tintText} />
        </Pressable>
      </View>

      {/* Barra de busca */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Feather
            name="search"
            size={16}
            color={Colors.light.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome..."
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

      {/* Conteúdo */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.loadingText}>Carregando operadores...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OperatorCard
              {...item}
              onPress={handleCardPress}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPad + 100 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.light.tint}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Feather name="users" size={32} color={Colors.light.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {search ? "Nenhum resultado" : "Nenhum operador"}
              </Text>
              <Text style={styles.emptyText}>
                {search
                  ? "Tente um nome diferente"
                  : "Toque em + para cadastrar o primeiro operador"}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal de escolha de ação */}
      <OperatorActionChoiceModal
        visible={choiceModal.visible}
        operatorName={choiceModal.name}
        onMachines={handleChooseMachines}
        onProductivity={handleChooseProductivity}
        onClose={() => setChoiceModal((s) => ({ ...s, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    lineHeight: 34,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10 },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  listContent: { paddingTop: 4 },
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
});
