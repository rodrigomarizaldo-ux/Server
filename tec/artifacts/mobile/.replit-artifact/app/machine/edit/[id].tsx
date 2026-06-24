import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { MachineForm, MachineFormData } from "@/components/MachineForm";
import Colors from "@/constants/colors";
import {
  useGetMachine,
  useUpdateMachine,
  getListMachinesQueryKey,
  getGetMachineQueryKey,
} from "@/hooks/useMachineStore";

export default function EditMachineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: machine, isLoading } = useGetMachine(id ?? "");

  const { mutate: updateMachine, isPending } = useUpdateMachine({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMachinesQueryKey() });
        if (id) {
          queryClient.invalidateQueries({ queryKey: getGetMachineQueryKey(id) });
        }
        router.back();
      },
    },
  });

  const handleSubmit = (data: MachineFormData) => {
    if (!id) return;
    updateMachine({
      id,
      data: {
        model: data.model.trim(),
        brand: data.brand.trim(),
        year: parseInt(data.year, 10),
        serialNumber: data.serialNumber.trim(),
        fleetNumber: data.fleetNumber.trim(),
      },
    });
  };

  if (isLoading || !machine) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  return (
    <MachineForm
      title="Editar Máquina"
      initialValues={{
        model: machine.model,
        brand: machine.brand,
        year: String(machine.year),
        serialNumber: machine.serialNumber,
        fleetNumber: machine.fleetNumber ?? "",
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
