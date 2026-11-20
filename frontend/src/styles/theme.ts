import { theme, type ThemeConfig } from 'antd';
import { DESIGN_TOKENS, type ResolvedTheme, type TableDensity } from './tokens';

const FONT_STACK =
  "'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Industrial minimalist Ant Design token configuration synchronized
 * with tokens.json / tokens.css (WCAG AAA light & dark).
 *
 * Notice: `colorPrimary` for filled button surfaces uses `accentPrimary`
 * (contrast >= 7:1 with white text), whereas interactive text/ink indicators
 * (Tabs, Pagination, Links, Breadcrumbs) explicitly use `accentLink` so
 * dark-mode active states always render crisp luminous steel-cyan (`>= 10:1`).
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
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,

      controlHeight: density === 'compact' ? 30 : 36,
      boxShadow: t.shadowCard,
      boxShadowSecondary: t.shadowElevated,
    },
    components: {
      Layout: {
        headerBg: t.headerBackdrop,
        bodyBg: t.canvas,
        siderBg: t.surface,
        footerBg: 'transparent',
        headerHeight: 56,
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
        itemBorderRadius: 6,
        itemHeight: density === 'compact' ? 34 : 40,
        itemMarginBlock: density === 'compact' ? 2 : 3,
        iconSize: 16,
        subMenuItemBg: 'transparent',
      },
      Tabs: {
        itemColor: t.textMuted,
        itemHoverColor: t.textPrimary,
        itemSelectedColor: t.accentLink,
        itemActiveColor: t.accentLinkHover,
        inkBarColor: t.accentLink,
        horizontalItemPadding: '10px 4px',
        horizontalItemGutter: 24,
        titleFontSize: 14,
      },
      Breadcrumb: {
        itemColor: t.textMuted,
        lastItemColor: t.textPrimary,
        linkColor: t.textSecondary,
        linkHoverColor: t.accentLink,
        separatorColor: t.borderDefault,
        fontSize: 12,
      },
      Pagination: {
        colorPrimary: t.accentLink,
        colorPrimaryHover: t.accentLinkHover,
        itemActiveBg: t.accentSoftBg,
        borderRadius: 6,
      },
      Card: {
        colorBgContainer: t.surface,
        colorBorderSecondary: t.borderSubtle,
        borderRadiusLG: 8,
        paddingLG: density === 'compact' ? 16 : 24,
      },
      Table: {
        colorBgContainer: t.surface,
        headerBg: t.surfaceSunken,
        headerColor: t.textSecondary,
        headerSplitColor: t.borderSubtle,
        headerBorderRadius: 6,
        rowHoverBg: t.surfaceHover,
        borderColor: t.borderSubtle,
        cellPaddingBlock: density === 'compact' ? 8 : 14,
        cellPaddingInline: density === 'compact' ? 12 : 16,
      },
      Button: {
        controlHeight: density === 'compact' ? 30 : 36,
        borderRadius: 6,
        primaryShadow: 'none',
        defaultShadow: 'none',
        colorPrimary: t.accentPrimary,
        colorPrimaryHover: t.accentHover,
        primaryColor: t.accentOnPrimary,
        defaultBg: t.surfaceRaised,
        defaultBorderColor: t.borderSubtle,
        defaultColor: t.textPrimary,
        defaultHoverBg: t.surfaceHover,
        defaultHoverBorderColor: t.borderDefault,
        defaultHoverColor: t.textPrimary,
      },
      Input: {
        colorBgContainer: t.surfaceSunken,
        colorBorder: t.borderSubtle,
        activeBorderColor: t.focusRing,
        hoverBorderColor: t.borderDefault,
        borderRadius: 6,
      },
      Select: {
        colorBgContainer: t.surfaceSunken,
        colorBorder: t.borderSubtle,
        hoverBorderColor: t.borderDefault,
        activeBorderColor: t.focusRing,
        optionSelectedBg: t.accentSoftBg,
        optionSelectedColor: t.accentSoftFg,
        borderRadius: 6,
      },
      DatePicker: {
        colorBgContainer: t.surfaceSunken,
        colorBorder: t.borderSubtle,
        hoverBorderColor: t.borderDefault,
        activeBorderColor: t.focusRing,
        borderRadius: 6,
      },
      Switch: {
        colorPrimary: t.accentPrimary,
        colorPrimaryHover: t.accentHover,
      },
      Checkbox: {
        colorPrimary: t.accentPrimary,
        colorPrimaryHover: t.accentHover,
      },
      Radio: {
        colorPrimary: t.accentPrimary,
        colorPrimaryHover: t.accentHover,
      },
      Modal: {
        contentBg: t.surface,
        headerBg: t.surface,
        borderRadiusLG: 8,
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
