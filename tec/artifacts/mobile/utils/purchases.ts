/**
 * Inicializa o SDK da RevenueCat com segurança (MOCK/DESABILITADO PARA TESTES)
 */
export function configurePurchases() {
  console.log("RevenueCat desabilitado temporariamente.");
}

/**
 * Verifica se o RevenueCat foi configurado com sucesso
 */
export async function isPurchasesConfigured(): Promise<boolean> {
  return false;
}

/**
 * Retorna o pacote mensal principal disponível (Mocked para retornar null)
 */
export async function getSubscriptionPackage(): Promise<any | null> {
  return null;
}

/**
 * Dispara o fluxo de compra de um pacote (Mocked para retornar sucesso direto)
 */
export async function purchaseSubscription(
  pack: any
): Promise<{ success: boolean; customerInfo?: any; error?: string }> {
  return { success: true };
}
