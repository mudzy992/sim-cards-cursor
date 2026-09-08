import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { notificationsApi, type Notification } from '@/api/notifications.api';
import { normalizeDeepLink } from '@/utils/deeplink';
import { palette, spacing, type } from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['notifications-list'], queryFn: () => notificationsApi.list({ limit: 50 }) });
  const notifications = query.data ?? [];
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
  };
  const markRead = useMutation({ mutationFn: (id: string) => notificationsApi.markAsRead(id), onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: () => notificationsApi.markAllAsRead(), onSuccess: invalidate });
  const unread = notifications.filter((item) => !item.isRead).length;

  const open = (item: Notification) => {
    if (!item.isRead) markRead.mutate(item.id);
    router.push((normalizeDeepLink(item.link) ?? '/notifications') as never);
  };

  return <SafeAreaView style={styles.root} edges={['top']}>
    <ScreenTitleBar title="Notifikacije" subtitle={unread ? `${unread} nepročitanih` : 'Sve je pročitano'}
      onBack={() => router.back()}
      actionLabel={unread ? 'Pročitaj sve' : undefined} actionIcon={unread ? 'checkmark-done' : undefined}
      onAction={unread ? () => markAll.mutate() : undefined} />
    {query.isLoading ? <View style={styles.loading}><SkeletonRows count={6} /></View> : query.isError ? (
      <View style={styles.state}><Text style={styles.error}>Notifikacije nije moguće učitati.</Text>
        <ActionButton title="Pokušaj ponovo" onPress={() => void query.refetch()} /></View>
    ) : <FlatList data={notifications} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} colors={[palette.brand]} />}
      ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="Nema notifikacija"
        description="Nova zaduženja i važne operativne poruke pojavit će se ovdje." />}
      renderItem={({ item }) => <Pressable onPress={() => open(item)}
        style={({ pressed }) => [styles.row, !item.isRead && styles.rowUnread, pressed && styles.pressed]}>
        <View style={[styles.icon, !item.isRead && styles.iconUnread]}>
          <Ionicons name={item.isRead ? 'notifications-outline' : 'notifications'} size={18}
            color={item.isRead ? palette.textMuted : palette.brand} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.titleRow}><Text style={[type.bodyStrong, item.isRead && styles.readTitle]} numberOfLines={1}>{item.title}</Text>
            {!item.isRead ? <View style={styles.unreadDot} /> : null}</View>
          <Text style={[type.caption, styles.message]} numberOfLines={3}>{item.message}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString('bs-BA')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
      </Pressable>} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  loading: { padding: spacing.xl },
  state: { padding: spacing.xl },
  error: { color: palette.danger, marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  rowUnread: { backgroundColor: palette.brandSoft },
  pressed: { opacity: 0.72 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: palette.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  iconUnread: { backgroundColor: palette.brandSoftStrong },
  rowBody: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  readTitle: { color: palette.textSecondary },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: palette.brand },
  message: { marginTop: 3, lineHeight: 18 },
  date: { marginTop: spacing.sm, color: palette.textMuted, fontSize: 11 },
});