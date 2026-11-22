import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  notificationsApi,
  type Notification,
} from '@/api/notifications.api';
import { normalizeDeepLink } from '@/utils/deeplink';
import { useTranslation } from '@/i18n/i18n.store';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, language } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useThemedStyles(createStyles);

  const query = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationsApi.list({ limit: 50 }),
  });
  const notifications = query.data ?? [];
  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['notifications-unread-count'],
    });
    void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
  };
  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: invalidate,
  });
  const unread = notifications.filter((item) => !item.isRead).length;

  const open = (item: Notification) => {
    if (!item.isRead) markRead.mutate(item.id);
    router.push((normalizeDeepLink(item.link) ?? '/notifications') as never);
  };

  const locale = language === 'en' ? 'en-GB' : 'bs-BA';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title={t('mobile.notifications.title')}
        subtitle={
          unread
            ? t('mobile.notifications.unreadSubtitle', { count: unread })
            : t('mobile.notifications.allReadSubtitle')
        }
        onBack={() => router.back()}
        actionLabel={unread ? t('mobile.notifications.readAllAction') : undefined}
        actionIcon={unread ? 'checkmark-done' : undefined}
        onAction={unread ? () => markAll.mutate() : undefined}
      />
      {query.isLoading ? (
        <View style={styles.loading}>
          <SkeletonRows count={6} />
        </View>
      ) : query.isError ? (
        <View style={styles.state}>
          <Text style={styles.error}>{t('mobile.notifications.loadError')}</Text>
          <ActionButton
            title={t('mobile.common.retry')}
            onPress={() => void query.refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              colors={[palette.brandText]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title={t('mobile.notifications.emptyTitle')}
              description={t('mobile.notifications.emptyDesc')}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`notification-row-${item.id}`}
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.row,
                !item.isRead && styles.rowUnread,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.icon, !item.isRead && styles.iconUnread]}>
                <Ionicons
                  name={
                    item.isRead ? 'notifications-outline' : 'notifications'
                  }
                  size={18}
                  color={item.isRead ? palette.textMuted : palette.brandText}
                />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.titleRow}>
                  <Text
                    style={[
                      type.bodyStrong,
                      item.isRead && styles.readTitle,
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {!item.isRead ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={[type.caption, styles.message]} numberOfLines={3}>
                  {item.message}
                </Text>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleString(locale)}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={palette.textMuted}
              />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => ({
  root: { flex: 1, backgroundColor: palette.background },
  loading: { padding: spacing.xl },
  state: { padding: spacing.xl },
  error: { color: palette.danger, marginBottom: spacing.lg },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  rowUnread: { backgroundColor: palette.brandSoft },
  pressed: { opacity: 0.72 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.surfaceMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconUnread: { backgroundColor: palette.brandSoftStrong },
  rowBody: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  readTitle: { color: palette.textSecondary },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.brandText,
  },
  message: { marginTop: 3, lineHeight: 18 },
  date: { marginTop: spacing.sm, color: palette.textMuted, fontSize: 11 },
});
