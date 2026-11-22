import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/i18n/i18n.store';
import { radii, spacing, useTheme } from '@/theme/tokens';

export interface ConnectionPillProps {
  isOnline: boolean;
  detail?: string | null;
  attention?: boolean;
  testID?: string;
}

export function ConnectionPill({
  isOnline,
  detail,
  attention = false,
  testID,
}: ConnectionPillProps) {
  const { palette } = useTheme();
  const { t } = useTranslation();
  const tone = !isOnline || attention ? 'attention' : 'ok';
  const dotColor = tone === 'ok' ? palette.success : palette.warning;
  const bg = tone === 'ok' ? palette.successSoft : palette.warningSoft;
  const border = tone === 'ok' ? palette.successBorder : palette.warningBorder;
  const textColor = tone === 'ok' ? palette.success : palette.warning;

  const label = isOnline
    ? t('mobile.common.online')
    : t('mobile.common.offline');

  return (
    <View
      testID={testID}
      style={[styles.pill, { backgroundColor: bg, borderColor: border }]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      {detail ? (
        <Text style={[styles.detail, { color: textColor }]} numberOfLines={1}>
          · {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  detail: { fontSize: 12, fontWeight: '500', marginLeft: 4, flexShrink: 1 },
});
