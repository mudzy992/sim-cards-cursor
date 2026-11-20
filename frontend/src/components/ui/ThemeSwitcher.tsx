import { DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps } from 'antd';
import { useTranslation } from '@/i18n';
import { useThemeStore } from '@/store/theme.store';
import type { ThemePreference } from '@/styles/tokens';

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const preference = useThemeStore((s) => s.preference);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setPreference = useThemeStore((s) => s.setPreference);

  const activeIcon =
    preference === 'system' ? (
      <DesktopOutlined />
    ) : resolvedTheme === 'dark' ? (
      <MoonOutlined />
    ) : (
      <SunOutlined />
    );

  const items: MenuProps['items'] = [
    {
      key: 'system',
      icon: <DesktopOutlined />,
      label: t('layout.theme.system'),
    },
    {
      key: 'light',
      icon: <SunOutlined />,
      label: t('layout.theme.light'),
    },
    {
      key: 'dark',
      icon: <MoonOutlined />,
      label: t('layout.theme.dark'),
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'system' || key === 'light' || key === 'dark') {
      setPreference(key as ThemePreference);
    }
  };

  return (
    <Dropdown
      menu={{
        items,
        selectable: true,
        selectedKeys: [preference],
        onClick: handleMenuClick,
      }}
      trigger={['click']}
    >
      <Button
        type="text"
        size="small"
        icon={activeIcon}
        aria-label={t('layout.theme.switchTheme', {
          mode: t(`layout.theme.${preference}`),
        })}
        title={t('layout.theme.switchTheme', {
          mode: t(`layout.theme.${preference}`),
        })}
        className="!px-2 text-fg-secondary hover:text-fg-primary"
      >
        <span className="hidden xl:inline text-xs">{t(`layout.theme.${preference}`)}</span>
      </Button>
    </Dropdown>
  );
}
