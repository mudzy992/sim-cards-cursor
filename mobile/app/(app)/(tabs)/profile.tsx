import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppVersion } from '@/hooks/useAppVersion';
import { useAppUpdateCheck } from '@/hooks/useAppUpdateCheck';
import { useTranslation } from '@/i18n/i18n.store';
import type { SupportedLanguage } from '@/i18n/types';
import type { ThemeMode } from '@/store/theme.store';
import {
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { Section } from '@/components/ui/Section';
import { Panel } from '@/components/ui/Panel';
import { ListRow } from '@/components/ui/ListRow';
import { ActionButton } from '@/components/ui/ActionButton';
import { SegmentedFilter } from '@/components/ui/SegmentedFilter';
import { hapticTap } from '@/utils/haptics';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { versionName, buildNumber } = useAppVersion();
  const update = useAppUpdateCheck();
  const { mode, setMode, type } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const confirmLogout = () =>
    Alert.alert(
      t('mobile.profile.logoutConfirmTitle'),
      t('mobile.profile.logoutConfirmMessage'),
      [
        { text: t('mobile.common.cancel'), style: 'cancel' },
        {
          text: t('mobile.profile.logoutButton'),
          style: 'destructive',
          onPress: () =>
            void logout().then(() => router.replace('/(auth)/login')),
        },
      ],
    );

  const handleManualUpdateCheck = () => {
    void (async () => {
      try {
        const result = await update.checkNow();
        if (!result.release) {
          Alert.alert(
            t('mobile.common.error'),
            t('mobile.update.checkFailed'),
          );
          return;
        }
        const versionLabel = `${result.release.versionName} (${result.release.versionCode})`;
        if (result.hasUpdate) {
          Alert.alert(
            t('mobile.update.availableAlertTitle', { version: versionLabel }),
            t('mobile.update.availableAlertMessage'),
            [
              { text: t('mobile.common.cancel'), style: 'cancel' },
              {
                text: t('mobile.update.downloadButton'),
                onPress: () => {
                  void update.openDownload().then((ok) => {
                    if (!ok) {
                      Alert.alert(
                        t('mobile.common.error'),
                        t('mobile.update.openFailed'),
                      );
                    }
                  });
                },
              },
            ],
          );
        } else {
          Alert.alert(
            t('mobile.update.upToDateTitle'),
            t('mobile.update.upToDateMessage', { version: versionLabel }),
          );
        }
      } catch {
        Alert.alert(t('mobile.common.error'), t('mobile.update.checkFailed'));
      }
    })();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title={t('mobile.profile.title')}
        subtitle={t('mobile.profile.subtitle')}
        onBack={() => router.replace('/(app)/(tabs)/home')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0] ?? ''}
              {user?.lastName?.[0] ?? ''}
            </Text>
          </View>
          <View style={styles.identityBody}>
            <Text style={styles.name}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={type.caption}>{user?.email ?? '—'}</Text>
          </View>
        </View>

        <Section
          label={t('mobile.profile.appearanceSection')}
          hint={t('mobile.profile.appearanceHint')}
        >
          <Panel>
            <Text style={styles.controlLabel}>
              {t('mobile.profile.themeLabel')}
            </Text>
            <SegmentedFilter<ThemeMode>
              testID="profile-theme-filter"
              value={mode}
              onChange={(next) => {
                hapticTap();
                void setMode(next);
              }}
              options={[
                { key: 'system', label: t('mobile.profile.themeSystem') },
                { key: 'light', label: t('mobile.profile.themeLight') },
                { key: 'dark', label: t('mobile.profile.themeDark') },
              ]}
            />
            <Text style={[styles.controlLabel, styles.controlLabelSpaced]}>
              {t('mobile.profile.languageLabel')}
            </Text>
            <SegmentedFilter<SupportedLanguage>
              testID="profile-language-filter"
              value={language}
              onChange={(next) => {
                hapticTap();
                void setLanguage(next);
              }}
              options={[
                { key: 'bs', label: t('language.bs') },
                { key: 'en', label: t('language.en') },
              ]}
            />
          </Panel>
        </Section>

        <Section label={t('mobile.profile.organizationSection')}>
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title={t('mobile.profile.roleLabel')}
                value={user?.role ?? '—'}
              />
              <ListRow
                title={t('mobile.profile.branchLabel')}
                value={user?.branch?.name ?? '—'}
                divider
              />
            </View>
          </Panel>
        </Section>

        <Section label={t('mobile.profile.offlineSection')}>
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title={t('mobile.profile.offlineInventoryTitle')}
                subtitle={t('mobile.profile.offlineInventorySubtitle')}
                icon="archive-outline"
                iconTone="info"
                onPress={() => router.push('/(app)/offline-inventory')}
              />
              <ListRow
                title={t('mobile.profile.outboxTitle')}
                subtitle={t('mobile.profile.outboxSubtitle')}
                icon="cloud-upload-outline"
                iconTone="warning"
                onPress={() => router.push('/(app)/outbox')}
                divider
              />
            </View>
          </Panel>
        </Section>

        <Section label={t('mobile.profile.appSection')}>
          <Panel padding="none" style={styles.appPanel}>
            <View style={styles.panelInner}>
              <ListRow
                title={t('mobile.profile.versionLabel')}
                value={`${versionName} (${buildNumber})`}
              />
              {update.hasUpdate && update.release ? (
                <ListRow
                  title={t('mobile.update.availableBadge')}
                  subtitle={`${update.release.versionName} (${update.release.versionCode})`}
                  icon="download-outline"
                  iconTone={update.isMandatory ? 'danger' : 'info'}
                  onPress={() => void update.openDownload()}
                  divider
                />
              ) : null}
            </View>
          </Panel>
          <ActionButton
            testID="profile-check-update-btn"
            title={
              update.isChecking
                ? t('mobile.update.checking')
                : t('mobile.update.checkButton')
            }
            icon="cloud-download-outline"
            variant="secondary"
            loading={update.isChecking}
            onPress={handleManualUpdateCheck}
            style={styles.updateButton}
          />
        </Section>

        <ActionButton
          testID="profile-logout-btn"
          title={t('mobile.profile.logoutButton')}
          icon="log-out-outline"
          variant="danger"
          onPress={confirmLogout}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => ({
  root: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  identity: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: palette.brand,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarText: {
    color: palette.inverse,
    fontSize: 21,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  identityBody: { flex: 1 },
  name: {
    fontSize: 21,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    marginBottom: 3,
  },
  controlLabel: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: spacing.sm,
  },
  controlLabelSpaced: {
    marginTop: spacing.lg,
  },
  panelInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  appPanel: { marginBottom: spacing.md },
  updateButton: { marginBottom: spacing.lg },
});
