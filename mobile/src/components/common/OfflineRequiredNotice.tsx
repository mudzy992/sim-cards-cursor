import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useTranslation } from '@/i18n/i18n.store';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';

export function OfflineRequiredNotice({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { palette, type } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.root} testID="offline-required-notice">
      <View style={styles.icon}>
        <Ionicons
          name="cloud-offline-outline"
          size={28}
          color={palette.warning}
        />
      </View>
      <Text style={styles.title}>
        {title ?? t('mobile.common.noNetworkTitle')}
      </Text>
      <Text style={[type.caption, styles.message]}>
        {message ?? t('mobile.common.noNetworkMessage')}
      </Text>
      {onRetry ? (
        <ActionButton
          title={t('mobile.common.retry')}
          icon="refresh"
          onPress={onRetry}
          fullWidth={false}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const createStyles = (palette: ThemePalette) => ({
  root: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xl,
    backgroundColor: palette.background,
  },
  icon: {
    width: 58,
    height: 58,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: palette.warningSoft,
    borderWidth: 1,
    borderColor: palette.warningBorder,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 19,
    fontWeight: '700' as const,
  },
  message: {
    marginTop: spacing.sm,
    textAlign: 'center' as const,
    lineHeight: 19,
  },
  action: { minWidth: 170, marginTop: spacing.xl },
});
