import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className = '', ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`.trim()}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function SimChipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="2.5" width="14" height="15" rx="2" />
      <path d="M7 7.5h6v5H7z" />
      <path d="M10 2.5v5M10 12.5v5M3 10h4M13 10h4" />
    </Icon>
  );
}

export function NavDashboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.75" y="2.75" width="6" height="6" rx="1.25" />
      <rect x="11.25" y="2.75" width="6" height="4" rx="1.25" />
      <rect x="2.75" y="11.25" width="6" height="6" rx="1.25" />
      <rect x="11.25" y="9.25" width="6" height="8" rx="1.25" />
    </Icon>
  );
}

export function NavAnalyticsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 16.5h14" />
      <path d="M5.5 13.5V10" />
      <path d="M10 13.5V6.5" />
      <path d="M14.5 13.5V4" />
    </Icon>
  );
}

export function NavShipmentsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.5 16.75 6.25v7.5L10 17.5l-6.75-3.75v-7.5z" />
      <path d="M3.25 6.25 10 10l6.75-3.75" />
      <path d="M10 10v7.5" />
    </Icon>
  );
}

export function NavSimCardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 2.75h7l3.25 3.25v11.25a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V4.25A1.5 1.5 0 0 1 5 2.75z" />
      <rect x="6.5" y="9.5" width="7" height="5" rx="0.75" />
      <path d="M10 9.5v5M6.5 12h7" />
    </Icon>
  );
}

export function NavMetersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.25" y="2.75" width="13.5" height="14.5" rx="2" />
      <rect x="6" y="5.5" width="8" height="3.75" rx="0.75" />
      <path d="M6.5 12.75h2.25M11.25 12.75h2.25M10 15v.25" />
    </Icon>
  );
}

export function NavRecordsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.25 3.25h7.5l2.5 2.5v10.5a1.5 1.5 0 0 1-1.5 1.5h-8.5a1.5 1.5 0 0 1-1.5-1.5V4.75a1.5 1.5 0 0 1 1.5-1.5z" />
      <path d="M7.5 9h5M7.5 12h5M7.5 14.75h3" />
    </Icon>
  );
}

export function NavUsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="7" r="2.75" />
      <path d="M3 16.25a5 5 0 0 1 10 0" />
      <circle cx="14.25" cy="8" r="2" />
      <path d="M14.75 12.25a3.5 3.5 0 0 1 2.75 3.5" />
    </Icon>
  );
}

export function NavMailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.75" y="4.25" width="14.5" height="11.5" rx="1.75" />
      <path d="m3.5 5.25 6.5 5 6.5-5" />
    </Icon>
  );
}

export function NavBroadcastIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="1.75" />
      <path d="M6.4 13.6a5.1 5.1 0 0 1 0-7.2M13.6 6.4a5.1 5.1 0 0 1 0 7.2" />
      <path d="M4 16a8.5 8.5 0 0 1 0-12M16 4a8.5 8.5 0 0 1 0 12" />
    </Icon>
  );
}

export function NavActivityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.75 10.5h3.25l2-4.75 3.25 8.5 2.25-3.75h3.75" />
    </Icon>
  );
}

export function NavSettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 3v1.75M10 15.25V17M3 10h1.75M15.25 10H17M5.05 5.05l1.24 1.24M13.71 13.71l1.24 1.24M14.95 5.05l-1.24 1.24M6.29 13.71l-1.24 1.24" />
    </Icon>
  );
}

export function NavReleaseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5.5" y="2.5" width="9" height="15" rx="1.75" />
      <path d="M8.75 14.75h2.5" />
      <path d="M10 6.5v4.5M8.25 8.25 10 6.5l1.75 1.75" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.25 8.5a4.75 4.75 0 1 1 9.5 0c0 3.75 1.25 5 1.75 5.5h-13c.5-.5 1.75-1.75 1.75-5.5z" />
      <path d="M8.25 16.25a1.75 1.75 0 0 0 3.5 0" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </Icon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 3.5h-3a1.5 1.5 0 0 0-1.5 1.5v10a1.5 1.5 0 0 0 1.5 1.5h3" />
      <path d="M12.5 6.5 16 10l-3.5 3.5" />
      <path d="M7.5 10H16" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
    </Icon>
  );
}

export function DensityComfortableIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 5h13M3.5 10h13M3.5 15h13" />
    </Icon>
  );
}

export function DensityCompactIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 4.5h13M3.5 8.2h13M3.5 11.8h13M3.5 15.5h13" />
    </Icon>
  );
}

export function ThemeSystemIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.75" y="3.5" width="14.5" height="10" rx="1.5" />
      <path d="M7 16.5h6M10 13.5v3" />
    </Icon>
  );
}

export function ThemeLightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="3.25" />
      <path d="M10 2.75v1.5M10 15.75v1.5M2.75 10h1.5M15.75 10h1.5M4.87 4.87l1.06 1.06M14.07 14.07l1.06 1.06M15.13 4.87l-1.06 1.06M5.93 14.07l-1.06 1.06" />
    </Icon>
  );
}

export function ThemeDarkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.75 11.75A6.25 6.25 0 0 1 8.25 4.25a6.25 6.25 0 1 0 7.5 7.5z" />
    </Icon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7" />
      <ellipse cx="10" cy="10" rx="3" ry="7" />
      <path d="M3.25 10h13.5" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.5 10H4.5" />
      <path d="M9 5.5 4.5 10 9 14.5" />
    </Icon>
  );
}

export function ShieldRoleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.75 15.75 5v4.75c0 3.5-2.45 6.1-5.75 7.5-3.3-1.4-5.75-4-5.75-7.5V5z" />
      <path d="m7.75 10 1.5 1.5 3-3" />
    </Icon>
  );
}

export function OrgRoleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="1.75" />
      <path d="M7.25 7.5h1.5M11.25 7.5h1.5M7.25 11h1.5M11.25 11h1.5M9 16.5v-2.25h2v2.25" />
    </Icon>
  );
}

export function OperatorRoleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="7" r="3" />
      <path d="M4.5 16.5a5.5 5.5 0 0 1 11 0" />
    </Icon>
  );
}
