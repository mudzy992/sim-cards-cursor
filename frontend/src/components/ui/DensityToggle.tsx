import { ColumnHeightOutlined, CompressOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useTranslation } from '@/i18n';
import { useThemeStore } from '@/store/theme.store';

export function DensityToggle() {
  const { t } = useTranslation();
  const density = useThemeStore((s) => s.density);
  const setDensity = useThemeStore((s) => s.setDensity);

  const isCompact = density === 'compact';
  const nextDensity = isCompact ? 'comfortable' : 'compact';
  const label = isCompact
    ? t('layout.density.compact')
    : t('layout.density.comfortable');
  const tooltip = t('layout.density.toggleHint', {
    next: t(`layout.density.${nextDensity}`),
  });

  return (
    <Tooltip title={tooltip}>
      <Button
        icon={isCompact ? <CompressOutlined /> : <ColumnHeightOutlined />}
        onClick={() => setDensity(nextDensity)}
        aria-label={tooltip}
        aria-pressed={isCompact}
      >
        <span className="hidden lg:inline">{label}</span>
      </Button>
    </Tooltip>
  );
}
