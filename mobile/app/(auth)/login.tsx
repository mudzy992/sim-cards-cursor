import { useRouter } from 'expo-router';
import axios from 'axios';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import {
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { useTranslation } from '@/i18n/i18n.store';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { status: serverStatus, check: checkServer } = useServerHealth({
    timeoutMs: 2500,
  });
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'user' | 'pass' | null>(
    null,
  );

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

  const canSubmit =
    !isLoading && emailOrUsername.trim().length > 0 && password.length > 0;

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
          <View style={styles.brandBlock}>
            <ServerStatusChip
              status={serverStatus}
              onRetry={() => void checkServer()}
              t={t}
            />
            <View style={styles.logoRow}>
              <LogoWatermark />
              <Text style={styles.appName}>
                {t('mobile.auth.login.appName')}
              </Text>
              <Text style={styles.appNameSub}>
                {t('mobile.auth.login.appTagline')}
              </Text>
            </View>
          </View>

          <View style={styles.formBlock}>
            <Text style={type.screenTitle}>
              {t('mobile.auth.login.title')}
            </Text>
            <Text style={[type.caption, styles.formIntro]}>
              {t('mobile.auth.login.intro')}
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={palette.danger}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={type.sectionLabel}>
                {t('mobile.auth.login.emailOrUsernameLabel')}
              </Text>
              <TextInput
                testID="login-email-input"
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
                style={[
                  styles.input,
                  focusedField === 'user' && styles.inputFocused,
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={type.sectionLabel}>
                {t('mobile.auth.login.passwordLabel')}
              </Text>
              <TextInput
                testID="login-password-input"
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
                style={[
                  styles.input,
                  focusedField === 'pass' && styles.inputFocused,
                ]}
              />
            </View>

            <ActionButton
              testID="login-submit-btn"
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

function ServerStatusChip({
  status,
  onRetry,
  t,
}: {
  status: 'online' | 'offline' | 'checking' | string;
  onRetry: () => void;
  t: (key: string) => string;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tone: StatusTone =
    status === 'online'
      ? 'success'
      : status === 'offline'
        ? 'danger'
        : 'neutral';
  const label =
    status === 'online'
      ? t('mobile.auth.login.serverOnline')
      : status === 'offline'
        ? t('mobile.auth.login.serverOffline')
        : t('mobile.auth.login.serverChecking');

  return (
    <View style={styles.chipRow}>
      {status === 'checking' ? (
        <ActivityIndicator
          size="small"
          color={palette.cameraFg}
          style={styles.chipSpinner}
        />
      ) : null}
      <StatusBadge
        tone={tone}
        label={label}
        showDot={status !== 'checking'}
      />
      <Pressable
        onPress={onRetry}
        hitSlop={8}
        accessibilityRole="button"
        style={styles.retry}
      >
        <Text style={styles.retryText}>
          {t('mobile.auth.login.retryCheck')}
        </Text>
      </Pressable>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => ({
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  chipSpinner: { marginRight: 2 },
  retry: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.graphiteSoft,
  },
  retryText: {
    color: palette.cameraFg,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  logoRow: { alignItems: 'flex-start' as const },
  appName: {
    marginTop: spacing.lg,
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: palette.cameraFg,
  },
  appNameSub: {
    marginTop: spacing.xs,
    fontSize: 13,
    fontWeight: '500' as const,
    color: palette.textMuted,
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
  formIntro: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    lineHeight: 19,
  },

  errorBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    backgroundColor: palette.dangerSoft,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    color: palette.danger,
    fontSize: 13,
    fontWeight: '600' as const,
  },

  fieldGroup: { marginBottom: spacing.lg },
  input: {
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: palette.borderStrong,
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
    textAlign: 'center' as const,
    color: palette.textMuted,
  },
});
