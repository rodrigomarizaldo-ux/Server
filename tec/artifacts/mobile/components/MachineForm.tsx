import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

export interface MachineFormData {
  model: string;
  brand: string;
  year: string;
  serialNumber: string;
  fleetNumber: string;
}

interface MachineFormProps {
  title: string;
  initialValues?: Partial<MachineFormData>;
  isLoading?: boolean;
  onSubmit: (data: MachineFormData) => void;
  onCancel: () => void;
  submitLabel?: string;
}

interface FieldConfig {
  key: keyof MachineFormData;
  label: string;
  placeholder: string;
  icon: string;
  keyboardType?: "default" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}

const FIELDS: FieldConfig[] = [
  {
    key: "model",
    label: "Modelo",
    placeholder: "Ex: Escavadeira 320",
    icon: "box",
    autoCapitalize: "words",
  },
  {
    key: "brand",
    label: "Marca",
    placeholder: "Ex: Caterpillar",
    icon: "tag",
    autoCapitalize: "words",
  },
  {
    key: "year",
    label: "Ano",
    placeholder: "Ex: 2022",
    icon: "calendar",
    keyboardType: "numeric",
  },
  {
    key: "serialNumber",
    label: "Número de Série",
    placeholder: "Ex: CAT-320-2022-001",
    icon: "hash",
    autoCapitalize: "characters",
  },
  {
    key: "fleetNumber",
    label: "Número de Frota *",
    placeholder: "Ex: FR-001, A12, 007",
    icon: "truck",
    autoCapitalize: "characters",
  },
];

export function MachineForm({
  title,
  initialValues = {},
  isLoading = false,
  onSubmit,
  onCancel,
  submitLabel = "Salvar",
}: MachineFormProps) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<MachineFormData>({
    model: initialValues.model ?? "",
    brand: initialValues.brand ?? "",
    year: initialValues.year ?? "",
    serialNumber: initialValues.serialNumber ?? "",
    fleetNumber: initialValues.fleetNumber ?? "",
  });
  const [errors, setErrors] = useState<Partial<MachineFormData>>({});
  const [focusedField, setFocusedField] = useState<keyof MachineFormData | null>(null);

  const validate = (): boolean => {
    const newErrors: Partial<MachineFormData> = {};
    if (!form.model.trim()) newErrors.model = "Modelo é obrigatório";
    if (!form.brand.trim()) newErrors.brand = "Marca é obrigatória";
    if (!form.year.trim()) {
      newErrors.year = "Ano é obrigatório";
    } else {
      const yr = parseInt(form.year, 10);
      if (isNaN(yr) || yr < 1900 || yr > 2100) {
        newErrors.year = "Ano inválido (1900–2100)";
      }
    }
    if (!form.serialNumber.trim()) newErrors.serialNumber = "Número de série é obrigatório";
    if (!form.fleetNumber.trim()) newErrors.fleetNumber = "Número de frota é obrigatório";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSubmit(form);
  };

  const updateField = (key: keyof MachineFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const isValid = form.model && form.brand && form.year && form.serialNumber && form.fleetNumber;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="x" size={20} color={Colors.light.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {FIELDS.map((field) => (
          <View key={field.key} style={styles.fieldContainer}>
            <Text style={styles.label}>{field.label}</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === field.key && styles.inputWrapperFocused,
                !!errors[field.key] && styles.inputWrapperError,
              ]}
            >
              <Feather
                name={field.icon as "box"}
                size={16}
                color={
                  errors[field.key]
                    ? Colors.light.danger
                    : focusedField === field.key
                    ? Colors.light.tint
                    : Colors.light.textMuted
                }
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={form[field.key]}
                onChangeText={(v) => updateField(field.key, v)}
                placeholder={field.placeholder}
                placeholderTextColor={Colors.light.textMuted}
                keyboardType={field.keyboardType ?? "default"}
                autoCapitalize={field.autoCapitalize ?? "sentences"}
                onFocus={() => setFocusedField(field.key)}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {!!errors[field.key] && (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={12} color={Colors.light.danger} />
                <Text style={styles.errorText}>{errors[field.key]}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={isLoading || !isValid}
          style={({ pressed }) => [
            styles.submitBtn,
            (!isValid || isLoading) && styles.submitBtnDisabled,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.submitText}>{submitLabel}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  fieldContainer: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: Colors.light.tint,
    backgroundColor: "#FFF7F4",
  },
  inputWrapperError: {
    borderColor: Colors.light.danger,
    backgroundColor: Colors.light.dangerLight,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 2,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.danger,
  },
  submitBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.light.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
