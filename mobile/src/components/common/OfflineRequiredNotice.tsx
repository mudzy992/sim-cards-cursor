import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type } from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';

export function OfflineRequiredNotice({
  title = 'Nema mreže',
  message = 'Ovaj ekran zahtijeva internet vezu.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.icon}>
        <Ionicons name="cloud-offline-outline" size={28} color={palette.warning} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={[type.caption, styles.message]}>{message}</Text>
      {onRetry ? (
        <ActionButton
          title="Pokušaj ponovo"
          icon="refresh"
          onPress={onRetry}
          fullWidth={false}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: palette.background,
  },
  icon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.warningSoft,
    borderWidth: 1,
    borderColor: palette.warningBorder,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  title: { color: palette.textPrimary, fontSize: 19, fontWeight: '700' },
  message: { marginTop: spacing.sm, textAlign: 'center', lineHeight: 19 },
  action: { minWidth: 170, marginTop: spacing.xl },
});