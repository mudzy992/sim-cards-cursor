import { Button, Dropdown, type MenuProps } from 'antd';
import { useTranslation } from '@/i18n';
import { useThemeStore } from '@/store/theme.store';
import type { ThemePreference } from '@/styles/tokens';
import { ThemeDarkIcon, ThemeLightIcon, ThemeSystemIcon } from './icons';

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const preference = useThemeStore((s) => s.preference);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setPreference = useThemeStore((s) => s.setPreference);

  const activeIcon =
    preference === 'system' ? (
      <ThemeSystemIcon />
    ) : resolvedTheme === 'dark' ? (
      <ThemeDarkIcon />
    ) : (
      <ThemeLightIcon />
    );

  const items: MenuProps['items'] = [
    {
      key: 'system',
      icon: <ThemeSystemIcon />,
      label: t('layout.theme.system'),
    },
    {
      key: 'light',
      icon: <ThemeLightIcon />,
      label: t('layout.theme.light'),
    },
    {
      key: 'dark',
      icon: <ThemeDarkIcon />,
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
