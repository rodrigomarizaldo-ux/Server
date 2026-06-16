import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React from "react";

import { MachineForm, MachineFormData } from "@/components/MachineForm";
import {
  useCreateMachine,
  getListMachinesQueryKey,
} from "@/hooks/useMachineStore";
import { consumeCredit } from "@/utils/machineCredits";

export default function NewMachineScreen() {
  const queryClient = useQueryClient();

  const { mutate: createMachine, isPending } = useCreateMachine({
    mutation: {
      onSuccess: () => {
        // Consome o crédito somente quando o cadastro é concluído com sucesso
        consumeCredit();
        queryClient.invalidateQueries({ queryKey: getListMachinesQueryKey() });
        router.back();
      },
    },
  });

  const handleSubmit = (data: MachineFormData) => {
    createMachine({
      data: {
        model: data.model.trim(),
        brand: data.brand.trim(),
        year: parseInt(data.year, 10),
        serialNumber: data.serialNumber.trim(),
        fleetNumber: data.fleetNumber.trim(),
      },
    });
  };

  return (
    <MachineForm
      title="Nova Máquina"
      isLoading={isPending}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      submitLabel="Cadastrar"
    />
  );
}
