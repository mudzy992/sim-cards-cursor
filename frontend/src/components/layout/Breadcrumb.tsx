import { Breadcrumb as AntBreadcrumb } from 'antd';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { ROUTES } from '@/config/routes';

const SEGMENT_TRANSLATION_KEYS: Record<string, string> = {
  dashboard: 'layout.sidebar.dashboard',
  analytics: 'layout.sidebar.analytics',
  shipments: 'layout.sidebar.shipments',
  'sim-cards': 'layout.sidebar.simCards',
  meters: 'layout.sidebar.meters',
  'meter-types': 'layout.sidebar.meterTypes',
  'meter-type-fields': 'layout.sidebar.meterTypeFields',
  'installation-records': 'layout.sidebar.installationRecords',
  users: 'layout.sidebar.users',
  'branch-moderators': 'layout.sidebar.branchModerators',
  'branch-email-recipients': 'layout.sidebar.branchEmailRecipients',
  'push-campaigns': 'layout.sidebar.pushCampaigns',
  'activity-log': 'layout.sidebar.activityLog',
  settings: 'layout.sidebar.settings',
  email: 'layout.sidebar.emailSmtp',
  'app-releases': 'layout.sidebar.appReleases',
  new: 'common.actions.create',
  edit: 'common.actions.edit',
  print: 'common.actions.print',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Breadcrumb() {
  const location = useLocation();
  const { t } = useTranslation();

  const items = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);

    if (parts.length === 0) {
      return [{ title: t('layout.breadcrumb.home') }];
    }

    const trail: Array<{ title: React.ReactNode }> = [
      {
        title: (
          <Link to={ROUTES.dashboard} className="text-fg-muted hover:text-accent-link">
            {t('layout.breadcrumb.home')}
          </Link>
        ),
      },
    ];

    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1;
      const pathAcc = `/${parts.slice(0, idx + 1).join('/')}`;
      const key = SEGMENT_TRANSLATION_KEYS[part];
      const label = key
        ? t(key)
        : UUID_RE.test(part)
          ? `#${part.slice(0, 8)}`
          : part.charAt(0).toUpperCase() + part.slice(1);

      trail.push({
        title: isLast ? (
          <span className="font-medium text-fg-primary">{label}</span>
        ) : (
          <Link to={pathAcc} className="text-fg-secondary hover:text-accent-link">
            {label}
          </Link>
        ),
      });
    });

    return trail;
  }, [location.pathname, t]);

  return (
    <nav aria-label={t('layout.a11y.breadcrumbNavigation')} className="mb-4">
      <AntBreadcrumb items={items} />
    </nav>
  );
}
