import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { apiUrl, useAuth } from "@/contexts/AuthContext";
import { addCredit } from "@/utils/machineCredits";

const MP_BASE = "https://api.mercadopago.com";

// ─── Formatadores ─────────────────────────────────────────────────────────────

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

function formatCvv(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

function getCardBrand(number: string): string {
  const n = number.replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6(?:011|5)/.test(n)) return "Elo";
  if (/^(606282|3841)/.test(n)) return "Hipercard";
  return "";
}

// Detecta o payment_method_id do Mercado Pago a partir do número do cartão
function getMPPaymentMethodId(number: string): string {
  const n = number.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "master";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(n)) return "elo";
  if (/^(606282|3841)/.test(n)) return "hipercard";
  return "visa";
}

// ─── Tela de Pagamento ────────────────────────────────────────────────────────

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [holderName, setHolderName] = useState("");
  const [cpf, setCpf] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const cardBrand = getCardBrand(cardNumber);
  const digitsOnly = cardNumber.replace(/\s/g, "");
  const cpfDigits = cpf.replace(/\D/g, "");
  const isValid =
    digitsOnly.length === 16 &&
    expiry.length === 5 &&
    cvv.length >= 3 &&
    holderName.trim().length >= 2 &&
    cpfDigits.length === 11;

  const handlePay = async () => {
    setError(null);
    setLoading(true);

    try {
      // 1. Buscar public key do MP no nosso backend
      const pkRes = await fetch(apiUrl("/mp/public-key"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!pkRes.ok) {
        const d = await pkRes.json();
        throw new Error(d.error ?? "Erro ao obter chave pública");
      }
      const { publicKey } = await pkRes.json();

      // 2. Tokenizar cartão diretamente na API do Mercado Pago
      const [expMonth, expYear] = expiry.split("/");
      const tokenRes = await fetch(`${MP_BASE}/v1/card_tokens?public_key=${publicKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: digitsOnly,
          expiration_month: parseInt(expMonth, 10),
          expiration_year: parseInt("20" + expYear, 10),
          security_code: cvv,
          cardholder: {
            name: holderName.trim(),
            identification: { type: "CPF", number: cpfDigits },
          },
        }),
      });

      const tokenData = await tokenRes.json() as any;
      if (!tokenRes.ok || !tokenData.id) {
        const cause = tokenData?.cause?.[0]?.description ?? tokenData?.message ?? "Dados do cartão inválidos";
        throw new Error(cause);
      }

      const cardTokenId: string = tokenData.id;
      const firstSix: string = tokenData.first_six_digits ?? digitsOnly.slice(0, 6);

      // 3. Buscar o payment_method_id real via BIN lookup
      const binRes = await fetch(
        `${MP_BASE}/v1/payment_methods/search?public_key=${publicKey}&bin=${firstSix}&locale=pt-BR`
      );
      const binData = await binRes.json() as any;
      const results: any[] = binData?.results ?? [];
      // Prefere credit_card, depois debit_card — ignora digital_currency (Mercado Crédito) etc.
      const cardResult =
        results.find((r: any) => r.payment_type_id === "credit_card") ??
        results.find((r: any) => r.payment_type_id === "debit_card") ??
        results[0];
      const paymentMethodId: string =
        cardResult?.id ?? getMPPaymentMethodId(cardNumber);

      // 4. Criar pagamento no nosso backend
      const payRes = await fetch(apiUrl("/mp/create-payment"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cardTokenId, installments: 1, paymentMethodId, cpf: cpfDigits }),
      });

      const payData = await payRes.json() as any;

      if (payData.status === "approved") {
        // Salva o crédito ANTES de navegar, para garantir que persiste
        // mesmo que o usuário feche o app antes de concluir o cadastro
        await addCredit(String(payData.id ?? payData.payment_id ?? Date.now()));
        setSuccess(true);
        setTimeout(() => router.replace("/machine/new"), 1500);
      } else {
        throw new Error(payData.error ?? "Pagamento não aprovado");
      }
    } catch (err: any) {
      setError(err.message ?? "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (success) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.successScreen}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={56} color="#22C55E" />
          </View>
          <Text style={styles.successTitle}>Pagamento confirmado!</Text>
          <Text style={styles.successSub}>
            R$ 70,00 processado com sucesso.{"\n"}Redirecionando para o cadastro...
          </Text>
          <ActivityIndicator color={Colors.light.tint} style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner de preço */}
        <View style={styles.priceBanner}>
          <View style={styles.priceLeft}>
            <Feather name="shield" size={20} color={Colors.light.tint} />
            <View>
              <Text style={styles.priceLabel}>Assinatura mensal por máquina</Text>
              <Text style={styles.priceSub}>Cobrado mensalmente por máquina cadastrada</Text>
            </View>
          </View>
          <Text style={styles.priceValue}>R$ 70/mês</Text>
        </View>

        {/* Preview do cartão */}
        <View style={styles.cardPreview}>
          <View style={styles.cardPreviewInner}>
            <View style={styles.cardTopRow}>
              <View style={styles.chip} />
              <Text style={styles.cardBrandText}>{cardBrand || "Cartão"}</Text>
            </View>
            <Text style={styles.cardNumberDisplay}>
              {cardNumber || "•••• •••• •••• ••••"}
            </Text>
            <View style={styles.cardBottomRow}>
              <View>
                <Text style={styles.cardFieldLabel}>TITULAR</Text>
                <Text style={styles.cardFieldValue}>
                  {holderName.toUpperCase() || "SEU NOME"}
                </Text>
              </View>
              <View>
                <Text style={styles.cardFieldLabel}>VALIDADE</Text>
                <Text style={styles.cardFieldValue}>{expiry || "MM/AA"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Formulário */}
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Dados do cartão</Text>

          {/* Número */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Número do cartão</Text>
            <View style={styles.inputRow}>
              <Feather name="credit-card" size={16} color={Colors.light.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                value={cardNumber}
                onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                placeholder="0000 0000 0000 0000"
                placeholderTextColor={Colors.light.textMuted}
                keyboardType="numeric"
                maxLength={19}
              />
            </View>
          </View>

          {/* Validade + CVV */}
          <View style={styles.rowFields}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Validade</Text>
              <View style={styles.inputRow}>
                <Feather name="calendar" size={16} color={Colors.light.textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.input}
                  value={expiry}
                  onChangeText={(t) => setExpiry(formatExpiry(t))}
                  placeholder="MM/AA"
                  placeholderTextColor={Colors.light.textMuted}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>CVV</Text>
              <View style={styles.inputRow}>
                <Feather name="lock" size={16} color={Colors.light.textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.input}
                  value={cvv}
                  onChangeText={(t) => setCvv(formatCvv(t))}
                  placeholder="•••"
                  placeholderTextColor={Colors.light.textMuted}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          {/* Nome */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nome no cartão</Text>
            <View style={styles.inputRow}>
              <Feather name="user" size={16} color={Colors.light.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                value={holderName}
                onChangeText={setHolderName}
                placeholder="Como está no cartão"
                placeholderTextColor={Colors.light.textMuted}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* CPF */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>CPF do titular</Text>
            <View style={styles.inputRow}>
              <Feather name="file-text" size={16} color={Colors.light.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                value={cpf}
                onChangeText={(t) => {
                  const d = t.replace(/\D/g, "").slice(0, 11);
                  let formatted = d;
                  if (d.length > 9) formatted = d.slice(0,3)+"."+d.slice(3,6)+"."+d.slice(6,9)+"-"+d.slice(9);
                  else if (d.length > 6) formatted = d.slice(0,3)+"."+d.slice(3,6)+"."+d.slice(6);
                  else if (d.length > 3) formatted = d.slice(0,3)+"."+d.slice(3);
                  setCpf(formatted);
                }}
                placeholder="000.000.000-00"
                placeholderTextColor={Colors.light.textMuted}
                keyboardType="numeric"
                maxLength={14}
              />
            </View>
          </View>

          {/* Erro */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color={Colors.light.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Badge Mercado Pago */}
          <View style={styles.mpBadge}>
            <Feather name="shield" size={13} color="#009EE3" />
            <Text style={styles.mpBadgeText}>
              Pagamento processado pelo{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold", color: "#009EE3" }}>
                Mercado Pago
              </Text>
            </Text>
          </View>

          {/* Botão pagar */}
          <Pressable
            onPress={handlePay}
            disabled={!isValid || loading}
            style={({ pressed }) => [
              styles.payBtn,
              { opacity: pressed || !isValid || loading ? 0.7 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="lock" size={16} color="#fff" />
                <Text style={styles.payBtnText}>Assinar R$ 70,00/mês e cadastrar</Text>
              </>
            )}
          </Pressable>

          <View style={styles.secureRow}>
            <Feather name="shield" size={12} color={Colors.light.textMuted} />
            <Text style={styles.secureText}>Seus dados são criptografados e protegidos</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  priceSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary, marginTop: 2 },
  priceValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.light.tint },

  cardPreview: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "Colors.light.tint",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  cardPreviewInner: {
    backgroundColor: Colors.light.tint,
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chip: {
    width: 36, height: 28, borderRadius: 6,
    backgroundColor: "#FFD28A",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  cardBrandText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff", opacity: 0.9 },
  cardNumberDisplay: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: "#fff", letterSpacing: 2 },
  cardBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cardFieldLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", letterSpacing: 1 },
  cardFieldValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff", marginTop: 2 },

  form: { gap: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.text },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text },
  rowFields: { flexDirection: "row", gap: 12 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.dangerLight,
    borderRadius: 12,
    padding: 14,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.danger },

  mpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E8F4FB",
    borderRadius: 12,
    padding: 12,
  },
  mpBadgeText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, lineHeight: 18,
  },

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
  },
  payBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.light.tintText },

  secureRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  secureText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.light.textMuted },

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
    fontSize: 15, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, textAlign: "center", lineHeight: 22,
  },
});
