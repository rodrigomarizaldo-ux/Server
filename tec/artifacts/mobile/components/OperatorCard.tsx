import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { ConfirmModal } from "@/components/ConfirmModal";

export interface OperatorCardProps {
  id: string;
  name: string;
  birthDate: string;
  payment: number;
  weeklyHours: number;
  onPress: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OperatorCard({
  id,
  name,
  birthDate,
  payment,
  weeklyHours,
  onPress,
  onEdit,
  onDelete,
}: OperatorCardProps) {
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleCardPress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(id);
  };

  const handleEdit = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit(id);
  };

  const handleDeletePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmVisible(true);
  };

  const handleConfirmDelete = () => {
    setConfirmVisible(false);
    onDelete(id);
  };

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      {/*
        Outer wrapper — action buttons are absolutely positioned OUTSIDE the
        main Pressable so clicks don't bubble to the card handler on web.
      */}
      <View style={styles.wrapper}>
        {/* Tappable card body */}
        <Pressable
          onPress={handleCardPress}
          style={({ pressed }) => [
            styles.card,
            { opacity: pressed ? 0.96 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
              <Text style={styles.birthText}>Nasc. {formatDate(birthDate)}</Text>
            </View>
            {/* Spacer reserves space for the absolutely-positioned action buttons */}
            <View style={styles.actionsSpacer} />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Info grid */}
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Pagamento</Text>
              <Text style={styles.cellValue}>{formatCurrency(payment)}</Text>
            </View>
            <View style={styles.cellDivider} />
            <View style={[styles.cell, styles.cellFull]}>
              <Text style={styles.cellLabel}>Horas Semanais</Text>
              <Text style={styles.cellValue}>{weeklyHours}h / sem</Text>
            </View>
            <View style={styles.cellDivider} />
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Acessar</Text>
              <View style={styles.detailHint}>
                <Feather name="chevron-right" size={14} color={Colors.light.tint} />
                <Text style={styles.detailHintText}>Ver mais</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Action buttons — siblings to the Pressable, absolutely positioned */}
        <View style={styles.actionsOverlay} pointerEvents="box-none">
          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={8}
            accessibilityLabel="Editar operador"
            accessibilityRole="button"
          >
            <Feather name="edit-2" size={16} color={Colors.light.textSecondary} />
          </Pressable>
          <Pressable
            onPress={handleDeletePress}
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={8}
            accessibilityLabel="Excluir operador"
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={16} color={Colors.light.danger} />
          </Pressable>
        </View>
      </View>

      <ConfirmModal
        visible={confirmVisible}
        title="Excluir operador"
        message={`Deseja excluir "${name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.tintText,
    letterSpacing: 0.5,
  },
  headerInfo: { flex: 1 },
  nameText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  birthText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  actionsSpacer: { width: 80 },
  actionsOverlay: {
    position: "absolute",
    top: 10,
    right: 12,
    flexDirection: "row",
    gap: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 16,
  },
  grid: {
    flexDirection: "row",
    padding: 12,
    paddingHorizontal: 16,
  },
  cell: {
    alignItems: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 70,
  },
  cellFull: { flex: 1 },
  cellDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 2,
  },
  cellLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cellValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  detailHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 1,
  },
  detailHintText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.tint,
  },
});
