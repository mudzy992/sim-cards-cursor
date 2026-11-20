import { Button, Dropdown, type MenuProps } from 'antd';
import { SUPPORTED_LANGUAGES, useTranslation } from '@/i18n';
import { GlobeIcon } from '@/components/ui/icons';

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslation();

  const items: MenuProps['items'] = SUPPORTED_LANGUAGES.map((lang) => ({
    key: lang,
    label: t(`language.${lang}`),
  }));

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    setLanguage(key as typeof language);
  };

  return (
    <Dropdown
      menu={{ items, selectedKeys: [language], onClick: handleClick }}
      trigger={['click']}
    >
      <Button
        type="text"
        size="small"
        icon={<GlobeIcon />}
        aria-label={t('language.switchLanguage')}
        title={t('language.switchLanguage')}
        className="!px-2 text-fg-secondary hover:text-fg-primary"
      />
    </Dropdown>
  );
}
