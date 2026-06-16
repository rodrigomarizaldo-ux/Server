import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

interface ActionChoiceModalProps {
  visible: boolean;
  machineName: string;
  onReports: () => void;
  onMaintenance: () => void;
  onTiresFuel: () => void;
  onCostPerHour: () => void;
  onClose: () => void;
}

interface OptionProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor: string;
  iconBg: string;
  cardBg: string;
  cardBorder: string;
  title: string;
  desc: string;
  onPress: () => void;
}

function Option({ icon, iconColor, iconBg, cardBg, cardBorder, title, desc, onPress }: OptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: cardBg, borderColor: cardBorder },
        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.optionTexts}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{desc}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.light.textMuted} />
    </Pressable>
  );
}

export function ActionChoiceModal({
  visible,
  machineName,
  onReports,
  onMaintenance,
  onTiresFuel,
  onCostPerHour,
  onClose,
}: ActionChoiceModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.machine} numberOfLines={1}>{machineName}</Text>
          <Text style={styles.subtitle}>Selecione uma opção</Text>

          <ScrollView
            contentContainerStyle={styles.options}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Option
              icon="file-text"
              iconColor={Colors.light.tint}
              iconBg={Colors.light.iconBg}
              cardBg={Colors.light.surfaceSecondary}
              cardBorder={Colors.light.border}
              title="Relatórios Diários"
              desc="Status, horímetro e contador mensal de horas"
              onPress={onReports}
            />
            <Option
              icon="tool"
              iconColor="#A78BFA"
              iconBg="#1A1040"
              cardBg={Colors.light.surfaceSecondary}
              cardBorder={Colors.light.border}
              title="Controle de Manutenção"
              desc="Preventivas, corretivas e histórico de peças"
              onPress={onMaintenance}
            />
            <Option
              icon="droplet"
              iconColor="#38BDF8"
              iconBg="#0A1F30"
              cardBg={Colors.light.surfaceSecondary}
              cardBorder={Colors.light.border}
              title="Pneus & Combustível"
              desc="Abastecimentos, pneus/esteiras e histórico"
              onPress={onTiresFuel}
            />
            <Option
              icon="trending-up"
              iconColor={Colors.light.tint}
              iconBg={Colors.light.iconBg}
              cardBg={Colors.light.surfaceSecondary}
              cardBorder={Colors.light.border}
              title="Custo por Hora"
              desc="Custo total mensal dividido pelas horas trabalhadas"
              onPress={onCostPerHour}
            />
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, gap: 8, maxHeight: "85%",
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.light.border,
    borderRadius: 2, alignSelf: "center", marginBottom: 8,
  },
  machine: {
    fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center",
  },
  subtitle: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary,
    textAlign: "center", marginBottom: 4,
  },
  options: { gap: 10, paddingVertical: 4 },
  option: {
    borderRadius: 16, padding: 14,
    flexDirection: "row", alignItems: "center",
    gap: 12, borderWidth: 1.5,
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  optionTexts: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  optionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  cancelBtn: {
    height: 48, borderRadius: 12, backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
});
