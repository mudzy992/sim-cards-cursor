import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { notificationsApi } from '@/api/notifications.api';
import type { Notification } from '@/api/notifications.api';
import { colors } from '@/theme/colors';

function NotificationItem({
  item,
  onPress,
}: {
  item: Notification;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 16,
        backgroundColor: item.isRead ? '#f8fafc' : '#f0fdf4',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: item.isRead ? '400' : '600',
            color: '#0f172a',
            flex: 1,
          }}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={{ fontSize: 11, color: '#94a3b8' }}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text
        style={{ fontSize: 13, color: '#64748b' }}
        numberOfLines={2}
      >
        {item.message}
      </Text>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationsApi.list({ limit: 50 }),
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const handleItemPress = (item: Notification) => {
    if (!item.isRead) {
      markAsReadMutation.mutate(item.id);
    }
    if (item.link) {
      router.push(item.link as never);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notifikacije',
          headerRight: () =>
            unreadCount > 0 ? (
              <Pressable
                onPress={() => markAllAsReadMutation.mutate()}
                style={{ padding: 8 }}
              >
                <Text style={{ color: colors.link, fontSize: 14, fontWeight: '500' }}>
                  Označi sve pročitano
                </Text>
              </Pressable>
            ) : null,
        }}
      />
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem item={item} onPress={() => handleItemPress(item)} />
          )}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>
                Nema notifikacija
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => void refetch()}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </>
  );
}
