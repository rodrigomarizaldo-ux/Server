import { Platform } from "react-native";
import Purchases, { type PurchasesOffering, type PurchasesPackage } from "react-native-purchases";

// Chave da API Pública da RevenueCat para Android (será lida de variáveis de ambiente no build)
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "goog_mock_api_key_placeholder";

/**
 * Inicializa o SDK da RevenueCat
 */
export function configurePurchases() {
  if (Platform.OS === "android" || Platform.OS === "ios") {
    // Configura o SDK. Em produção ou build do EAS, ele pegará a chave configurada
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    console.log("RevenueCat configurado com sucesso.");
  }
}

/**
 * Retorna o pacote mensal principal disponível
 */
export async function getSubscriptionPackage(): Promise<PurchasesPackage | null> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
      // Retorna o pacote mensal padrão (ou o primeiro disponível)
      const monthly = offerings.current.monthly;
      return monthly || offerings.current.availablePackages[0];
    }
  } catch (e) {
    console.error("Erro ao carregar assinaturas do RevenueCat:", e);
  }
  return null;
}

/**
 * Dispara o fluxo de compra de um pacote
 */
export async function purchaseSubscription(
  pack: PurchasesPackage
): Promise<{ success: boolean; customerInfo?: any; error?: string }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pack);
    
    // Verifica se a assinatura está ativa (exemplo: entitlement correspondente ao seu produto)
    // Se você configurou um entitlement no painel do RevenueCat chamado "premium" ou "active_subscription"
    const entitlements = customerInfo.entitlements.active;
    const hasActiveSubscription = Object.keys(entitlements).length > 0;

    return { success: hasActiveSubscription, customerInfo };
  } catch (err: any) {
    if (err.userCancelled) {
      return { success: false, error: "Compra cancelada pelo usuário." };
    }
    return { success: false, error: err.message || "Erro ao processar compra na Google Play." };
  }
}
