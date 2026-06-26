import { Platform } from "react-native";
import Purchases, { type PurchasesOffering, type PurchasesPackage } from "react-native-purchases";

// Chave da API Pública da RevenueCat para Android (lida de variáveis de ambiente no build)
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

/**
 * Inicializa o SDK da RevenueCat com segurança
 */
export function configurePurchases() {
  try {
    if (Platform.OS === "android" || Platform.OS === "ios") {
      // Se não houver chave configurada, não inicializa para evitar crashes nativos
      if (!REVENUECAT_API_KEY || REVENUECAT_API_KEY.includes("placeholder")) {
        console.warn("Chave do RevenueCat não configurada ou inválida. Ignorando inicialização.");
        return;
      }
      
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      console.log("RevenueCat configurado com sucesso.");
    }
  } catch (e) {
    console.error("Erro nativo ao inicializar o RevenueCat:", e);
  }
}

/**
 * Verifica se o RevenueCat foi configurado com sucesso
 */
export async function isPurchasesConfigured(): Promise<boolean> {
  try {
    return await Purchases.isConfigured();
  } catch {
    return false;
  }
}

/**
 * Retorna o pacote mensal principal disponível
 */
export async function getSubscriptionPackage(): Promise<PurchasesPackage | null> {
  try {
    const configured = await isPurchasesConfigured();
    if (!configured) {
      console.warn("RevenueCat não está configurado. Retornando nulo.");
      return null;
    }

    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
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
    const configured = await isPurchasesConfigured();
    if (!configured) {
      return { success: false, error: "Serviço de faturamento não configurado no aplicativo." };
    }

    const { customerInfo } = await Purchases.purchasePackage(pack);
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
