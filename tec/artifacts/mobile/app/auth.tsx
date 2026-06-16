import { Feather } from "@expo/vector-icons";
import { Redirect } from "expo-router";
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
import { useAuth } from "@/contexts/AuthContext";

type Mode = "login" | "register";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoading, login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If session is being restored, show nothing (splash is still visible)
  if (isLoading) return null;

  // Already logged in — go to app
  if (user) return <Redirect href="/(tabs)" />;

  const reset = () => {
    setUsername(""); setPassword(""); setConfirmPassword("");
    setError(null); setShowPassword(false);
  };

  const switchMode = (m: Mode) => { reset(); setMode(m); };

  const handleSubmit = async () => {
    setError(null);
    const u = username.trim().toLowerCase();
    const p = password;

    if (!u || !p) { setError("Preencha todos os campos."); return; }
    if (u.length < 3) { setError("Usuário deve ter pelo menos 3 caracteres."); return; }
    if (p.length < 6) { setError("Senha deve ter pelo menos 6 caracteres."); return; }
    if (mode === "register" && p !== confirmPassword) {
      setError("As senhas não coincidem."); return;
    }

    setLoading(true);
    const result = mode === "register" ? await register(u, p) : await login(u, p);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={s.brand}>
          <View style={s.logoBox}>
            <Feather name="tool" size={36} color={Colors.light.tint} />
          </View>
          <Text style={s.appName}>Tecmaquinas</Text>
          <Text style={s.appSub}>Controle de Sistemas</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          {/* Mode tabs */}
          <View style={s.modeTabs}>
            <Pressable
              onPress={() => switchMode("login")}
              style={[s.modeTab, mode === "login" && s.modeTabActive]}
            >
              <Text style={[s.modeTabText, mode === "login" && s.modeTabTextActive]}>
                Entrar
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode("register")}
              style={[s.modeTab, mode === "register" && s.modeTabActive]}
            >
              <Text style={[s.modeTabText, mode === "register" && s.modeTabTextActive]}>
                Criar conta
              </Text>
            </Pressable>
          </View>

          <Text style={s.cardTitle}>
            {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
          </Text>
          <Text style={s.cardSub}>
            {mode === "login"
              ? "Entre com seu usuário e senha para acessar seus dados."
              : "Escolha um usuário e senha para começar."}
          </Text>

          {/* Username */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Usuário</Text>
            <View style={s.inputRow}>
              <Feather name="user" size={16} color={Colors.light.textMuted} style={s.inputIcon} />
              <TextInput
                style={s.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Ex: joao.silva"
                placeholderTextColor={Colors.light.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Senha</Text>
            <View style={s.inputRow}>
              <Feather name="lock" size={16} color={Colors.light.textMuted} style={s.inputIcon} />
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={Colors.light.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType={mode === "register" ? "next" : "done"}
                onSubmitEditing={mode === "login" ? handleSubmit : undefined}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={Colors.light.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Confirm password (register only) */}
          {mode === "register" && (
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Confirmar senha</Text>
              <View style={s.inputRow}>
                <Feather name="lock" size={16} color={Colors.light.textMuted} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repita a senha"
                  placeholderTextColor={Colors.light.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>
            </View>
          )}

          {/* Error */}
          {!!error && (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={14} color={Colors.light.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [s.submitBtn, { opacity: pressed || loading ? 0.85 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color={Colors.light.tintText} />
            ) : (
              <>
                <Feather name={mode === "login" ? "log-in" : "user-plus"} size={18} color={Colors.light.tintText} />
                <Text style={s.submitText}>
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </Text>
              </>
            )}
          </Pressable>

          {/* Switch mode */}
          <Pressable onPress={() => switchMode(mode === "login" ? "register" : "login")} style={s.switchLink}>
            <Text style={s.switchText}>
              {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
              <Text style={s.switchTextBold}>
                {mode === "login" ? "Criar conta" : "Entrar"}
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  scroll: {
    flexGrow: 1, justifyContent: "center",
    paddingHorizontal: 24, paddingVertical: 32, gap: 32,
  },
  brand: { alignItems: "center", gap: 8 },
  logoBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "#2A2200",
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 8,
  },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.light.text },
  appSub: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24, padding: 24, gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 6,
  },
  modeTabs: {
    flexDirection: "row", backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 14, padding: 4,
  },
  modeTab: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
  },
  modeTabActive: {
    backgroundColor: Colors.light.surface,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  modeTabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },
  modeTabTextActive: { color: Colors.light.tint, fontFamily: "Inter_600SemiBold" },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.light.text, marginTop: 4 },
  cardSub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary, lineHeight: 19, marginTop: -8,
  },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.text },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.light.surfaceSecondary, borderRadius: 14,
    paddingHorizontal: 14, height: 52,
    borderWidth: 1.5, borderColor: Colors.light.border,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.light.text },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.light.dangerLight, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.light.danger },
  submitBtn: {
    height: 54, borderRadius: 16, backgroundColor: Colors.light.tint,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    shadowColor: Colors.light.tint, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5, marginTop: 4,
  },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.light.tintText },
  switchLink: { alignItems: "center", paddingVertical: 4 },
  switchText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.light.textSecondary },
  switchTextBold: { fontFamily: "Inter_600SemiBold", color: Colors.light.tint },
});
