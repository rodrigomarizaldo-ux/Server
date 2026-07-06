import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { addCredit } from "@/utils/machineCredits";
import { getSubscriptionPackage, purchaseSubscription } from "@/utils/purchases";

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetchingPackage, setFetchingPackage] = useState(true);
  const [subPackage, setSubPackage] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Carrega os planos disponíveis no RevenueCat / Google Play Console
  useEffect(() => {
    async function loadPlans() {
      setFetchingPackage(true);
      const pkg = await getSubscriptionPackage();
      if (pkg) {
        setSubPackage(pkg);
      } else {
        console.warn("Nenhum plano retornado do RevenueCat. Usando fallback de exibição.");
      }
      setFetchingPackage(false);
    }
    loadPlans();
  }, []);

  const handlePay = async () => {
    if (!subPackage) {
      setError("Plano de assinatura temporariamente indisponível. Tente novamente mais tarde.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Dispara a compra nativa da Google Play via RevenueCat
      const res = await purchaseSubscription(subPackage);

      if (res.success) {
        // Salva o crédito usando a confirmação do recibo
        const transactionId = res.customerInfo?.originalAppUserId || String(Date.now());
        await addCredit(transactionId);
        setSuccess(true);
        setTimeout(() => router.replace("/machine/new"), 2000);
      } else if (res.error) {
        throw new Error(res.error);
      } else {
        throw new Error("Não foi possível confirmar a assinatura.");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar assinatura.");
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Preço dinâmico da Google Play Store (fallback para R$ 75,00 se falhar)
  const priceDisplay = subPackage ? `${subPackage.product.priceString}/mês` : "R$ 75,00/mês";

  if (success) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.successScreen}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={56} color="#22C55E" />
          </View>
          <Text style={styles.successTitle}>Assinatura Ativada!</Text>
          <Text style={styles.successSub}>
            Assinatura mensal processada com sucesso via Google Play.{"\n"}Redirecionando para o cadastro...
          </Text>
          <ActivityIndicator color={Colors.light.tint} style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Cadastro de Máquina</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner de preço */}
        <View style={styles.priceBanner}>
          <View style={styles.priceLeft}>
            <Feather name="shield" size={22} color={Colors.light.tint} />
            <View style={{ flex: 1 }}>
              <Text style={styles.priceLabel}>Assinatura por Máquina</Text>
              <Text style={styles.priceSub}>Adicione 1 slot para gerenciamento de máquina pesada</Text>
            </View>
          </View>
          {fetchingPackage ? (
            <ActivityIndicator size="small" color={Colors.light.tint} />
          ) : (
            <Text style={styles.priceValue}>{priceDisplay}</Text>
          )}
        </View>

        {/* Card Informativo Premium */}
        <View style={styles.premiumCard}>
          <View style={styles.premiumCardInner}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>PLANO PREMIUM</Text>
              </View>
              <Feather name="cpu" size={24} color="#FFF" style={{ opacity: 0.8 }} />
            </View>

            <Text style={styles.cardTitle}>Slots de Máquina</Text>
            <Text style={styles.cardDesc}>
              Acesso a relatórios diários de turno, controles de manutenção preventiva/corretiva, histórico de abastecimento e custos por hora.
            </Text>

            <View style={styles.divider} />

            <View style={styles.benefitRow}>
              <Feather name="check" size={16} color="#FFD28A" />
              <Text style={styles.benefitText}>Acesso offline e sincronização em nuvem</Text>
            </View>
            <View style={styles.benefitRow}>
              <Feather name="check" size={16} color="#FFD28A" />
              <Text style={styles.benefitText}>Relatórios ilimitados para a máquina contratada</Text>
            </View>
          </View>
        </View>

        {/* Seção de Faturamento */}
        <View style={styles.billingSection}>
          <Text style={styles.sectionTitle}>Faturamento e Segurança</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="lock" size={18} color={Colors.light.tint} style={styles.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Pagamento via Google Play</Text>
                <Text style={styles.infoDesc}>
                  Transação protegida e gerenciada diretamente pela Google. Use seus métodos de pagamento salvos na Play Store.
                </Text>
              </View>
            </View>

            <View style={[styles.infoRow, { marginTop: 14 }]}>
              <Feather name="refresh-cw" size={18} color={Colors.light.tint} style={styles.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Renovação Automática</Text>
                <Text style={styles.infoDesc}>
                  Cancelável a qualquer momento diretamente nas configurações da sua conta do Google Play.
                </Text>
              </View>
            </View>
          </View>

          {/* Erro */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color={Colors.light.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Botão de Compra Nativo */}
          <Pressable
            onPress={handlePay}
            disabled={fetchingPackage || loading}
            style={({ pressed }) => [
              styles.payBtn,
              { opacity: pressed || fetchingPackage || loading ? 0.75 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="credit-card" size={18} color="#fff" />
                <Text style={styles.payBtnText}>
                  {fetchingPackage ? "Carregando preços..." : `Assinar por R$ 75,00/mês`}
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.secureRow}>
            <Feather name="shield" size={12} color={Colors.light.textMuted} />
            <Text style={styles.secureText}>Seus dados são protegidos pelas políticas da Google Play Store</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.light.surface,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.light.border,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  scroll: { padding: 16, paddingBottom: 60, gap: 20 },

  priceBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2A2200",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#FDDCCA",
  },
  priceLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  priceLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  priceSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2, paddingRight: 8 },
  priceValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.light.tint },

  premiumCard: {
    borderRadius: 20,
    backgroundColor: Colors.light.tint,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  premiumCardInner: {
    padding: 24,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    marginTop: 8,
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    marginVertical: 8,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  benefitText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#FFF",
  },

  billingSection: { gap: 14 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },

  infoCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoIcon: { marginTop: 2 },
  infoTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  infoDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.dangerLight,
    borderRadius: 12,
    padding: 14,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.danger },

  payBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.light.tint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    marginTop: 6,
  },
  payBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.tintText },

  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secureText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.light.textMuted },

  successScreen: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 16,
  },
  successIcon: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: "#F0FDF4",
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.light.text, textAlign: "center" },
  successSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
