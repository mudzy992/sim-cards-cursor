import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppVersion } from '@/hooks/useAppVersion';
import { palette, radii, spacing, type } from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { Section } from '@/components/ui/Section';
import { Panel } from '@/components/ui/Panel';
import { ListRow } from '@/components/ui/ListRow';
import { ActionButton } from '@/components/ui/ActionButton';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { versionName, buildNumber } = useAppVersion();
  const confirmLogout = () => Alert.alert('Odjava', 'Želite li se odjaviti sa ovog uređaja?', [
    { text: 'Odustani', style: 'cancel' },
    { text: 'Odjavi se', style: 'destructive', onPress: () => void logout().then(() => router.replace('/(auth)/login')) },
  ]);

  return <SafeAreaView style={styles.root} edges={['top']}>
    <ScreenTitleBar title="Profil" subtitle="Korisnik i podaci uređaja" />
    <View style={styles.content}>
      <View style={styles.identity}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user?.firstName?.[0] ?? ''}{user?.lastName?.[0] ?? ''}</Text></View>
        <View style={styles.identityBody}><Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
          <Text style={type.caption}>{user?.email ?? '—'}</Text></View>
      </View>
      <Section label="Organizacija">
        <Panel padding="none"><View style={styles.panelInner}>
          <ListRow title="Uloga" value={user?.role ?? '—'} />
          <ListRow title="Poslovnica" value={user?.branch?.name ?? '—'} divider />
        </View></Panel>
      </Section>
      <Section label="Offline rad">
        <Panel padding="none"><View style={styles.panelInner}>
          <ListRow title="Offline inventar" subtitle="SIM kartice dostupne bez interneta" icon="archive-outline" iconTone="info" onPress={() => router.push('/(app)/offline-inventory')} />
          <ListRow title="Neposlato" subtitle="Akcije koje čekaju mrežu" icon="cloud-upload-outline" iconTone="warning" onPress={() => router.push('/(app)/outbox')} divider />
        </View></Panel>
      </Section>
      <Section label="Aplikacija">
        <ListRow title="Verzija" value={`${versionName} (${buildNumber})`} />
      </Section>
      <ActionButton title="Odjavi se" icon="log-out-outline" variant="danger" onPress={confirmLogout} />
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.xl },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xxl },
  avatar: { width: 64, height: 64, borderRadius: radii.lg, backgroundColor: palette.graphite, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.inverse, fontSize: 21, fontWeight: '700', letterSpacing: 0.5 },
  identityBody: { flex: 1 },
  name: { fontSize: 21, fontWeight: '700', color: palette.textPrimary, marginBottom: 3 },
  panelInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
});