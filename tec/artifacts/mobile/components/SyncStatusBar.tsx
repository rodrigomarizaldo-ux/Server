import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import Colors from "@/constants/colors";
import { useSync } from "@/contexts/SyncContext";

export function SyncStatusBar() {
  const { isOnline, isSyncing, pendingSync } = useSync();
  const [showSuccess, setShowSuccess] = useState(false);
  const wassyncing = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (wassyncing.current && !isSyncing && !pendingSync && isOnline) {
      setShowSuccess(true);
      wassyncing.current = false;
      const t = setTimeout(() => setShowSuccess(false), 2500);
      return () => clearTimeout(t);
    }
    if (isSyncing) wassyncing.current = true;
  }, [isSyncing, pendingSync, isOnline]);

  const visible = !isOnline || isSyncing || pendingSync || showSuccess;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible && !showSuccess) return null;

  let bgColor = Colors.light.tint;
  let textColor = Colors.light.tintText;
  let icon: keyof typeof Feather.glyphMap = "refresh-cw";
  let label = "Sincronizando...";

  if (!isOnline) {
    bgColor = "#6B7280";
    textColor = "#fff";
    icon = "wifi-off";
    label = "Sem conexão · dados salvos localmente";
  } else if (pendingSync && !isSyncing) {
    bgColor = "#D97706";
    textColor = "#fff";
    icon = "upload-cloud";
    label = "Alterações pendentes de envio";
  } else if (isSyncing) {
    bgColor = Colors.light.tint;
    textColor = Colors.light.tintText;
    icon = "refresh-cw";
    label = "Sincronizando com a nuvem...";
  } else if (showSuccess) {
    bgColor = "#22C55E";
    textColor = "#fff";
    icon = "check-circle";
    label = "Dados sincronizados";
  }

  return (
    <Animated.View style={[styles.bar, { backgroundColor: bgColor, opacity }]}>
      <Feather name={icon} size={11} color={textColor} />
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    width: "100%",
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
