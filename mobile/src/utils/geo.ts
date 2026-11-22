import { Linking, Platform } from 'react-native';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function extractCoordinates(
  source:
    | {
        latitude?: number | string | null;
        longitude?: number | string | null;
      }
    | null
    | undefined,
): GeoPoint | null {
  if (!source) return null;
  const lat =
    typeof source.latitude === 'number'
      ? source.latitude
      : typeof source.latitude === 'string' && source.latitude.trim() !== ''
        ? Number(source.latitude)
        : NaN;
  const lon =
    typeof source.longitude === 'number'
      ? source.longitude
      : typeof source.longitude === 'string' && source.longitude.trim() !== ''
        ? Number(source.longitude)
        : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { latitude: lat, longitude: lon };
}

export function calculateDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_METERS * c);
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 50) return '< 50 m';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

export async function openInExternalMaps(
  point: GeoPoint,
  label?: string,
): Promise<void> {
  const { latitude, longitude } = point;
  const encodedLabel = encodeURIComponent(label || 'Lokacija brojila');
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${encodedLabel}@${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;

  const canOpenNative = await Linking.canOpenURL(url).catch(() => false);
  if (canOpenNative) {
    await Linking.openURL(url);
    return;
  }
  await Linking.openURL(
    `https://maps.google.com/?q=${latitude},${longitude}`,
  );
}
