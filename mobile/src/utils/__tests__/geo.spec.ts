jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Linking: {
    canOpenURL: jest.fn().mockResolvedValue(true),
    openURL: jest.fn().mockResolvedValue(undefined),
  },
}));

import { Linking } from 'react-native';
import {
  calculateDistanceMeters,
  extractCoordinates,
  formatDistance,
  openInExternalMaps,
} from '@/utils/geo';

describe('Geo utilities (coordinates, Haversine distance, Maps)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extracts valid numeric and string coordinates and rejects invalid ranges', () => {
    expect(extractCoordinates({ latitude: 43.8563, longitude: 18.4131 })).toEqual({
      latitude: 43.8563,
      longitude: 18.4131,
    });
    expect(extractCoordinates({ latitude: '43.85', longitude: '18.41' })).toEqual({
      latitude: 43.85,
      longitude: 18.41,
    });
    expect(extractCoordinates({ latitude: 95, longitude: 18 })).toBeNull();
    expect(extractCoordinates({ latitude: 43, longitude: '' })).toBeNull();
    expect(extractCoordinates(null)).toBeNull();
  });

  it('calculates Haversine distance accurately in meters', () => {
    const baščaršija = { latitude: 43.8598, longitude: 18.4313 };
    const marijinDvor = { latitude: 43.8548, longitude: 18.4094 };
    const dist = calculateDistanceMeters(baščaršija, marijinDvor);
    expect(dist).toBeGreaterThan(1700);
    expect(dist).toBeLessThan(2100);
    expect(calculateDistanceMeters(baščaršija, baščaršija)).toBe(0);
  });

  it('formats field distances cleanly', () => {
    expect(formatDistance(15)).toBe('< 50 m');
    expect(formatDistance(244)).toBe('240 m');
    expect(formatDistance(1480)).toBe('1.5 km');
    expect(formatDistance(14800)).toBe('15 km');
    expect(formatDistance(-5)).toBe('—');
  });

  it('opens external maps URL with native geo scheme when supported', async () => {
    await openInExternalMaps({ latitude: 43.8563, longitude: 18.4131 }, 'Brojilo 1');
    expect(Linking.openURL).toHaveBeenCalledWith(
      'geo:43.8563,18.4131?q=43.8563,18.4131(Brojilo%201)',
    );
  });
});
