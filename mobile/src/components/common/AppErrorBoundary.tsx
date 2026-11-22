import React, { type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActionButton } from '@/components/ui/ActionButton';
import { Panel } from '@/components/ui/Panel';
import { useTranslation } from '@/i18n/i18n.store';
import {
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';

interface AppErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // React captures the error in state; avoid leaking sensitive details in production logs.
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryFallback
          errorMessage={this.state.error?.message}
          onRetry={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

function ErrorBoundaryFallback({
  errorMessage,
  onRetry,
}: {
  errorMessage?: string;
  onRetry: () => void;
}) {
  const { palette, type } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView
      style={styles.root}
      edges={['top', 'bottom']}
      testID="error-boundary-screen"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="warning-outline" size={32} color={palette.danger} />
        </View>
        <Text style={[type.screenTitle, styles.title]}>
          {t('mobile.errorBoundary.title')}
        </Text>
        <Text style={[type.body, styles.subtitle]}>
          {t('mobile.errorBoundary.subtitle')}
        </Text>
        {errorMessage ? (
          <Panel tone="danger" style={styles.detailsPanel}>
            <Text style={type.sectionLabel}>
              {t('mobile.errorBoundary.detailsLabel')}
            </Text>
            <Text style={[type.dataSmall, styles.detailsText]}>
              {errorMessage}
            </Text>
          </Panel>
        ) : null}
        <ActionButton
          title={t('mobile.errorBoundary.retry')}
          icon="refresh"
          size="lg"
          onPress={onRetry}
          testID="error-boundary-retry"
          style={styles.retryButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => ({
  root: { flex: 1, backgroundColor: palette.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing.xxl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: palette.dangerSoft,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.xl,
  },
  title: { textAlign: 'center' as const },
  subtitle: {
    marginTop: spacing.sm,
    textAlign: 'center' as const,
    color: palette.textSecondary,
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  detailsPanel: {
    width: '100%' as const,
    marginBottom: spacing.xl,
  },
  detailsText: {
    marginTop: spacing.xs,
    color: palette.danger,
  },
  retryButton: { width: '100%' as const },
});
