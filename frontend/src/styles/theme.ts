import { theme, type ThemeConfig } from 'antd';
import { DESIGN_TOKENS, type ResolvedTheme, type TableDensity } from './tokens';

const FONT_STACK =
  "'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Dinamička konfiguracija Ant Design tokena za Light i Dark režim,
 * u potpunosti sinhronizovana sa tokens.json / tokens.css (WCAG AAA).
 */
export function createAntdTheme(
  mode: ResolvedTheme,
  density: TableDensity = 'comfortable',
): ThemeConfig {
  const t = DESIGN_TOKENS[mode];
  const algorithms = [
    mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    ...(density === 'compact' ? [theme.compactAlgorithm] : []),
  ];

  return {
    algorithm: algorithms,
    token: {
      colorPrimary: t.accentPrimary,
      colorPrimaryHover: t.accentHover,
      colorLink: t.accentLink,
      colorLinkHover: t.accentLinkHover,
      colorInfo: t.status.info.border,
      colorSuccess: t.status.success.border,
      colorWarning: t.status.warning.border,
      colorError: t.status.danger.border,

      colorBgBase: t.canvas,
      colorBgLayout: t.canvas,
      colorBgContainer: t.surface,
      colorBgElevated: t.surfaceRaised,
      colorBorder: t.borderDefault,
      colorBorderSecondary: t.borderSubtle,

      colorText: t.textPrimary,
      colorTextSecondary: t.textSecondary,
      colorTextTertiary: t.textMuted,
      colorTextQuaternary: t.textMuted,

      fontFamily: FONT_STACK,
      fontSize: 14,
      borderRadius: 10,
      borderRadiusLG: 14,
      borderRadiusSM: 8,

      controlHeight: density === 'compact' ? 32 : 36,
      boxShadow: t.shadowCard,
      boxShadowSecondary: t.shadowElevated,
    },
    components: {
      Layout: {
        headerBg: t.headerBackdrop,
        bodyBg: t.canvas,
        siderBg: t.surfaceSunken,
        footerBg: 'transparent',
        headerHeight: 64,
        headerPadding: '0 24px',
      },
      Menu: {
        itemBg: 'transparent',
        itemColor: t.textSecondary,
        itemHoverBg: t.surfaceHover,
        itemHoverColor: t.textPrimary,
        itemSelectedBg: t.accentSoftBg,
        itemSelectedColor: t.accentSoftFg,
        itemActiveBg: t.surfaceHover,
        itemBorderRadius: 8,
        subMenuItemBg: 'transparent',
      },
      Card: {
        colorBgContainer: t.surface,
        colorBorderSecondary: t.borderSubtle,
        borderRadiusLG: 14,
        paddingLG: density === 'compact' ? 16 : 20,
      },
      Table: {
        colorBgContainer: t.surface,
        headerBg: t.surfaceSunken,
        headerColor: t.textPrimary,
        rowHoverBg: t.surfaceHover,
        borderColor: t.borderSubtle,
      },
      Button: {
        controlHeight: density === 'compact' ? 32 : 36,
        borderRadius: 8,
        primaryShadow: 'none',
        colorPrimary: t.accentPrimary,
        colorPrimaryHover: t.accentHover,
        primaryColor: t.accentOnPrimary,
      },
      Input: {
        colorBgContainer: t.surfaceSunken,
        activeBorderColor: t.focusRing,
        hoverBorderColor: t.borderStrong,
      },
      Select: {
        colorBgContainer: t.surfaceSunken,
        optionSelectedBg: t.accentSoftBg,
        optionSelectedColor: t.accentSoftFg,
      },
      Modal: {
        contentBg: t.surface,
        headerBg: t.surface,
      },
      Drawer: {
        colorBgElevated: t.surface,
      },
      Tag: {
        defaultBg: t.status.neutral.bg,
        defaultColor: t.status.neutral.fg,
      },
      Statistic: {
        contentFontSize: 26,
      },
    },
  };
}
