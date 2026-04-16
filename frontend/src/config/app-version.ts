const buildDateFormatter = new Intl.DateTimeFormat('bs-BA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const appVersion = __APP_VERSION__;

export const appBuildDate = __APP_BUILD_DATE__;

export const formattedAppBuildDate = buildDateFormatter.format(new Date(appBuildDate));
