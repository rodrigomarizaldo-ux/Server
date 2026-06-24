import { router } from "expo-router";
import React from "react";

import { OperatorForm, OperatorFormData } from "@/components/OperatorForm";
import { useCreateOperator } from "@/hooks/useOperatorStore";

export default function NewOperatorScreen() {
  const { mutate: createOperator, isPending } = useCreateOperator({
    mutation: {
      onSuccess: () => {
        router.back();
      },
    },
  });

  const handleSubmit = (data: OperatorFormData) => {
    createOperator({
      data: {
        name: data.name.trim(),
        birthDate: data.birthDate.trim(),
        payment: parseFloat(data.payment.replace(",", ".")),
        weeklyHours: parseFloat(data.weeklyHours.replace(",", ".")),
      },
    });
  };

  return (
    <OperatorForm
      title="Novo Operador"
      isLoading={isPending}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      submitLabel="Cadastrar"
    />
  );
}
