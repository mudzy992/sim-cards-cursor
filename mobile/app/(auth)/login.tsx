/**
 * LoginScreen — REDIZAJN (Faza 2)
 * Logika identična prethodnoj verziji:
 *  - useAuth().login({ emailOrUsername, password })
 *  - 401 → "Pogrešan email/korisničko ime ili lozinka."
 *  - ostale greške → getApiErrorMessage
 *  - useServerHealth + ručna provjera servera
 *  - uspjeh → router.replace('/(app)/(tabs)/home')
 * Prezentacija: brand header + neutral form (instrukcije: plava selektivno).
 */
import { useRouter } from 'expo-router';
import axios from 'axios';
import { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/utils/error.utils';
import { LogoWatermark } from '@/components/LogoWatermark';
import { useServerHealth } from '@/hooks/useServerHealth';
import { palette, radii, spacing, type } from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { useTranslation } from '@/i18n/i18n.store';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useTranslation();
  const { status: serverStatus, check: checkServer } = useServerHealth({ timeoutMs: 2500 });
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'user' | 'pass' | null>(null);

  const submit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login({ emailOrUsername, password });
      router.replace('/(app)/(tabs)/home');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError(t('mobile.auth.login.invalidCredentials'));
        return;
      }
      setError(getApiErrorMessage(err, t('mobile.auth.login.failed')));
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = !isLoading && emailOrUsername.trim().length > 0 && password.length > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ------------------------------ brand header ------------------------------ */}
          <View style={styles.brandBlock}>
            <ServerStatusChip status={serverStatus} onRetry={() => void checkServer()} t={t} />
            <View style={styles.logoRow}>
              <LogoWatermark />
              <Text style={styles.appName}>{t('mobile.auth.login.appName')}</Text>
              <Text style={styles.appNameSub}>{t('mobile.auth.login.appTagline')}</Text>
            </View>
          </View>

          {/* --------------------------------- forma --------------------------------- */}
          <View style={styles.formBlock}>
            <Text style={type.screenTitle}>{t('mobile.auth.login.title')}</Text>
            <Text style={[type.caption, styles.formIntro]}>
              {t('mobile.auth.login.intro')}
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={palette.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={type.sectionLabel}>{t('mobile.auth.login.emailOrUsernameLabel')}</Text>
              <TextInput
                value={emailOrUsername}
                onChangeText={(val) => {
                  setEmailOrUsername(val);
                  if (error) setError(null);
                }}
                placeholder={t('mobile.auth.login.emailOrUsernamePlaceholder')}
                placeholderTextColor={palette.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                onFocus={() => setFocusedField('user')}
                onBlur={() => setFocusedField(null)}
                style={[styles.input, focusedField === 'user' && styles.inputFocused]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={type.sectionLabel}>{t('mobile.auth.login.passwordLabel')}</Text>
              <TextInput
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (error) setError(null);
                }}
                placeholder="••••••••••"
                placeholderTextColor={palette.textMuted}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (canSubmit) void submit();
                }}
                onFocus={() => setFocusedField('pass')}
                onBlur={() => setFocusedField(null)}
                style={[styles.input, focusedField === 'pass' && styles.inputFocused]}
              />
            </View>

            <ActionButton
              title={t('mobile.auth.login.submitButton')}
              onPress={() => void submit()}
              loading={isLoading}
              disabled={!canSubmit}
              variant="primary"
              size="lg"
              style={styles.submit}
            />

            <Text style={[type.caption, styles.footerHint]}>
              {t('mobile.auth.login.footerHint')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------------------------- statusni chip ----------------------------- */

function ServerStatusChip({
  status,
  onRetry,
  t,
}: {
  status: 'online' | 'offline' | 'checking' | string;
  onRetry: () => void;
  t: (key: string) => string;
}) {
  const tone: StatusTone =
    status === 'online' ? 'success' : status === 'offline' ? 'danger' : 'neutral';
  const label =
    status === 'online'
      ? t('mobile.auth.login.serverOnline')
      : status === 'offline'
        ? t('mobile.auth.login.serverOffline')
        : t('mobile.auth.login.serverChecking');

  return (
    <View style={styles.chipRow}>
      {status === 'checking' ? (
        <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" style={styles.chipSpinner} />
      ) : null}
      <StatusBadge tone={tone} label={label} showDot={status !== 'checking'} />
      <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button" style={styles.retry}>
        <Text style={styles.retryText}>{t('mobile.auth.login.retryCheck')}</Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------- stilovi -------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.graphite },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  brandBlock: {
    backgroundColor: palette.graphite,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl + spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  chipSpinner: { marginRight: 2 },
  retry: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: palette.graphite0050,
  },
  retryText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  logoRow: { alignItems: 'flex-start' },
  appName: {
    marginTop: spacing.lg,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  appNameSub: {
    marginTop: spacing.xs,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.2,
  },

  formBlock: {
    flex: 1,
    backgroundColor: palette.background,
    marginTop: -spacing.xl,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  formIntro: { marginTop: spacing.xs, marginBottom: spacing.xl, lineHeight: 19 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.dangerSoft,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { flex: 1, color: palette.danger, fontSize: 13, fontWeight: '600' },

  fieldGroup: { marginBottom: spacing.lg },
  input: {
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontSize: 15,
  },
  inputFocused: { borderColor: palette.brand },

  submit: { marginTop: spacing.sm },
  footerHint: {
    marginTop: spacing.xl,
    textAlign: 'center',
    color: palette.textMuted,
  },
});
