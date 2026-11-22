import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { simCardsApi, type MobileSimCard } from '@/api/sim-cards.api';
import { useAuthStore } from '@/store/auth.store';
import { useTranslation } from '@/i18n/i18n.store';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
  type ThemeTypography,
} from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { Panel } from '@/components/ui/Panel';
import { ListRow } from '@/components/ui/ListRow';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { hapticSuccess } from '@/utils/haptics';

export default function ScanResultScreen() {
  const router = useRouter();
  const { type } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const params = useLocalSearchParams<{ iccid?: string | string[] }>();
  const iccid =
    (typeof params.iccid === 'string'
      ? params.iccid
      : params.iccid?.[0]
    )?.trim() ?? '';
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);

  useEffect(() => {
    setActionMessage(null);
    setActionError(null);
    setJustClaimed(false);
  }, [iccid]);
  const query = useQuery({
    queryKey: ['scan-result', iccid],
    queryFn: () => simCardsApi.scanByIccidWithOffline(iccid),
    enabled: Boolean(iccid),
  });
  const result = query.data as
    | (MobileSimCard & { fromOfflineCache?: boolean })
    | undefined;
  const claim = useMutation({
    mutationFn: (id: string) => simCardsApi.claimById(id),
    onSuccess: async () => {
      hapticSuccess();
      setActionError(null);
      setActionMessage(t('mobile.scan.result.claimSuccess'));
      setJustClaimed(true);
      await query.refetch();
    },
    onError: (error) => {
      setActionMessage(null);
      setActionError(
        getBackendMessage(error, t('mobile.scan.result.claimFailed')),
      );
    },
  });

  const assignedToMe =
    result?.status === 'ASSIGNED' && result.assignedTo?.id === currentUserId;
  const assignedToAnother =
    result?.status === 'ASSIGNED' &&
    Boolean(result.assignedTo?.id) &&
    result.assignedTo?.id !== currentUserId;
  const canClaim = result?.status === 'AVAILABLE';
  const canCreateRecord = Boolean(result && (assignedToMe || justClaimed));
  const status = useMemo((): { label: string; tone: StatusTone } => {
    if (!result) {
      return { label: t('mobile.scan.result.statusUnknown'), tone: 'neutral' };
    }
    if (result.status === 'AVAILABLE') {
      return { label: t('mobile.scan.result.statusAvailable'), tone: 'success' };
    }
    if (result.status === 'ASSIGNED') {
      return { label: t('mobile.scan.result.statusAssigned'), tone: 'warning' };
    }
    if (result.status === 'INSTALLED') {
      return { label: t('mobile.scan.result.statusInstalled'), tone: 'info' };
    }
    return { label: result.status, tone: 'neutral' };
  }, [result, t]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title={t('mobile.scan.result.title')}
        subtitle={iccid || t('mobile.scan.result.noIccid')}
        onBack={() => router.back()}
      />
      {!iccid ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t('mobile.scan.result.missingIccid')}
          actionLabel={t('mobile.scan.result.newScan')}
          onAction={() => router.replace('/(app)/(tabs)/scan')}
        />
      ) : query.isLoading ? (
        <View style={styles.loading}>
          <SkeletonRows count={5} />
        </View>
      ) : query.isError || !result ? (
        <View style={styles.state}>
          <EmptyState
            icon="search-outline"
            title={
              axios.isAxiosError(query.error) &&
              query.error.response?.status === 404
                ? t('mobile.scan.result.notFoundTitle')
                : t('mobile.scan.result.unavailableTitle')
            }
            description={
              axios.isAxiosError(query.error) && !query.error.response
                ? t('mobile.scan.result.offlineNotFound')
                : getBackendMessage(
                    query.error,
                    t('mobile.scan.result.searchFailed'),
                  )
            }
            actionLabel={t('mobile.common.retry')}
            onAction={() => void query.refetch()}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {result.fromOfflineCache ? (
            <Panel tone="warning" style={styles.notice}>
              <Text style={type.bodyStrong}>
                {t('mobile.scan.result.offlineNoticeTitle')}
              </Text>
              <Text style={[type.caption, styles.noticeText]}>
                {t('mobile.scan.result.offlineNoticeBody')}
              </Text>
            </Panel>
          ) : null}

          <Panel style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={type.sectionLabel}>ICCID</Text>
              <StatusBadge tone={status.tone} label={status.label} showDot />
            </View>
            <Text style={styles.iccid} testID="scan-result-iccid">
              {result.iccid}
            </Text>
            <View style={styles.ipBlock}>
              <Text style={styles.ipLabel}>
                {t('mobile.scan.result.ipLabel')}
              </Text>
              <Text style={styles.ip}>{result.ipAddress ?? '—'}</Text>
            </View>
          </Panel>

          {actionMessage ? (
            <Panel tone="success" style={styles.notice}>
              <Text style={type.bodyStrong}>{actionMessage}</Text>
            </Panel>
          ) : null}
          {actionError ? (
            <Panel tone="danger" style={styles.notice}>
              <Text style={styles.errorText}>{actionError}</Text>
            </Panel>
          ) : null}

          {canClaim && !justClaimed ? (
            <ActionButton
              testID="scan-result-claim-btn"
              title={t('mobile.scan.result.claimButton')}
              icon="person-add-outline"
              size="lg"
              loading={claim.isPending}
              onPress={() => claim.mutate(result.id)}
              style={styles.primary}
            />
          ) : null}
          {canCreateRecord ? (
            <View style={styles.actions}>
              <ActionButton
                testID="scan-result-create-new-btn"
                title={t('mobile.scan.result.newConnection')}
                icon="construct-outline"
                size="lg"
                onPress={() =>
                  router.push({
                    pathname: '/create-record',
                    params: { simCardId: result.id },
                  })
                }
              />
              <ActionButton
                testID="scan-result-create-replacement-btn"
                title={t('mobile.scan.result.meterReplacement')}
                icon="swap-horizontal-outline"
                variant="secondary"
                size="lg"
                onPress={() =>
                  router.push({
                    pathname: '/create-record-replacement',
                    params: { simCardId: result.id },
                  })
                }
              />
            </View>
          ) : null}
          {assignedToAnother ? (
            <Panel tone="warning" style={styles.notice}>
              <Text style={type.bodyStrong}>
                {t('mobile.scan.result.assignedOtherTitle')}
              </Text>
              <Text style={[type.caption, styles.noticeText]}>
                {result.assignedTo
                  ? `${result.assignedTo.firstName} ${result.assignedTo.lastName}`
                  : ''}
              </Text>
            </Panel>
          ) : null}

          <Text style={[type.sectionLabel, styles.sectionTitle]}>
            {t('mobile.scan.result.cardDataSection')}
          </Text>
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title={t('mobile.scan.result.operator')}
                value={
                  result.assignedTo
                    ? `${result.assignedTo.firstName} ${result.assignedTo.lastName}`
                    : '—'
                }
              />
              <ListRow
                title={t('mobile.scan.result.phone')}
                value={result.phoneNumber ?? '—'}
                divider
              />
              <ListRow
                title={t('mobile.scan.result.shipment')}
                value={result.shipment?.name ?? '—'}
                divider
              />
            </View>
          </Panel>
          <View style={styles.bottomActions}>
            <ActionButton
              title={t('mobile.scan.result.refreshData')}
              icon="refresh"
              variant="secondary"
              onPress={() => void query.refetch()}
            />
            <ActionButton
              title={t('mobile.scan.result.newScan')}
              icon="barcode-outline"
              variant="dark"
              onPress={() => router.replace('/(app)/(tabs)/scan')}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function getBackendMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const value = error.response?.data?.message;
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { message?: string }).message === 'string'
  ) {
    return (value as { message: string }).message;
  }
  return fallback;
}

const createStyles = (palette: ThemePalette, type: ThemeTypography) => ({
  root: { flex: 1, backgroundColor: palette.background },
  loading: { padding: spacing.xl },
  state: { flex: 1, justifyContent: 'center' as const },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  notice: { marginBottom: spacing.lg },
  noticeText: { marginTop: spacing.xs },
  hero: { marginBottom: spacing.lg },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
  },
  iccid: { ...type.dataLarge, fontSize: 19, marginTop: spacing.lg },
  ipBlock: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  ipLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  ip: {
    ...type.dataLarge,
    color: palette.brandText,
    fontSize: 22,
    marginTop: spacing.xs,
  },
  errorText: { color: palette.danger, fontWeight: '600' as const },
  primary: { marginBottom: spacing.md },
  actions: { gap: spacing.md, marginBottom: spacing.lg },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.md },
  panelInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  bottomActions: { gap: spacing.md, marginTop: spacing.xl },
});
