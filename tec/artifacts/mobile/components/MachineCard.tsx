import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";

export interface MachineCardProps {
  id: string;
  model: string;
  brand: string;
  year: number;
  serialNumber: string;
  fleetNumber?: string;
  onPress: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MachineCard({
  id,
  model,
  brand,
  year,
  serialNumber,
  fleetNumber,
  onPress,
  onEdit,
  onDelete,
}: MachineCardProps) {
  const handleCardPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress(id);
  };

  const handleEdit = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onEdit(id);
  };

  const handleDeletePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Password confirmation is handled by the parent screen
    onDelete(id);
  };

  return (
    <>
      <View style={styles.wrapper}>
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { opacity: pressed ? 0.96 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
          ]}
          onPress={handleCardPress}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <Feather name="tool" size={20} color={Colors.light.tint} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.model} numberOfLines={1}>{model}</Text>
              <Text style={styles.brand}>{brand}</Text>
            </View>
            {!!fleetNumber && (
              <View style={styles.fleetBadge}>
                <Feather name="truck" size={11} color={Colors.light.tint} />
                <Text style={styles.fleetBadgeText}>{fleetNumber}</Text>
              </View>
            )}
            <View style={styles.actionsSpacer} />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Info grid */}
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Ano</Text>
              <Text style={styles.cellValue}>{year}</Text>
            </View>
            <View style={styles.cellDivider} />
            <View style={[styles.cell, styles.cellFull]}>
              <Text style={styles.cellLabel}>Nº de Série</Text>
              <Text style={styles.cellValue} numberOfLines={1}>{serialNumber}</Text>
            </View>
            {!!fleetNumber && (
              <>
                <View style={styles.cellDivider} />
                <View style={[styles.cell, styles.cellFleet]}>
                  <Text style={styles.cellLabel}>Nº Frota</Text>
                  <Text style={[styles.cellValue, styles.cellValueFleet]} numberOfLines={1}>
                    {fleetNumber}
                  </Text>
                </View>
              </>
            )}
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

        <View style={styles.actionsOverlay} pointerEvents="box-none">
          <Pressable
            onPress={handleEdit}
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={8}
            accessibilityLabel="Editar máquina"
            accessibilityRole="button"
          >
            <Feather name="edit-2" size={16} color={Colors.light.textSecondary} />
          </Pressable>
          <Pressable
            onPress={handleDeletePress}
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={8}
            accessibilityLabel="Excluir máquina"
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={16} color={Colors.light.danger} />
          </Pressable>
        </View>
      </View>
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
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2A2200",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: { flex: 1 },
  model: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  brand: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  fleetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#2A2200",
    borderWidth: 1,
    borderColor: "#FDDCCA",
  },
  fleetBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.light.tint,
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
  cellFleet: { minWidth: 80 },
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
  cellValueFleet: {
    color: Colors.light.tint,
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
