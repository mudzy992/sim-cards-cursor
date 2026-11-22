import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppVersion } from '@/hooks/useAppVersion';
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
  const { mode, setMode, type } = useTheme();
  const { language, setLanguage } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const confirmLogout = () =>
    Alert.alert('Odjava', 'Želite li se odjaviti sa ovog uređaja?', [
      { text: 'Odustani', style: 'cancel' },
      {
        text: 'Odjavi se',
        style: 'destructive',
        onPress: () =>
          void logout().then(() => router.replace('/(auth)/login')),
      },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title="Profil"
        subtitle="Korisnik i postavke uređaja"
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
          label="Izgled i jezik"
          hint="Svijetla tema za rad na suncu · Tamna za slabo osvjetljenje"
        >
          <Panel>
            <Text style={styles.controlLabel}>Tema aplikacije</Text>
            <SegmentedFilter<ThemeMode>
              value={mode}
              onChange={(next) => {
                hapticTap();
                void setMode(next);
              }}
              options={[
                { key: 'system', label: 'Sistem' },
                { key: 'light', label: 'Svijetla' },
                { key: 'dark', label: 'Tamna' },
              ]}
            />
            <Text style={[styles.controlLabel, styles.controlLabelSpaced]}>
              Jezik
            </Text>
            <SegmentedFilter<SupportedLanguage>
              value={language}
              onChange={(next) => {
                hapticTap();
                void setLanguage(next);
              }}
              options={[
                { key: 'bs', label: 'Bosanski' },
                { key: 'en', label: 'English' },
              ]}
            />
          </Panel>
        </Section>

        <Section label="Organizacija">
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow title="Uloga" value={user?.role ?? '—'} />
              <ListRow
                title="Poslovnica"
                value={user?.branch?.name ?? '—'}
                divider
              />
            </View>
          </Panel>
        </Section>

        <Section label="Offline rad">
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title="Offline inventar"
                subtitle="SIM kartice dostupne bez interneta"
                icon="archive-outline"
                iconTone="info"
                onPress={() => router.push('/(app)/offline-inventory')}
              />
              <ListRow
                title="Neposlato"
                subtitle="Akcije koje čekaju mrežu"
                icon="cloud-upload-outline"
                iconTone="warning"
                onPress={() => router.push('/(app)/outbox')}
                divider
              />
            </View>
          </Panel>
        </Section>

        <Section label="Aplikacija">
          <ListRow
            title="Verzija"
            value={`${versionName} (${buildNumber})`}
          />
        </Section>

        <ActionButton
          title="Odjavi se"
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
});
