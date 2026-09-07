import { theme, type ThemeConfig } from 'antd';

/**
 * Dark-only design tokens for Ant Design's ConfigProvider.
 * Kept in one place so the palette used by Tailwind (tailwind.config.js)
 * and the palette used by Antd components stay in sync.
 */
export const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#6366f1',
    colorLink: '#818cf8',
    colorLinkHover: '#a5b4fc',
    colorInfo: '#6366f1',
    colorSuccess: '#34d399',
    colorWarning: '#fbbf24',
    colorError: '#f87171',

    colorBgBase: '#09090b',
    colorBgLayout: '#09090b',
    colorBgContainer: '#131316',
    colorBgElevated: '#18191d',
    colorBorder: '#26272c',
    colorBorderSecondary: '#1e1f24',

    colorText: '#f4f4f6',
    colorTextSecondary: '#a1a1aa',
    colorTextTertiary: '#71717a',
    colorTextQuaternary: '#52525b',

    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,

    controlHeight: 36,
    boxShadow:
      '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.55)',
    boxShadowSecondary:
      '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 4px 16px -8px rgba(0,0,0,0.5)',
  },
  components: {
    Layout: {
      headerBg: 'rgba(9,9,11,0.72)',
      bodyBg: '#09090b',
      siderBg: '#0c0c0f',
      footerBg: 'transparent',
      headerHeight: 64,
      headerPadding: '0 24px',
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: '#a1a1aa',
      itemHoverBg: 'rgba(255,255,255,0.04)',
      itemHoverColor: '#f4f4f6',
      itemSelectedBg: 'rgba(99,102,241,0.14)',
      itemSelectedColor: '#a5b4fc',
      itemActiveBg: 'rgba(255,255,255,0.04)',
      itemBorderRadius: 8,
      subMenuItemBg: 'transparent',
    },
    Card: {
      colorBgContainer: '#131316',
      colorBorderSecondary: '#1e1f24',
      borderRadiusLG: 14,
      paddingLG: 20,
    },
    Table: {
      colorBgContainer: '#131316',
      headerBg: '#18191d',
      headerColor: '#d1d2d8',
      rowHoverBg: 'rgba(255,255,255,0.03)',
      borderColor: '#1e1f24',
    },
    Button: {
      controlHeight: 36,
      borderRadius: 8,
      primaryShadow: 'none',
    },
    Input: {
      colorBgContainer: '#0e0e11',
      activeBorderColor: '#6366f1',
      hoverBorderColor: '#3f3f46',
    },
    Select: {
      colorBgContainer: '#0e0e11',
      optionSelectedBg: 'rgba(99,102,241,0.16)',
    },
    Modal: {
      contentBg: '#131316',
      headerBg: '#131316',
    },
    Drawer: {
      colorBgElevated: '#0c0c0f',
    },
    Tag: {
      defaultBg: 'rgba(255,255,255,0.06)',
      defaultColor: '#d1d2d8',
    },
    Statistic: {
      contentFontSize: 26,
    },
  },
};
