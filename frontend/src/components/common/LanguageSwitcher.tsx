import { GlobalOutlined } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps } from 'antd';
import { SUPPORTED_LANGUAGES, useTranslation } from '@/i18n';

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
        icon={<GlobalOutlined />}
        aria-label={t('language.switchLanguage')}
        title={t('language.switchLanguage')}
      />
    </Dropdown>
  );
}
