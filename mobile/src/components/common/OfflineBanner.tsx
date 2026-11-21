import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useConnectivity } from '@/hooks/useConnectivity';
import { getOutboxCounts } from '@/offline/outbox';
import { useAuthStore } from '@/store/auth.store';
import { palette, radii, spacing } from '@/theme/tokens';

export function OfflineBanner({ onHeight }: { onHeight?: (height: number) => void }) {
  const { isOnline } = useConnectivity();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState<{ pending: number; failed: number }>({
    pending: 0,
    failed: 0,
  });

  useEffect(() => {
    if (!user) {
      setCounts({ pending: 0, failed: 0 });
      return;
    }
    let active = true;
    const refresh = () => {
      void getOutboxCounts(user).then((c) => {
        if (active) {
          setCounts({ pending: c.pending, failed: c.failed });
        }
      });
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, isOnline]);

  const queuedTotal = counts.pending + counts.failed;
  if (isOnline && queuedTotal === 0) return null;

  const contentTopPadding =
    Platform.OS === 'ios' ? Math.max(insets.top, 10) : Math.max(insets.top, 0) + 6;

  const hasFailed = counts.failed > 0;
  const isOffline = !isOnline;
  const accentColor = hasFailed ? palette.danger : palette.warning;

  return (
    <View
      style={[
        styles.banner,
        hasFailed ? styles.bannerDanger : undefined,
        { paddingTop: contentTopPadding },
      ]}
      onLayout={(event: LayoutChangeEvent) => onHeight?.(event.nativeEvent.layout.height)}
    >
      <Ionicons
        name={isOffline ? 'cloud-offline-outline' : hasFailed ? 'alert-circle-outline' : 'sync-outline'}
        size={17}
        color={accentColor}
      />
      <Text style={[styles.text, { color: accentColor }]} numberOfLines={2}>
        {isOffline
          ? 'Offline režim · promjene će se poslati kada se mreža vrati'
          : hasFailed
            ? `Outbox: ${counts.failed} neuspješno · ${counts.pending} na čekanju`
            : `Outbox: ${counts.pending} na čekanju za sinhronizaciju`}
      </Text>
      {queuedTotal > 0 ? (
        <Pressable
          onPress={() => router.push('/(app)/outbox')}
          style={[styles.pill, { borderColor: accentColor }]}
          accessibilityRole="button"
          accessibilityLabel="Otvori outbox red"
        >
          <Text style={[styles.pillText, { color: accentColor }]}>Outbox ({queuedTotal})</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.warningSoft,
    borderBottomWidth: 1,
    borderBottomColor: palette.warningBorder,
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
  },
  bannerDanger: {
    backgroundColor: palette.dangerSoft,
    borderBottomColor: palette.dangerBorder,
  },
  text: { flex: 1, fontWeight: '700', fontSize: 12 },
  pill: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillText: { fontSize: 11, fontWeight: '700' },
});
