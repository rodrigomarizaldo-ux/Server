import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
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

export interface OperatorFormData {
  name: string;
  birthDate: string;
  payment: string;
  weeklyHours: string;
}

interface Props {
  title: string;
  initialValues?: OperatorFormData;
  isLoading: boolean;
  submitLabel: string;
  onSubmit: (data: OperatorFormData) => void;
  onCancel: () => void;
}

const EMPTY: OperatorFormData = {
  name: "",
  birthDate: "",
  payment: "",
  weeklyHours: "",
};

// ─── Birth date mask: DD/MM/AAAA ─────────────────────────────────────────────

function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function maskToIso(masked: string): string {
  const [d, m, y] = masked.split("/");
  if (!d || !m || !y || y.length < 4) return masked;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function isoToMask(iso: string): string {
  if (!iso || !iso.includes("-")) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OperatorForm({
  title,
  initialValues,
  isLoading,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(initialValues?.name ?? EMPTY.name);
  const [birthDateDisplay, setBirthDateDisplay] = useState(
    initialValues?.birthDate ? isoToMask(initialValues.birthDate) : "",
  );
  const [payment, setPayment] = useState(initialValues?.payment ?? EMPTY.payment);
  const [weeklyHours, setWeeklyHours] = useState(
    initialValues?.weeklyHours ?? EMPTY.weeklyHours,
  );

  const [errors, setErrors] = useState<Partial<OperatorFormData>>({});

  useEffect(() => {
    if (initialValues) {
      setName(initialValues.name);
      setBirthDateDisplay(
        initialValues.birthDate ? isoToMask(initialValues.birthDate) : "",
      );
      setPayment(initialValues.payment);
      setWeeklyHours(initialValues.weeklyHours);
    }
  }, [initialValues?.name]);

  const validate = (): boolean => {
    const errs: Partial<OperatorFormData> = {};

    if (!name.trim()) errs.name = "Nome é obrigatório";

    const dateDigits = birthDateDisplay.replace(/\D/g, "");
    if (!birthDateDisplay.trim()) {
      errs.birthDate = "Data de nascimento é obrigatória";
    } else if (dateDigits.length < 8) {
      errs.birthDate = "Data incompleta (DD/MM/AAAA)";
    }

    const payNum = parseFloat(payment.replace(",", "."));
    if (!payment.trim()) {
      errs.payment = "Pagamento é obrigatório";
    } else if (isNaN(payNum) || payNum < 0) {
      errs.payment = "Valor inválido";
    }

    const hoursNum = parseFloat(weeklyHours.replace(",", "."));
    if (!weeklyHours.trim()) {
      errs.weeklyHours = "Horas semanais é obrigatório";
    } else if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 168) {
      errs.weeklyHours = "Valor inválido (1–168)";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      birthDate: maskToIso(birthDateDisplay),
      payment,
      weeklyHours,
    });
  };

  const handleDateChange = (text: string) => {
    setBirthDateDisplay(applyDateMask(text));
    if (errors.birthDate) setErrors((e) => ({ ...e, birthDate: undefined }));
  };

  const inputStyle = (field: keyof OperatorFormData) => [
    styles.input,
    errors[field] ? styles.inputError : null,
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityLabel="Fechar"
          >
            <Feather name="x" size={20} color={Colors.light.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.fields}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Nome */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nome do operador *</Text>
            <TextInput
              style={inputStyle("name")}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
              }}
              placeholder="Ex: João da Silva"
              placeholderTextColor={Colors.light.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* Data de nascimento */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Data de nascimento *</Text>
            <TextInput
              style={inputStyle("birthDate")}
              value={birthDateDisplay}
              onChangeText={handleDateChange}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={Colors.light.textMuted}
              keyboardType="numeric"
              maxLength={10}
              returnKeyType="next"
            />
            {errors.birthDate ? (
              <Text style={styles.errorText}>{errors.birthDate}</Text>
            ) : null}
          </View>

          {/* Pagamento */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Pagamento (R$) *</Text>
            <View style={styles.prefixWrapper}>
              <Text style={styles.prefix}>R$</Text>
              <TextInput
                style={[inputStyle("payment"), styles.inputWithPrefix]}
                value={payment}
                onChangeText={(v) => {
                  setPayment(v);
                  if (errors.payment) setErrors((e) => ({ ...e, payment: undefined }));
                }}
                placeholder="0,00"
                placeholderTextColor={Colors.light.textMuted}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            {errors.payment ? (
              <Text style={styles.errorText}>{errors.payment}</Text>
            ) : null}
          </View>

          {/* Horas semanais */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Horas semanais *</Text>
            <View style={styles.suffixWrapper}>
              <TextInput
                style={[inputStyle("weeklyHours"), styles.inputWithSuffix]}
                value={weeklyHours}
                onChangeText={(v) => {
                  setWeeklyHours(v);
                  if (errors.weeklyHours)
                    setErrors((e) => ({ ...e, weeklyHours: undefined }));
                }}
                placeholder="40"
                placeholderTextColor={Colors.light.textMuted}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <Text style={styles.suffix}>h/sem</Text>
            </View>
            {errors.weeklyHours ? (
              <Text style={styles.errorText}>{errors.weeklyHours}</Text>
            ) : null}
          </View>
        </ScrollView>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.submitBtn,
              { opacity: isLoading ? 0.7 : pressed ? 0.85 : 1 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitText}>{submitLabel}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
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
  scroll: { flex: 1 },
  fields: { gap: 20, paddingBottom: 12 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  inputError: {
    borderColor: Colors.light.danger,
    backgroundColor: Colors.light.dangerLight,
  },
  prefixWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    overflow: "hidden",
  },
  prefix: {
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    paddingVertical: 14,
  },
  inputWithPrefix: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    paddingLeft: 12,
    backgroundColor: "transparent",
  },
  suffixWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    overflow: "hidden",
  },
  inputWithSuffix: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  suffix: {
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
    paddingVertical: 14,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.danger,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  submitBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
