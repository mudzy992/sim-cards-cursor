import { Button, Tooltip } from 'antd';
import { useTranslation } from '@/i18n';
import { useThemeStore } from '@/store/theme.store';
import { DensityComfortableIcon, DensityCompactIcon } from './icons';

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
        type="text"
        size="small"
        icon={isCompact ? <DensityCompactIcon /> : <DensityComfortableIcon />}
        onClick={() => setDensity(nextDensity)}
        aria-label={tooltip}
        aria-pressed={isCompact}
        className="!px-2 text-fg-secondary hover:text-fg-primary"
      >
        <span className="hidden xl:inline text-xs">{label}</span>
      </Button>
    </Tooltip>
  );
}
