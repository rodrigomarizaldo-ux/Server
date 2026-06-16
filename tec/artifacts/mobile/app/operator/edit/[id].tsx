import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import Colors from "@/constants/colors";
import { OperatorForm, OperatorFormData } from "@/components/OperatorForm";
import { useGetOperator, useUpdateOperator } from "@/hooks/useOperatorStore";

export default function EditOperatorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: operator, isLoading } = useGetOperator(id ?? "");

  const { mutate: updateOperator, isPending } = useUpdateOperator({
    mutation: {
      onSuccess: () => {
        router.back();
      },
    },
  });

  const handleSubmit = (data: OperatorFormData) => {
    if (!id) return;
    updateOperator({
      id,
      data: {
        name: data.name.trim(),
        birthDate: data.birthDate.trim(),
        payment: parseFloat(data.payment.replace(",", ".")),
        weeklyHours: parseFloat(data.weeklyHours.replace(",", ".")),
      },
    });
  };

  if (isLoading || !operator) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  return (
    <OperatorForm
      title="Editar Operador"
      initialValues={{
        name: operator.name,
        birthDate: operator.birthDate,
        payment: String(operator.payment),
        weeklyHours: String(operator.weeklyHours),
      }}
      isLoading={isPending}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      submitLabel="Salvar alterações"
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.surface,
  },
});
