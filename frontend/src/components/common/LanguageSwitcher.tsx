import { GlobalOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useTranslation } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n';

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
      <button
        type="button"
        aria-label={t('language.switchLanguage')}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        title={t('language.switchLanguage')}
      >
        <GlobalOutlined />
      </button>
    </Dropdown>
  );
}
